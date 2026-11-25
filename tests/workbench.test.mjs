import assert from "node:assert/strict";
import { test } from "node:test";
import { columns, resizePane, restoreWorkbench, rows } from "../src/lib/state.ts";
import { closeTabs, focusTab, moveTab, openTab, pinTab, reorderTabs } from "../src/lib/tab.ts";

const viewIds = ["welcome", "sample", "appearance"];
const openViews = () => viewIds.reduce(openTab, { tabs: [], activeId: null });
const tabIds = (state) => state.tabs.map((tab) => tab.id);

test("opening an existing tab focuses its single instance", () => {
    const state = openViews();
    const focused = openTab(state, "sample");
    assert.equal(focused.activeId, "sample");
    assert.strictEqual(focused.tabs, state.tabs);
    assert.strictEqual(focusTab(focused, "unknown"), focused);
});

test("closing an active tab selects its previous neighbor or the next at the start", () => {
    const middle = closeTabs(focusTab(openViews(), "sample"), "sample");
    assert.equal(middle.activeId, "welcome");

    const first = closeTabs(middle, "welcome");
    assert.equal(first.activeId, "appearance");
    assert.deepEqual(closeTabs(first, "appearance"), { tabs: [], activeId: null });
});

test("bulk close modes protect pinned tabs and use the current order", () => {
    const state = pinTab(openViews(), "sample", true);
    assert.deepEqual(tabIds(closeTabs(state, "welcome", "right")), ["sample", "welcome"]);
    assert.deepEqual(tabIds(closeTabs(state, "appearance", "others")), ["sample", "appearance"]);

    const all = closeTabs(state, "welcome", "all");
    assert.deepEqual(tabIds(all), ["sample"]);
    assert.equal(all.activeId, "sample");
    assert.deepEqual(tabIds(closeTabs(all, "sample")), []);
});

test("drag and keyboard moves preserve the pinned prefix and active tab", () => {
    const state = pinTab(openViews(), "sample", true);
    assert.deepEqual(tabIds(state), ["sample", "welcome", "appearance"]);
    assert.strictEqual(moveTab(state, "sample", 1), state);
    assert.deepEqual(tabIds(moveTab(state, "appearance", -1)), ["sample", "appearance", "welcome"]);

    const dragged = reorderTabs(state, ["appearance", "welcome", "sample"]);
    assert.deepEqual(tabIds(dragged), ["sample", "appearance", "welcome"]);
    assert.equal(dragged.activeId, "appearance");
    assert.strictEqual(reorderTabs(state, ["sample", "sample", "welcome"]), state);
    assert.strictEqual(reorderTabs(state, ["sample", "welcome"]), state);

    const unpinned = pinTab(dragged, "sample", false);
    assert.equal(unpinned.tabs[0].pinned, false);
    assert.deepEqual(tabIds(moveTab(unpinned, "sample", 1)), ["appearance", "sample", "welcome"]);
});

test("restore normalizes tab metadata and skips duplicates and unknown views", () => {
    const state = restoreWorkbench(
        {
            version: 1,
            editor: {
                tabs: [
                    { id: "sample", pinned: "yes" },
                    { id: "sample", pinned: true },
                    { id: "obsolete", pinned: true },
                    { id: "welcome", pinned: true, url: "discard" },
                    null,
                ],
                activeId: "obsolete",
            },
        },
        viewIds
    );
    assert.deepEqual(state.editor, {
        tabs: [
            { id: "welcome", pinned: true },
            { id: "sample", pinned: false },
        ],
        activeId: "welcome",
    });
});

test("a persisted empty editor stays empty and an unknown schema uses the default tab", () => {
    assert.deepEqual(restoreWorkbench({ version: 1, editor: { tabs: [] } }, viewIds).editor, {
        tabs: [],
        activeId: null,
    });
    assert.equal(restoreWorkbench({ version: 2, editor: { tabs: [] } }, viewIds).editor.activeId, "welcome");
    assert.equal(restoreWorkbench(null, []).editor.activeId, null);
});

test("restore validates pane sizes and keeps a usable editor area", () => {
    const state = restoreWorkbench(
        {
            version: 1,
            panes: {
                primary: { open: "yes", size: 200 },
                secondary: { open: true, size: 36 },
                panel: { open: true, size: Number.NaN },
            },
        },
        viewIds
    );
    assert.deepEqual(columns(state.panes), [20, 44, 36]);
    assert.deepEqual(rows(state.panes), [74, 26]);
});

test("collapsing remembers the last size and the versioned layout round-trips", () => {
    const state = restoreWorkbench(null, viewIds);
    const expanded = resizePane(state.panes, "panel", 43);
    assert.deepEqual(rows(expanded), [57, 43]);

    const collapsed = resizePane(expanded, "panel", 0);
    assert.deepEqual(rows(collapsed), [100, 0]);
    assert.deepEqual(collapsed.panel, { open: false, size: 43 });
    assert.deepEqual(
        restoreWorkbench(JSON.parse(JSON.stringify({ ...state, panes: collapsed })), viewIds).panes,
        collapsed
    );
});
