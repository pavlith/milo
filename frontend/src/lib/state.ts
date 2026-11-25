import { EditorManager } from "./editors/manager.ts";
import { splitMinSize, type EditorInput, type EditorWorkspace } from "./editors/model.ts";
import {
    asRecord,
    migrateEditorWorkspace,
    restoreEditorWorkspace,
    serializeEditorWorkspace,
} from "./editors/persistence.ts";
import type { EditorRegistry } from "./editors/registry.ts";

export const workbenchStorageKey = "milo.workbench";

export const resizableRegions = ["primary", "secondary", "panel"] as const;
export type ResizableRegion = (typeof resizableRegions)[number];

export const paneDefaults = {
    primary: { open: true, size: 20, min: 12, max: 36 },
    secondary: { open: false, size: 22, min: 12, max: 36 },
    panel: { open: false, size: 26, min: 16, max: 60 },
} as const;

export type PanePreferences = Record<ResizableRegion, { open: boolean; size: number }>;

export interface WorkspaceEditors {
    registry: EditorRegistry;
    defaultEditor?: EditorInput;
    legacyEditors: ReadonlyMap<string, EditorInput>;
}

export const restoreWorkbench = (value: unknown, editors: WorkspaceEditors) => {
    const { registry, defaultEditor, legacyEditors } = editors;
    const input = asRecord(value);
    const version = input.version;
    const legacy = version === 1 || version === 2;
    const saved = legacy || version === 3 ? input : {};
    const panes = asRecord(saved.panes);
    const savedEditor = asRecord(saved.editor);
    let editor =
        version === 1
            ? migrateEditorWorkspace(savedEditor, legacyEditors, registry)
            : restoreEditorWorkspace(savedEditor, registry);
    if (!editor) {
        const manager = new EditorManager(registry);
        if (defaultEditor) manager.open(defaultEditor);
        editor = manager.state;
    }

    const restorePane = (region: ResizableRegion) => {
        const { open, size } = asRecord(panes[region]);
        const defaults = paneDefaults[region];
        return {
            open: typeof open === "boolean" ? open : defaults.open,
            size: typeof size === "number" && size >= defaults.min && size <= defaults.max ? size : defaults.size,
        };
    };

    const splitSize = legacy ? savedEditor.leftSize : saved.legacySplitSize;
    const legacySplitSize =
        typeof splitSize === "number" && splitSize >= splitMinSize && splitSize <= 100 - splitMinSize
            ? splitSize
            : undefined;
    return {
        version: 3 as const,
        editor,
        panes: {
            primary: restorePane("primary"),
            secondary: restorePane("secondary"),
            panel: restorePane("panel"),
        },
        legacySplitSize,
    };
};

export const loadWorkbench = (editors: WorkspaceEditors) => {
    try {
        return restoreWorkbench(JSON.parse(localStorage.getItem(workbenchStorageKey) ?? "null"), editors);
    } catch {
        return restoreWorkbench(null, editors);
    }
};

export const saveWorkbench = (
    workspace: EditorWorkspace,
    registry: EditorRegistry,
    legacySplitSize: number | undefined
) => {
    try {
        localStorage.setItem(
            workbenchStorageKey,
            JSON.stringify({ version: 3, editor: serializeEditorWorkspace(workspace, registry), legacySplitSize })
        );
    } catch {
        // Keep the current session usable when storage is unavailable.
    }
};
