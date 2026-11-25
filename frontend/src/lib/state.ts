import { EditorManager } from "./editors/manager.ts";
import type { EditorInput, EditorWorkspace } from "./editors/model.ts";
import {
    asRecord,
    migrateEditorWorkspace,
    restoreEditorWorkspace,
    serializeEditorWorkspace,
} from "./editors/persistence.ts";
import type { EditorRegistry } from "./editors/registry.ts";

export const workbenchStorageKey = "milo.workbench";
export const modeStorageKey = "milo.state.mode";

export const resizableRegions = ["primary", "secondary", "panel"] as const;
export type ResizableRegion = (typeof resizableRegions)[number];

interface PanePreference {
    open: boolean;
    size: number;
}

export type PanePreferences = Record<ResizableRegion, PanePreference>;

export const paneLimits = {
    primary: { min: 12, max: 36 },
    secondary: { min: 12, max: 36 },
    panel: { min: 16, max: 60 },
} satisfies Record<ResizableRegion, { min: number; max: number }>;

const defaults = {
    primary: { open: true, size: 20 },
    secondary: { open: false, size: 22 },
    panel: { open: false, size: 26 },
} satisfies PanePreferences;

export interface WorkbenchState {
    version: 2;
    panes: PanePreferences;
    editor: EditorWorkspace;
}

export interface WorkspaceEditors {
    registry: EditorRegistry;
    defaultEditor?: EditorInput;
    legacyEditors: ReadonlyMap<string, EditorInput>;
}

const restorePane = (value: unknown, region: ResizableRegion): PanePreference => {
    const { open, size } = asRecord(value);
    const { min, max } = paneLimits[region];
    return {
        open: typeof open === "boolean" ? open : defaults[region].open,
        size: typeof size === "number" && size >= min && size <= max ? size : defaults[region].size,
    };
};

export const restoreWorkbench = (value: unknown, editors: WorkspaceEditors): WorkbenchState => {
    const { registry, defaultEditor, legacyEditors } = editors;
    const input = asRecord(value);
    const saved = input.version === 1 || input.version === 2 ? input : {};
    const panes = asRecord(saved.panes);
    let editor =
        saved.version === 1
            ? migrateEditorWorkspace(saved.editor, legacyEditors, registry)
            : restoreEditorWorkspace(saved.editor, registry);
    if (!editor) {
        const manager = new EditorManager(registry);
        if (defaultEditor) manager.open(defaultEditor);
        editor = manager.state;
    }
    return {
        version: 2,
        panes: {
            primary: restorePane(panes.primary, "primary"),
            secondary: restorePane(panes.secondary, "secondary"),
            panel: restorePane(panes.panel, "panel"),
        },
        editor,
    };
};

export const loadWorkbench = (editors: WorkspaceEditors): WorkbenchState => {
    try {
        return restoreWorkbench(JSON.parse(localStorage.getItem(workbenchStorageKey) ?? "null"), editors);
    } catch {
        return restoreWorkbench(null, editors);
    }
};

export const saveWorkbench = (panes: PanePreferences, workspace: EditorWorkspace, registry: EditorRegistry) => {
    try {
        localStorage.setItem(
            workbenchStorageKey,
            JSON.stringify({ version: 2, panes, editor: serializeEditorWorkspace(workspace, registry) })
        );
    } catch {
        // Keep the current session usable when storage is unavailable.
    }
};

const visibleSize = (pane: PanePreference) => (pane.open ? pane.size : 0);

export const columns = (panes: PanePreferences) => {
    const primary = visibleSize(panes.primary);
    const secondary = visibleSize(panes.secondary);
    return [primary, 100 - primary - secondary, secondary];
};

export const rows = (panes: PanePreferences) => {
    const panel = visibleSize(panes.panel);
    return [100 - panel, panel];
};

export const togglePane = (panes: PanePreferences, region: ResizableRegion): PanePreferences => ({
    ...panes,
    [region]: { ...panes[region], open: !panes[region].open },
});

export const resizePane = (panes: PanePreferences, region: ResizableRegion, size: number): PanePreferences => {
    if (!Number.isFinite(size)) return panes;
    const pane = panes[region];
    const { min, max } = paneLimits[region];
    const open = size > 0;
    // PaneForge can round the result of a resize by a small fraction.
    const nextSize = open ? Math.min(max, Math.max(min, size)) : pane.size;
    return open === pane.open && nextSize === pane.size ? panes : { ...panes, [region]: { open, size: nextSize } };
};
