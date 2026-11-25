import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorManager } from "../src/lib/editors/manager.ts";
import { serializeEditorWorkspace } from "../src/lib/editors/persistence.ts";
import { EditorRegistry } from "../src/lib/editors/registry.ts";
import { restoreWorkbench } from "../src/lib/state.ts";

const ownerId = "milo.test";
const singleton = { editorTypeId: ownerId + ".settings" };
const resource = (name = "alpha") => ({ editorTypeId: ownerId + ".sample", resource: name });
const renderer = () => {};
const load = async () => ({ default: renderer });

function fixture({ confirm = () => "cancel", save, discard, dispose, canRestore } = {}) {
    const registry = new EditorRegistry();
    const changes = new Map();
    const prompts = [];
    const failures = [];
    const disposeSingleton = registry.register({
        id: singleton.editorTypeId,
        ownerId,
        kind: "singleton",
        title: "Settings",
        restore: true,
        preview: false,
        load,
    });
    registry.register({
        id: resource().editorTypeId,
        ownerId,
        kind: "resource",
        title: "Sample",
        describe: (name) => (name === "missing" ? undefined : { title: name }),
        canRestore: canRestore ?? ((name) => ["alpha", "beta"].includes(name)),
        load,
        createSession: (tab, change) => {
            changes.set(tab.id, change);
            return { save, discard, dispose: () => dispose?.(tab.id) };
        },
    });
    const editor = new EditorManager(registry, undefined, {
        confirm: async (prompt) => {
            prompts.push(prompt);
            return confirm(prompt);
        },
        failed: (tab, operation) => failures.push([tab.id, operation]),
    });
    const report = (id, dirty = true) => {
        editor.context(id);
        changes.get(id)(dirty);
    };
    const tab = (id) => editor.state.groups.flatMap((group) => group.tabs).find((tab) => tab.id === id);
    const close = (id) => editor.close(tab(id).groupId, "self", id);
    return { editor, registry, report, close, tab, prompts, failures, disposeSingleton };
}

const ids = (group) => group.tabs.map((tab) => tab.id);

test("resource focus is group-scoped, new instances use distinct IDs, and singletons are workspace-wide", () => {
    const { editor } = fixture();
    const settings = editor.open(singleton);
    editor.splitRight();
    const [left, right] = editor.state.groups;
    assert.equal(editor.open(singleton, { groupId: right.id, newInstance: true }).id, settings.id);
    assert.equal(editor.focusedGroup.id, left.id);

    const one = editor.open(resource());
    const two = editor.open(resource("beta"));
    assert.equal(editor.open(resource()).id, one.id);
    const another = editor.open(resource(), { newInstance: true });
    const onRight = editor.open(resource(), { groupId: right.id });
    assert.equal(new Set([settings.id, one.id, two.id, another.id, onRight.id]).size, 5);
    assert.notEqual(one.id, one.editorTypeId);
    assert.equal(one.ownerId, ownerId);
    assert.equal(another.resource, one.resource);
    assert.equal(onRight.groupId, right.id);
});

test("only the eligible preview is replaced, and explicit open promotes an existing preview", () => {
    const disposed = [];
    const { editor, tab } = fixture({ dispose: (id) => disposed.push(id) });
    const defaultTab = editor.open(singleton, { preview: true });
    assert.equal(defaultTab.preview, false);
    const one = editor.open(resource(), { preview: true });
    editor.context(one.id);
    const two = editor.open(resource("beta"), { preview: true });
    assert.equal(tab(one.id), undefined);
    assert.deepEqual(disposed, [one.id]);
    assert.equal(editor.canReopen, false);
    assert.equal(tab(two.id).preview, true);
    assert.equal(editor.open(resource("beta")).preview, false);
    assert.equal(editor.open(resource("beta"), { preview: true }).id, two.id);
    assert.equal(tab(two.id).preview, false);
});

test("editing, pinning and explicit promotion protect previews", () => {
    const { editor, report, tab } = fixture();
    const one = editor.open(resource(), { preview: true });
    report(one.id);
    const two = editor.open(resource("beta"), { preview: true });
    assert.equal(tab(one.id).preview, false);
    assert.equal(tab(one.id).dirty, true);
    editor.pin(two.id, true);
    assert.equal(tab(two.id).preview, false);
    const three = editor.open(resource("third"), { preview: true });
    editor.promote(three.id);
    assert.equal(tab(three.id).preview, false);
    assert.equal(editor.focusedGroup.tabs.length, 3);
});

test("bulk close preserves pinned tabs and active close selects its previous neighbor or next at the start", async () => {
    const { editor, close } = fixture();
    const one = editor.open(singleton);
    const two = editor.open(resource());
    const three = editor.open(resource("beta"));
    editor.pin(two.id, true);
    editor.focusTab(one.id);
    await editor.close(one.groupId, "right", one.id);
    assert.deepEqual(ids(editor.focusedGroup), [two.id, one.id]);
    assert.equal(editor.focusedGroup.activeId, one.id);
    const four = editor.open(resource("beta"));
    await editor.close(one.groupId, "others", four.id);
    assert.deepEqual(ids(editor.focusedGroup), [two.id, four.id]);
    assert.equal(editor.focusedGroup.activeId, four.id);
    await close(four.id);
    assert.equal(editor.focusedGroup.activeId, two.id);

    const five = editor.open(three);
    await close(two.id);
    assert.equal(editor.focusedGroup.activeId, five.id);
    editor.pin(five.id, true);
    assert.equal(await editor.close(five.groupId, "all"), false);
    assert.equal(await close(five.id), true);
    assert.equal(editor.focusedGroup.activeId, null);
});

test("closing a dirty tab can cancel, save or discard through one lifecycle", async () => {
    let decision = "cancel";
    const operations = [];
    const { editor, report, close, tab, prompts } = fixture({
        confirm: () => decision,
        save: () => (operations.push("save"), true),
        discard: () => (operations.push("discard"), true),
        dispose: () => operations.push("dispose"),
    });

    const one = editor.open(resource());
    report(one.id);
    assert.equal(await close(one.id), false);
    assert.equal(tab(one.id).dirty, true);
    assert.equal(prompts[0].canSave, true);
    assert.deepEqual(operations, []);

    decision = "save";
    assert.equal(await close(one.id), true);
    assert.deepEqual(operations, ["save", "dispose"]);
    const two = editor.reopen();
    assert.notEqual(two.id, one.id);
    assert.equal(two.dirty, false);
    report(two.id);
    decision = "discard";
    assert.equal(await close(two.id), true);
    assert.deepEqual(operations, ["save", "dispose", "discard", "dispose"]);
});

test("save rejection or cancellation blocks the entire bulk close and skips deferred discards", async () => {
    let reject = true;
    let discards = 0;
    const { editor, report, tab, failures } = fixture({
        confirm: ({ tab }) => (tab.resource === "alpha" ? "discard" : "save"),
        save: async () => {
            if (reject) throw new Error("write failed");
            return false;
        },
        discard: () => (++discards, true),
    });
    const a = editor.open(resource());
    const b = editor.open(resource("beta"));
    report(a.id);
    report(b.id);
    for (const value of [true, false]) {
        reject = value;
        assert.equal(await editor.close(a.groupId, "all"), false);
        assert.deepEqual(ids(editor.focusedGroup), [a.id, b.id]);
        assert.equal(tab(b.id).dirty, true);
    }
    assert.equal(discards, 0);
    assert.deepEqual(failures, [
        [b.id, "save"],
        [b.id, "save"],
    ]);
});

test("a change while a save is in flight keeps the updated draft open", async () => {
    const { promise, resolve } = Promise.withResolvers();
    const { editor, report, close, tab } = fixture({ confirm: () => "save", save: () => promise });
    const { id } = editor.open(resource());
    report(id);
    const closing = close(id);
    await Promise.resolve();
    report(id);
    resolve(true);
    assert.equal(await closing, false);
    assert.equal(tab(id).dirty, true);
});

test("a cancelled bulk decision leaves all targets and pending discards intact", async () => {
    let discards = 0;
    const { editor, report } = fixture({
        confirm: ({ tab }) => (tab.resource === "alpha" ? "discard" : "cancel"),
        discard: () => (++discards, true),
    });
    const a = editor.open(resource());
    const b = editor.open(resource("beta"));
    report(a.id);
    report(b.id);
    assert.equal(await editor.close(a.groupId, "all"), false);
    assert.deepEqual(ids(editor.focusedGroup), [a.id, b.id]);
    assert.equal(discards, 0);
});

test("navigation, active tabs, previews and focus are independent in each group", () => {
    const { editor } = fixture();
    const settings = editor.open(singleton);
    editor.splitRight();
    const right = editor.focusedGroup;
    const one = editor.open(resource(), { preview: true });
    const two = editor.open(resource("beta"));
    editor.splitRight();
    assert.equal(editor.state.groups.length, 2);
    editor.navigate(1);
    assert.equal(editor.focusedGroup.activeId, one.id);
    editor.navigate(-1);
    assert.equal(editor.focusedGroup.activeId, two.id);

    editor.focusOtherGroup();
    assert.equal(editor.focusedGroup.activeId, settings.id);
    const leftPreview = editor.open(resource("beta"), { preview: true });
    assert.equal(leftPreview.preview, true);
    assert.equal(editor.state.groups[1].id, right.id);
    assert.equal(editor.state.groups[1].activeId, two.id);
    assert.equal(editor.state.groups[1].tabs[0].preview, true);
    editor.splitRight();
    assert.equal(editor.focusedGroup.activeId, two.id);
    assert.notEqual(leftPreview.id, two.id);
});

test("moving and reordering preserve session, dirty and pinned state and the pinned prefix", () => {
    const { editor, report, tab } = fixture();
    const one = editor.open(resource());
    const two = editor.open(resource("beta"));
    const three = editor.open(resource("third"));
    editor.pin(one.id, true);
    report(one.id);
    editor.reorder(one.groupId, [three.id, one.id, two.id]);
    assert.deepEqual(ids(editor.focusedGroup), [one.id, three.id, two.id]);
    const state = editor.state;
    editor.reorder(one.groupId, [one.id, three.id, three.id]);
    assert.strictEqual(editor.state, state);
    editor.stepTab(three.id, 1);
    assert.deepEqual(ids(editor.focusedGroup), [one.id, two.id, three.id]);

    const context = editor.context(one.id);
    editor.moveToOtherGroup(one.id);
    assert.equal(editor.focusedGroup.activeId, one.id);
    assert.notEqual(tab(one.id).groupId, one.groupId);
    assert.equal(editor.state.groups[0].activeId, three.id);
    assert.equal(tab(one.id).dirty, true);
    assert.equal(tab(one.id).pinned, true);
    assert.strictEqual(editor.context(one.id), context);
    const preview = editor.open(resource("third"), { preview: true });
    const fromLeft = editor.open(resource("fourth"), { preview: true, groupId: one.groupId });
    editor.moveTab(fromLeft.id, preview.groupId, preview.id);
    assert.equal(tab(fromLeft.id).preview, false);
    assert.equal(tab(preview.id).preview, true);
    assert.deepEqual(ids(editor.focusedGroup), [one.id, fromLeft.id, preview.id]);
});

test("group close shares dirty protection and moves pinned tabs to the surviving group", async () => {
    let decision = "cancel";
    const { editor, report, tab } = fixture({ confirm: () => decision });
    const one = editor.open(resource());
    editor.pin(one.id, true);
    report(one.id);
    const dirty = editor.open(resource("beta"));
    report(dirty.id);
    editor.splitRight();
    const survivor = editor.focusedGroup.id;
    assert.equal(await editor.closeGroup(one.groupId), false);
    assert.equal(editor.state.groups.length, 2);
    decision = "discard";
    assert.equal(await editor.closeGroup(one.groupId), true);
    assert.equal(editor.focusedGroup.id, survivor);
    assert.equal(editor.state.groups.length, 1);
    assert.equal(tab(dirty.id), undefined);
    assert.equal(tab(one.id).groupId, survivor);
    assert.equal(tab(one.id).dirty, true);
    assert.equal(tab(one.id).pinned, true);
    assert.equal(await editor.closeGroup(survivor), false);
});

test("reopen targets the focused group, keeps pins, skips stale entries and bounds history", async () => {
    const { editor, registry, close, disposeSingleton } = fixture();
    const pinned = editor.open(resource());
    editor.pin(pinned.id, true);
    await close(pinned.id);
    const settings = editor.open(singleton);
    await close(settings.id);
    disposeSingleton();
    assert.equal(registry.get(singleton.editorTypeId), undefined);
    editor.splitRight();
    const reopened = editor.reopen();
    assert.equal(reopened.groupId, editor.state.groups[1].id);
    assert.equal(reopened.pinned, true);
    assert.notEqual(reopened.id, pinned.id);
    assert.equal(editor.canReopen, false);

    for (let index = 0; index < 25; index++) {
        const { id } = editor.open(resource(String(index)));
        await close(id);
    }
    const restored = Array.from({ length: 20 }, () => editor.reopen()?.resource);
    assert.deepEqual(
        restored,
        Array.from({ length: 20 }, (_, index) => String(24 - index))
    );
    assert.equal(editor.reopen(), undefined);
});

test("shutdown protects pinned and inactive editors and keeps the restorable layout", async () => {
    let decision = "cancel";
    let calls = 0;
    const { editor, report, prompts } = fixture({ confirm: () => decision, save: () => true });
    const pinned = editor.open(resource());
    editor.pin(pinned.id, true);
    report(pinned.id);
    editor.splitRight();
    const right = editor.open(resource("beta"));
    report(right.id);
    const approve = async () => ++calls;
    assert.equal(await editor.requestShutdown(approve), false);
    assert.equal(calls, 0);
    assert.equal(prompts[0].tab.id, pinned.id);
    decision = "save";
    assert.equal(await editor.requestShutdown(approve), true);
    assert.equal(calls, 1);
    assert.equal(editor.state.groups.length, 2);
    assert.equal(editor.state.groups[0].tabs[0].pinned, true);
    assert.equal(editor.state.groups[0].tabs[0].dirty, false);
    assert.equal(editor.open(singleton), undefined);
});

test("registry ownership, disposal and close protection compose for future owner cleanup", async () => {
    let decision = "cancel";
    const { editor, registry, report, disposeSingleton } = fixture({ confirm: () => decision });
    const entry = registry.get(singleton.editorTypeId);
    assert.throws(() => registry.register(entry), /already registered/);
    assert.throws(() => registry.register({ ...entry, ownerId: "different" }), /namespaced/);
    const other = registry.register({ ...entry, id: "another.owner.view", ownerId: "another.owner" });
    const tab = editor.open(resource());
    report(tab.id);
    assert.equal(await editor.closeOwner(ownerId), false);
    assert.equal(editor.focusedGroup.activeId, tab.id);
    decision = "discard";
    assert.equal(await editor.closeOwner(ownerId), true);
    registry.removeOwner(ownerId);
    assert.equal(editor.open(resource()), undefined);
    assert.ok(registry.get("another.owner.view"));
    registry.register(entry);
    disposeSingleton();
    assert.ok(registry.get(singleton.editorTypeId));
    other();
    assert.equal(registry.get("another.owner.view"), undefined);
});

test("renderer loads lazily, shares successful resolutions and can retry a missing renderer", async () => {
    const { registry } = fixture();
    let loads = 0;
    const dispose = registry.register({
        ...registry.get(singleton.editorTypeId),
        id: ownerId + ".broken",
        load: async () => ({ default: loads++ === 0 ? undefined : renderer }),
    });
    const entry = registry.get(ownerId + ".broken");
    assert.equal(loads, 0);
    await assert.rejects(registry.resolveRenderer(entry), /unavailable/);
    const retry = registry.resolveRenderer(entry);
    assert.strictEqual(registry.resolveRenderer(entry), retry);
    assert.strictEqual(await retry, renderer);
    assert.equal(loads, 2);
    dispose();
    await assert.rejects(registry.resolveRenderer(entry), /unavailable/);
});

test("workspace migrates v1 and restores only registration-supported metadata", () => {
    const { registry, editor, report } = fixture();
    const config = {
        registry,
        defaultEditor: singleton,
        legacyEditors: new Map([
            ["welcome", singleton],
            ["sample", resource()],
        ]),
    };
    const fromV1 = restoreWorkbench(
        {
            version: 1,
            panes: { primary: { open: false, size: 30 } },
            editor: {
                tabs: [{ id: "sample", pinned: true }, { id: "missing" }, { id: "sample" }, { id: "welcome" }],
                activeId: "welcome",
            },
        },
        config
    );
    const legacyGroup = fromV1.editor.groups[0];
    assert.equal(fromV1.version, 3);
    assert.deepEqual(fromV1.panes.primary, { open: false, size: 30 });
    assert.deepEqual(
        legacyGroup.tabs.map(({ editorTypeId }) => editorTypeId),
        [resource().editorTypeId, singleton.editorTypeId]
    );
    assert.equal(legacyGroup.activeId, legacyGroup.tabs[1].id);
    assert.notEqual(legacyGroup.tabs[0].id, "sample");
    assert.equal(legacyGroup.tabs[0].pinned, true);
    assert.equal(restoreWorkbench({ version: 1, editor: { tabs: [] } }, config).editor.groups[0].activeId, null);

    const first = editor.open(resource());
    editor.pin(first.id, true);
    report(first.id);
    editor.splitRight();
    const last = editor.open(resource("beta"), { preview: true });
    editor.open(resource("temporary"));
    editor.focusTab(last.id);
    const saved = serializeEditorWorkspace(editor.state, registry);
    const serialized = JSON.stringify({ version: 2, editor: saved });
    assert.doesNotMatch(serialized, /dirty|title|icon|temporary/);
    const restored = restoreWorkbench(JSON.parse(serialized), config).editor;
    assert.equal(restored.focusedGroupId, last.groupId);
    assert.equal(restored.groups[1].activeId, last.id);
    assert.equal(restored.groups[1].tabs[1].preview, true);
    assert.equal(restored.groups[0].tabs[0].dirty, false);
    assert.equal(restored.groups[0].tabs[0].pinned, true);
});

test("invalid workspace recovers safely from duplicate IDs, missing types and unavailable resources", () => {
    const { registry } = fixture({ canRestore: () => true });
    const config = { registry, defaultEditor: singleton, legacyEditors: new Map() };
    const available = { id: "available", ownerId, ...resource(), title: "malformed", preview: true };
    const settings = { id: "settings", ownerId, ...singleton, preview: true };
    const result = restoreWorkbench(
        {
            version: 2,
            editor: {
                focusedGroupId: "unknown",
                groups: [
                    null,
                    {
                        id: "first",
                        activeId: "lost",
                        tabs: [
                            available,
                            { ...available, id: "second-preview", resource: "beta" },
                            { ...available, id: "lost", resource: "missing" },
                            { ...available, id: "foreign", ownerId: "foreign" },
                            { ...available, id: "unknown", editorTypeId: "missing.type" },
                            settings,
                        ],
                    },
                    { id: "first", tabs: [] },
                    { id: "second", tabs: [available, { ...settings, id: "copy" }] },
                    { id: "third", tabs: [] },
                ],
            },
        },
        config
    ).editor;
    assert.equal(result.focusedGroupId, "first");
    assert.deepEqual(result.groups.map(ids), [["available", "second-preview", "settings"], []]);
    assert.equal(result.groups[0].activeId, "available");
    assert.equal(result.groups[0].tabs[0].title, "alpha");
    assert.deepEqual(
        result.groups[0].tabs.map(({ preview }) => preview),
        [true, false, false]
    );
    assert.equal(
        restoreWorkbench({ version: 99 }, config).editor.groups[0].tabs[0].editorTypeId,
        singleton.editorTypeId
    );
});

test("retired Settings and Appearance tabs leave the remaining editors available", () => {
    const { registry } = fixture();
    const workspace = restoreWorkbench(
        {
            version: 2,
            editor: {
                groups: [
                    {
                        id: "main",
                        activeId: "settings",
                        tabs: [
                            { id: "settings", ownerId: "milo.settings", editorTypeId: "milo.settings.editor" },
                            {
                                id: "appearance",
                                ownerId: "milo.workbench",
                                editorTypeId: "milo.workbench.appearance",
                                pinned: true,
                            },
                            { id: "keep", ownerId, ...singleton },
                        ],
                    },
                ],
            },
        },
        { registry, legacyEditors: new Map() }
    );
    const [group] = workspace.editor.groups;
    assert.equal(group.activeId, "keep");
    assert.deepEqual(ids(group), ["keep"]);
});
