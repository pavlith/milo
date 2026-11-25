export interface Tab {
    id: string;
    pinned: boolean;
}

export interface TabState {
    tabs: Tab[];
    activeId: string | null;
}

export type CloseType = "self" | "others" | "right" | "all";
export type TabDirection = -1 | 1;

const pinnedFirst = (tabs: Tab[]): Tab[] => tabs.sort((a, b) => Number(b.pinned) - Number(a.pinned));

export const restoreTabs = (value: unknown, viewIds: readonly string[]): TabState | null => {
    if (!value || typeof value !== "object" || !("tabs" in value) || !Array.isArray(value.tabs)) return null;

    const tabs: Tab[] = [];
    const seen = new Set<string>();
    for (const tab of value.tabs) {
        if (!tab || typeof tab.id !== "string" || !viewIds.includes(tab.id) || seen.has(tab.id)) continue;
        tabs.push({ id: tab.id, pinned: tab.pinned === true });
        seen.add(tab.id);
    }

    pinnedFirst(tabs);
    const activeId = "activeId" in value && typeof value.activeId === "string" ? value.activeId : null;
    return { tabs, activeId: activeId && seen.has(activeId) ? activeId : (tabs[0]?.id ?? null) };
};

export const focusTab = (state: TabState, id: string): TabState =>
    state.activeId === id || !state.tabs.some((tab) => tab.id === id) ? state : { ...state, activeId: id };

export const openTab = (state: TabState, id: string): TabState =>
    state.tabs.some((tab) => tab.id === id)
        ? focusTab(state, id)
        : { tabs: [...state.tabs, { id, pinned: false }], activeId: id };

export const closeTabs = (state: TabState, id: string, type: CloseType = "self"): TabState => {
    const index = state.tabs.findIndex((tab) => tab.id === id);
    if (index === -1) return state;

    const targets = {
        self: [state.tabs[index]],
        others: state.tabs.filter((tab) => tab.id !== id),
        right: state.tabs.slice(index + 1),
        all: state.tabs,
    };
    const removed = new Set(targets[type].filter((tab) => type === "self" || !tab.pinned).map((tab) => tab.id));
    if (removed.size === 0) return state;

    const tabs = state.tabs.filter((tab) => !removed.has(tab.id));
    if (state.activeId === null || !removed.has(state.activeId)) return { tabs, activeId: state.activeId };

    const activeIndex = state.tabs.findIndex((tab) => tab.id === state.activeId);
    const previous = state.tabs.slice(0, activeIndex).findLast((tab) => !removed.has(tab.id));
    return { tabs, activeId: previous?.id ?? tabs[0]?.id ?? null };
};

export const pinTab = (state: TabState, id: string, pinned: boolean): TabState => {
    const tab = state.tabs.find((tab) => tab.id === id);
    if (!tab || tab.pinned === pinned) return state;

    const tabs = state.tabs.filter((item) => item.id !== id);
    const pinnedCount = tabs.filter((item) => item.pinned).length;
    tabs.splice(pinnedCount, 0, { ...tab, pinned });
    return { ...state, tabs };
};

export const reorderTabs = (state: TabState, ids: readonly string[]): TabState => {
    const byId = new Map(state.tabs.map((tab) => [tab.id, tab]));
    const tabs: Tab[] = [];

    for (const id of ids) {
        const tab = byId.get(id);
        if (!tab) return state;
        tabs.push(tab);
        byId.delete(id);
    }
    if (byId.size > 0) return state;

    pinnedFirst(tabs);
    return tabs.every((tab, index) => tab === state.tabs[index]) ? state : { ...state, tabs };
};

export const canMoveTab = (tabs: Tab[], id: string, direction: TabDirection): boolean => {
    const index = tabs.findIndex((tab) => tab.id === id);
    return index !== -1 && tabs[index + direction]?.pinned === tabs[index].pinned;
};

export const moveTab = (state: TabState, id: string, direction: TabDirection): TabState => {
    if (!canMoveTab(state.tabs, id, direction)) return state;

    const ids = state.tabs.map((tab) => tab.id);
    const index = ids.indexOf(id);
    ids.splice(index, 1);
    ids.splice(index + direction, 0, id);
    return reorderTabs(state, ids);
};
