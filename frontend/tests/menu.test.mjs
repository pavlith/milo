import assert from "node:assert/strict";
import { test } from "node:test";
import { get } from "svelte/store";
import { MenuRegistry } from "../src/lib/menu.ts";

const file = { kind: "section", id: "milo.file", owner: "milo", label: "File", order: 10 };
const mail = { kind: "section", id: "example.mail.menu", owner: "example.mail", label: "Mail", order: 20 };

const tools = {
    kind: "group",
    parent: file.id,
    id: "example.tools.group",
    owner: "example.tools",
    label: "Tools",
    order: 20,
};

test("sections and groups accept ordered contributions from independent owners", () => {
    const menu = new MenuRegistry();
    menu.register(mail);
    menu.register(file);
    menu.register(tools);
    menu.register({ kind: "separator", id: "milo.separator", owner: "milo", parent: file.id, order: 10 });
    const submenu = { kind: "submenu", parent: tools.id, id: "example.tools.more", owner: tools.owner, label: "More" };
    menu.register(submenu);
    const item = {
        kind: "item",
        parent: submenu.id,
        id: "example.mail.compose",
        owner: mail.owner,
        label: "Compose",
        action: "example.mail.compose",
        shortcut: "Ctrl+N",
    };
    menu.register(item);
    const entries = get(menu);
    assert.deepEqual(entries.get(undefined), [file, mail]);
    assert.deepEqual(
        entries.get(file.id).map(({ kind }) => kind),
        ["separator", "group"]
    );
    assert.deepEqual(entries.get(tools.id), [submenu]);
    assert.deepEqual(entries.get(submenu.id), [item]);
    assert.throws(() => menu.register(item), /Duplicate menu ID/);
    assert.throws(() => menu.register({ ...item, id: "milo.invalid" }), /namespaced/);
    assert.throws(() => menu.register({ ...item, id: "example.mail.invalid", parent: item.id }), /Invalid menu parent/);
});

test("owner cleanup excludes other owners and disposers cannot remove new registrations", () => {
    const menu = new MenuRegistry();
    const disposeFile = menu.register(file);
    menu.register(tools);
    menu.register(mail);
    disposeFile();
    assert.deepEqual(get(menu).get(undefined), [mail]);
    assert.throws(() => menu.register({ ...file, kind: "submenu", parent: tools.id }), /Invalid menu parent/);
    menu.register(file);
    disposeFile();
    assert.deepEqual(get(menu).get(undefined), [file, mail]);
    menu.removeOwner(tools.owner);
    assert.equal(get(menu).get(file.id), undefined);
    menu.unregister(mail.id);
    assert.deepEqual(get(menu).get(undefined), [file]);
});

test("dispatch resolves the action by ID and owner and rechecks item and parent availability", () => {
    const menu = new MenuRegistry();
    let visible = true;
    let enabled = true;
    menu.register({ ...file, enabled: () => enabled });
    const dispose = menu.register({
        kind: "item",
        parent: file.id,
        id: "example.tools.run",
        owner: tools.owner,
        label: "Run",
        action: "example.tools.perform",
        visible: () => visible,
    });
    const [item] = get(menu).get(file.id);
    let calls = 0;
    const resolve = (id, owner) => (id === item.action && owner === tools.owner ? () => calls++ : undefined);

    menu.invoke(item, resolve);
    assert.equal(calls, 1);
    menu.invoke(item, () => undefined);
    visible = false;
    menu.invoke(item, resolve);
    visible = true;
    enabled = false;
    menu.invoke(item, resolve);
    enabled = true;
    menu.unregister(file.id);
    menu.invoke(item, resolve);
    menu.register(file);
    dispose();
    menu.invoke(item, resolve);
    assert.equal(calls, 1);
});
