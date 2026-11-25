import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorManager } from "../src/lib/editors/manager.ts";
import { EditorRegistry } from "../src/lib/editors/registry.ts";
import { actionIDs, editorOpenAction } from "../src/lib/modules/action/ids.ts";
import { ActionRegistry } from "../src/lib/modules/action/registry.ts";
import { bindShortcuts, resolveShortcut } from "../src/lib/modules/action/shortcuts.ts";
import { connectCatalog } from "../src/lib/modules/backend-catalog.ts";
import { SearchRegistry } from "../src/lib/modules/search/registry.ts";
import { registerEditorActions } from "../src/lib/workbench-editor-actions.ts";

const workbench = { layer: "workbench", flags: ["workbench"] };
const editorContext = { layer: "workbench", flags: ["workbench", "group", "editor"] };
const entry = (id, opts = {}) => ({ id: "test." + id, owner: "test", title: id, run() {}, ...opts });
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

test("dispatch validates notification ownership, availability, context and arguments", async () => {
    let context = workbench;
    let enabled = true;
    let runs = 0;
    const failures = [];
    const actions = new ActionRegistry(
        () => context,
        (failure) => failures.push(failure)
    );
    const action = entry("open", {
        requires: ["editor"],
        delegates: ["test.sender"],
        enabled: () => enabled,
        validate: (args) => Object.keys(args).length === 1 && args.tab === "existing",
        run: () => runs++,
    });
    const dispose = actions.register(action);
    assert.throws(() => actions.register(action), /Duplicate action ID/);
    const ref = { id: action.id, args: { tab: "existing" } };
    assert.equal(await actions.invoke(ref, "test.sender"), false);
    context = editorContext;
    assert.equal(await actions.invoke(ref, "test.other"), false);
    assert.equal(await actions.invoke({ ...ref, args: { tab: 2 } }, "test.sender"), false);
    assert.equal(await actions.invoke(ref, "test.sender"), true);
    enabled = false;
    assert.equal(await actions.invoke(ref, "test.sender"), false);
    actions.removeOwner("test");
    assert.equal(await actions.invoke(ref, "test.sender"), false);
    actions.register(action);
    dispose();
    assert.ok(actions.lookup(action.id));
    assert.equal(runs, 1);
    assert.deepEqual(failures, ["unavailable", "unavailable", "arguments", "unavailable", "missing"]);
});

test("asynchronous failure is reported safely, and cancellation reaches started handlers", async () => {
    const failures = [];
    const actions = new ActionRegistry(
        () => workbench,
        (failure) => failures.push(failure)
    );
    actions.register(
        entry("failure", {
            run: async () => {
                throw Error("internal detail");
            },
        })
    );
    assert.equal(await actions.invoke({ id: "test.failure" }), false);
    assert.deepEqual(failures, ["failed"]);

    let signals = 0;
    const def = entry("cancel", {
        run: (_args, signal) =>
            new Promise((_resolve, reject) =>
                signal.addEventListener(
                    "abort",
                    () => {
                        signals++;
                        reject(signal.reason);
                    },
                    { once: true }
                )
            ),
    });
    actions.register(def);
    const controller = new AbortController();
    const invocation = actions.invoke({ id: def.id }, "", { signal: controller.signal });
    controller.abort();
    assert.equal(await invocation, false);
    const another = actions.invoke({ id: def.id });
    actions.removeOwner(def.owner);
    assert.equal(await another, false);
    assert.equal(signals, 2);
    assert.deepEqual(failures, ["failed"]);
});

const key = (opts = {}) => ({
    key: "p",
    ctrlKey: true,
    shiftKey: false,
    defaultPrevented: false,
    composedPath: () => [],
    preventDefault() {
        this.defaultPrevented = true;
    },
    ...opts,
});

test("shortcuts scope layered contexts, reject ties and preserve native controls", async () => {
    let layer = workbench;
    let runs = 0;
    const actions = new ActionRegistry(() => layer, assert.fail);
    actions.register(entry("global", { binding: { key: "p" }, run: () => runs++ }));
    const removeDuplicate = actions.register(entry("duplicate", { binding: { key: "P" } }));
    const resolve = (event = key(), editable = false) => resolveShortcut(actions, event, layer, false, editable);
    assert.equal(resolve(), undefined);
    removeDuplicate();
    assert.equal(resolve(), "test.global");
    assert.equal(resolve(key(), true), undefined);
    const removeLocal = actions.register(entry("editor", { binding: { key: "p", context: "editor", editable: true } }));
    layer = editorContext;
    assert.equal(resolve(), "test.editor");
    assert.equal(resolve(key(), true), "test.editor");
    actions.register(entry("group", { binding: { key: "p", context: "group" }, enabled: () => false }));
    assert.equal(resolve(), "test.editor");
    const removeGroup = actions.register(entry("enabled-group", { binding: { key: "p", context: "group" } }));
    assert.equal(resolve(), undefined);
    removeGroup();
    removeLocal();
    for (const ignore of [
        { repeat: true },
        { isComposing: true },
        { keyCode: 229 },
        { defaultPrevented: true },
        { altKey: true },
    ]) {
        assert.equal(resolve(key(ignore)), undefined);
    }
    layer = { layer: "search", flags: ["search", "editor"] };
    assert.equal(resolve(), undefined);
    layer = { layer: "modal", flags: ["modal", "editor"] };
    assert.equal(resolve(), undefined);
    actions.register(entry("modal", { binding: { key: "p", context: "modal" } }));
    assert.equal(resolve(), "test.modal");
    layer = workbench;
    actions.register(entry("physical", { binding: { key: "\\", code: "Backslash" } }));
    assert.equal(resolve(key({ key: "ß", code: "Backslash" })), "test.physical");
    actions.register(entry("previous", { binding: { key: "tab", code: "Tab", shift: true } }));
    assert.equal(resolve(key({ key: "ISO_Left_Tab", code: "Tab", shiftKey: true })), "test.previous");

    const listeners = new Set();
    const target = {
        addEventListener: (name, cb) => {
            assert.equal(name, "keydown");
            listeners.add(cb);
        },
        removeEventListener: (_name, cb) => listeners.delete(cb),
    };
    const unbind = bindShortcuts(actions, target, false, () => false);
    assert.equal(listeners.size, 1);
    const event = key();
    for (const listener of listeners) listener(event);
    await pause();
    assert.equal(event.defaultPrevented, true);
    assert.equal(runs, 1);
    unbind();
    assert.equal(listeners.size, 0);
});

const provider = (id, query, opts = {}) => ({
    id: "test." + id,
    owner: "test",
    label: id,
    limit: 1,
    timeoutMS: 2000,
    query,
    ...opts,
});
const result = (id) => ({ id, title: id });

test("search publishes progressive bounded groups in stable order and isolates failures and timeouts", async () => {
    const searches = new SearchRegistry();
    let slow;
    let observedTimeout = false;
    searches.register(
        provider(
            "slow",
            () =>
                new Promise((resolve) => {
                    slow = resolve;
                })
        )
    );
    searches.register(
        provider("fail", async () => {
            throw new Error("private");
        })
    );
    searches.register(provider("fast", () => [result("one"), result("two")]));
    const publications = [];
    let settled;
    const complete = new Promise((resolve) => {
        settled = resolve;
    });
    searches.register(
        provider(
            "timeout",
            (_q, _limit, signal) =>
                new Promise(() => {
                    signal.addEventListener(
                        "abort",
                        () => {
                            observedTimeout = true;
                        },
                        { once: true }
                    );
                }),
            { timeoutMS: 20 }
        )
    );
    const session = searches.session((groups) => {
        publications.push(groups);
        if (groups.every((group) => !group.pending)) settled();
    });
    const providers = ["slow", "fail", "fast", "timeout"].map((id) => searches.lookup("test." + id));
    assert.throws(() => searches.register(providers[0]), /Duplicate search provider ID/);
    session.query("q", providers);
    await pause();
    const partial = publications.at(-1);
    assert.deepEqual(
        partial.map(({ provider }) => provider.id),
        ["test.fail", "test.fast", "test.slow", "test.timeout"]
    );
    assert.equal(partial[0].error, "failed");
    assert.deepEqual(
        partial[1].results.map(({ id }) => id),
        ["one"]
    );
    assert.equal(partial[2].pending, true);
    slow([result("late")]);
    await complete;
    assert.equal(publications.at(-1)[3].error, "timeout");
    assert.equal(observedTimeout, true);
    session.cancel();
});

test("superseding a query rejects late responses and owner cleanup stops running providers", async () => {
    const searches = new SearchRegistry();
    const pending = new Map();
    const batches = [];
    const def = provider(
        "stale",
        (query, _limit, signal) =>
            new Promise((resolve) => {
                pending.set(query, { signal, resolve });
            })
    );
    searches.register(def);
    const registered = searches.lookup(def.id);
    const session = searches.session((groups) => batches.push(groups));
    session.query("old", [registered]);
    session.query("new", [registered]);
    assert.equal(pending.get("old").signal.aborted, true);
    pending.get("new").resolve([result("new")]);
    await pause();
    const latest = batches.at(-1);
    pending.get("old").resolve([result("old")]);
    await pause();
    assert.equal(batches.at(-1), latest);
    assert.equal(latest[0].results[0].id, "new");
    session.query("remove", [registered]);
    searches.removeOwner("test");
    assert.equal(pending.get("remove").signal.aborted, true);
    assert.equal(searches.lookup(def.id), undefined);
    await pause();
    assert.equal(batches.at(-1)[0].pending, false);
});

test("registered editor commands use the dirty-close lifecycle and reopen history", async (t) => {
    const registry = new EditorRegistry();
    const choice = { id: "sample", editorTypeId: "test.sample", title: "Sample" };
    let decision = "cancel";
    let markDirty;
    registry.register({
        id: choice.editorTypeId,
        ownerId: "test",
        title: "Sample",
        kind: "singleton",
        load: async () => null,
        createSession: (_tab, change) => {
            markDirty = change;
            return { discard: () => true };
        },
    });
    const original = globalThis.document;
    globalThis.document = { getElementById: () => undefined };
    t.after(() => {
        globalThis.document = original;
    });
    const manager = new EditorManager(registry, undefined, { confirm: () => Promise.resolve(decision) });
    const actions = new ActionRegistry(() => editorContext, assert.fail);
    const dispose = registerEditorActions(actions, manager, () => manager.state, [choice]);
    assert.equal(actions.lookup(actionIDs.previousTab).binding.code, "Tab");
    await actions.invoke({ id: editorOpenAction(choice.id) });
    const id = manager.focusedGroup.activeId;
    manager.context(id);
    markDirty(true);
    await actions.invoke({ id: actionIDs.closeTab });
    assert.equal(manager.focusedGroup.activeId, id);
    assert.equal(manager.focusedGroup.tabs[0].dirty, true);
    decision = "discard";
    await actions.invoke({ id: actionIDs.closeTab });
    assert.equal(manager.focusedGroup.activeId, null);
    await actions.invoke({ id: actionIDs.reopenTab });
    assert.equal(manager.focusedGroup.tabs[0].title, "Sample");
    dispose();
    assert.equal(actions.lookup(actionIDs.closeTab), undefined);
});

test("native catalog invalidation discards a stale snapshot and disposes projections and inflight loads", async () => {
    let invalidate;
    let released = false;
    const reads = [];
    const projected = new Set();
    const disconnect = connectCatalog(
        (signal) => new Promise((resolve) => reads.push({ signal, resolve })),
        (callback) => {
            invalidate = callback;
            return () => {
                released = true;
            };
        },
        ({ id }) => {
            projected.add(id);
            return () => projected.delete(id);
        },
        assert.fail
    );
    invalidate();
    invalidate();
    reads[0].resolve([{ id: "old" }]);
    await pause();
    assert.equal(reads.length, 2);
    assert.equal(projected.size, 0);
    reads[1].resolve([{ id: "new" }]);
    await pause();
    assert.deepEqual([...projected], ["new"]);
    invalidate();
    reads[2].resolve([]);
    await pause();
    assert.equal(projected.size, 0);
    invalidate();
    disconnect();
    assert.equal(reads[3].signal.aborted, true);
    assert.equal(released, true);
    reads[3].resolve([{ id: "late" }]);
    await pause();
    assert.equal(projected.size, 0);
});
