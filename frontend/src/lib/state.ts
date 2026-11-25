import { openTab, restoreTabs, type TabState } from "./tab.ts";

export const workbenchStorageKey = "slicer.workbench";
export const modeStorageKey = "slicer.state.mode";

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
    version: 1;
    panes: PanePreferences;
    editor: TabState;
}

const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const restorePane = (value: unknown, region: ResizableRegion): PanePreference => {
    const { open, size } = record(value);
    const { min, max } = paneLimits[region];
    return {
        open: typeof open === "boolean" ? open : defaults[region].open,
        size: typeof size === "number" && size >= min && size <= max ? size : defaults[region].size,
    };
};

export const restoreWorkbench = (value: unknown, viewIds: readonly string[]): WorkbenchState => {
    const input = record(value);
    const saved = input.version === 1 ? input : {};
    const panes = record(saved.panes);
    const empty: TabState = { tabs: [], activeId: null };
    return {
        version: 1,
        panes: {
            primary: restorePane(panes.primary, "primary"),
            secondary: restorePane(panes.secondary, "secondary"),
            panel: restorePane(panes.panel, "panel"),
        },
        editor: restoreTabs(saved.editor, viewIds) ?? (viewIds[0] ? openTab(empty, viewIds[0]) : empty),
    };
};

export const loadWorkbench = (viewIds: readonly string[]): WorkbenchState => {
    try {
        return restoreWorkbench(JSON.parse(localStorage.getItem(workbenchStorageKey) ?? "null"), viewIds);
    } catch {
        return restoreWorkbench(null, viewIds);
    }
};

export const saveWorkbench = (state: WorkbenchState) => {
    try {
        localStorage.setItem(workbenchStorageKey, JSON.stringify(state));
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

export const resizePane = (panes: PanePreferences, region: ResizableRegion, size: number): PanePreferences => {
    const pane = panes[region];
    const { min, max } = paneLimits[region];
    const open = size > 0;
    // PaneForge can round the result of a resize by a small fraction.
    const nextSize = open ? Math.min(max, Math.max(min, size)) : pane.size;
    return open === pane.open && nextSize === pane.size ? panes : { ...panes, [region]: { open, size: nextSize } };
};
