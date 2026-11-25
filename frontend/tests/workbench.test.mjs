import assert from "node:assert/strict";
import { test } from "node:test";
import { EditorRegistry } from "../src/lib/editors/registry.ts";
import { restoreWorkbench } from "../src/lib/state.ts";

const editors = { registry: new EditorRegistry(), legacyEditors: new Map() };

test("legacy pane preferences are validated before applying them to PaneForge", () => {
    const state = restoreWorkbench(
        {
            version: 2,
            panes: {
                primary: { open: "yes", size: 200 },
                secondary: { open: true, size: 36 },
                panel: { open: true, size: Number.NaN },
            },
            editor: { leftSize: 63 },
        },
        editors
    );
    assert.deepEqual(state.panes, {
        primary: { open: true, size: 20 },
        secondary: { open: true, size: 36 },
        panel: { open: true, size: 26 },
    });
    assert.equal(state.legacySplitSize, 63);
    assert.equal(state.editor.groups.length, 1);
});

test("a split size remains available for migration if the editor split has never mounted", () => {
    const state = restoreWorkbench({ version: 3, legacySplitSize: 63 }, editors);
    assert.equal(state.legacySplitSize, 63);
    assert.equal(restoreWorkbench({ version: 3, legacySplitSize: 5 }, editors).legacySplitSize, undefined);
});
