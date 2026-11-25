import assert from "node:assert/strict";
import test from "node:test";
import { get } from "svelte/store";
import { MenuRegistry } from "../src/lib/menu.ts";
import { copyText, filterLogs } from "../src/lib/modules/logger/records.ts";
import { applyNotificationChange } from "../src/lib/modules/notify/inbox.ts";
import { applySettings, filterSettings } from "../src/lib/modules/settings/entries.ts";
import { aggregateProgress, applyTaskChange } from "../src/lib/modules/task/tasks.ts";
import { registerWorkbenchMenu } from "../src/lib/workbench-menu.ts";

test("settings search matches labels, categories and identifiers, and reset replaces an override", () => {
    const schema = {
        id: "settings.appearance.theme",
        label: "theme",
        category: "appearance",
        description: "description",
    };
    const earlier = { revision: 1, entries: [{ schema, value: { text: "dark" }, overridden: true }] };
    const current = applySettings(earlier, {
        revision: 2,
        upsert: [{ schema, value: { text: "system" }, overridden: false }],
    });
    assert.equal(filterSettings(current.entries, "appearance theme", (key) => key)[0].value.text, "system");
    assert.equal(current.entries[0].overridden, false);
    assert.equal(filterSettings(current.entries, "appearance notifications", (key) => key).length, 0);
});

test("Output filtering and copying are limited to visible records", () => {
    const base = { time: "2026-01-01T00:00:00Z", owner: "core", message: "started" };
    const records = [
        { ...base, id: 1, level: "debug" },
        { ...base, id: 2, level: "warn", fields: { state: "retry" } },
        { ...base, id: 3, level: "error", fields: { state: "retry" } },
        { ...base, id: 4, owner: "other", level: "error", fields: { state: "retry" } },
    ];
    const visible = filterLogs(records, "warn", "core", "RETRY");
    assert.deepEqual(
        visible.map(({ id }) => id),
        [2, 3]
    );
    assert.match(copyText(visible, new Set([3, 4])), /ERROR core/);
    assert.doesNotMatch(copyText(visible, new Set([3, 4])), /WARN|other/);
    assert.match(copyText(visible, new Set([4])), /WARN/);
});

test("notification updates keep one row per ID and reflect read, dismissal and clearing", () => {
    let inbox = { revision: 1, items: [{ id: "old", read: false }] };
    inbox = applyNotificationChange(inbox, { revision: 2, added: { id: "new", read: false }, removed: "old" });
    inbox = applyNotificationChange(inbox, { revision: 3, added: { id: "new", read: false } });
    inbox = applyNotificationChange(inbox, { revision: 4, read: "new" });
    assert.deepEqual(inbox.items, [{ id: "new", read: true }]);
    inbox = applyNotificationChange(inbox, { revision: 5, cleared: true });
    assert.deepEqual(inbox.items, []);
});

test("Task progress is indeterminate when any operation is indeterminate and a terminal delta moves one run", () => {
    const task = { run: 1, id: "one.task", status: "running", progress: 0 };
    let snapshot = { revision: 1, active: [task], completed: [{ run: 0, id: task.id, status: "succeeded" }] };
    assert.equal(aggregateProgress(snapshot.active), 0);
    const second = { run: 2, id: "two.task", status: "running" };
    snapshot = applyTaskChange(snapshot, { revision: 2, task: second });
    assert.equal(aggregateProgress(snapshot.active), undefined);
    snapshot = applyTaskChange(snapshot, { revision: 3, task: { ...second, progress: 0.5 } });
    assert.equal(aggregateProgress(snapshot.active), 0.25);
    snapshot = applyTaskChange(snapshot, { revision: 4, task: { ...task, status: "cancelled" }, evicted: 0 });
    assert.deepEqual(
        snapshot.active.map(({ run }) => run),
        [2]
    );
    assert.deepEqual(
        snapshot.completed.map(({ run, status }) => [run, status]),
        [[1, "cancelled"]]
    );
});

test("system menu placements carry the module action IDs and dispose together", () => {
    const menu = new MenuRegistry();
    const dispose = registerWorkbenchMenu(
        menu,
        () => true,
        () => false
    );
    const items = get(menu).get("milo.workbench.view.system");
    assert.deepEqual(
        items.map(({ action, owner }) => [action, owner]),
        [
            ["milo.logger.open", "milo.logger"],
            ["milo.task.open", "milo.task"],
            ["milo.notify.open", "milo.notify"],
        ]
    );
    dispose();
    assert.equal(get(menu).get("milo.workbench.view.system"), undefined);
});
