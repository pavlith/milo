import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorRegistry } from "../src/lib/editors/registry.ts";
import { columns, resizableRegions, resizePane, restoreWorkbench, rows, togglePane } from "../src/lib/state.ts";

const editors = { registry: new EditorRegistry(), legacyEditors: new Map() };

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
        editors
    );
    assert.deepEqual(columns(state.panes), [20, 44, 36]);
    assert.deepEqual(rows(state.panes), [74, 26]);
});

test("collapsing remembers the last size and the versioned layout round-trips", () => {
    const state = restoreWorkbench(null, editors);
    const expanded = resizePane(state.panes, "panel", 43);
    assert.deepEqual(rows(expanded), [57, 43]);

    const collapsed = resizePane(expanded, "panel", 0);
    assert.deepEqual(rows(collapsed), [100, 0]);
    assert.deepEqual(collapsed.panel, { open: false, size: 43 });
    assert.deepEqual(
        restoreWorkbench(JSON.parse(JSON.stringify({ ...state, panes: collapsed })), editors).panes,
        collapsed
    );
});

test("visibility toggles preserve each region's size across workspace restoration", () => {
    const state = restoreWorkbench(null, editors);
    for (const region of resizableRegions) {
        const expanded = resizePane(state.panes, region, 31);
        const hidden = togglePane(expanded, region);
        assert.deepEqual(hidden[region], { open: false, size: 31 });
        for (const other of resizableRegions.filter((id) => id !== region)) {
            assert.strictEqual(hidden[other], state.panes[other]);
        }
        const restored = restoreWorkbench(JSON.parse(JSON.stringify({ ...state, panes: hidden })), editors);
        assert.deepEqual(togglePane(restored.panes, region), expanded);
    }
});
