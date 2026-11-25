import {
    activeTab,
    editorWorkspace,
    newEditorId,
    pinnedFirst,
    removeTabs,
    type CloseMode,
    type Direction,
    type EditorGroup,
    type EditorInput,
    type EditorTab,
    type EditorWorkspace,
    type OpenEditorOptions,
} from "./model.ts";
import type { EditorRegistry } from "./registry.ts";

const historyLimit = 20;

export class EditorManager {
    private listeners = new Set<(workspace: EditorWorkspace) => void>();
    private workspace: EditorWorkspace;
    private closed: EditorTab[] = [];

    constructor(
        readonly registry: EditorRegistry,
        workspace = editorWorkspace()
    ) {
        this.workspace = workspace;
    }

    get state(): EditorWorkspace {
        return this.workspace;
    }

    get focusedGroup(): EditorGroup {
        return this.workspace.groups.find((group) => group.id === this.workspace.focusedGroupId)!;
    }

    get canReopen(): boolean {
        return this.closed.length > 0;
    }

    subscribe(listener: (workspace: EditorWorkspace) => void): () => void {
        this.listeners.add(listener);
        listener(this.workspace);
        return () => this.listeners.delete(listener);
    }

    open(input: EditorInput, options: OpenEditorOptions = {}): EditorTab | undefined {
        const group = this.group(options.groupId ?? this.workspace.focusedGroupId);
        const resolved = this.registry.resolve(input);
        if (!group || !resolved) return;

        const { registration, metadata } = resolved;
        const existing =
            registration.kind === "singleton"
                ? this.workspace.groups.flatMap((item) => item.tabs).find((tab) => tab.editorTypeId === registration.id)
                : options.newInstance
                  ? undefined
                  : group.tabs.find((tab) => tab.editorTypeId === registration.id && tab.resource === input.resource);
        if (existing) {
            this.focusTab(existing.id);
            return existing;
        }

        const tab: EditorTab = {
            ...metadata,
            id: newEditorId(),
            ownerId: registration.ownerId,
            editorTypeId: registration.id,
            resource: input.resource,
            groupId: group.id,
            pinned: false,
            preview: false,
            dirty: false,
        };
        this.updateGroup({ ...group, tabs: [...group.tabs, tab], activeId: tab.id }, group.id);
        return tab;
    }

    focusGroup(id: string): void {
        if (this.group(id) && this.workspace.focusedGroupId !== id)
            this.update({ ...this.workspace, focusedGroupId: id });
    }

    focusTab(id: string): void {
        const group = this.findGroup(id);
        if (!group) return;
        if (group.activeId === id) this.focusGroup(group.id);
        else this.updateGroup({ ...group, activeId: id }, group.id);
    }

    navigate(direction: Direction): void {
        const { tabs, activeId } = this.focusedGroup;
        if (tabs.length < 2) return;
        const index = tabs.findIndex((tab) => tab.id === activeId);
        this.focusTab(tabs[(index + direction + tabs.length) % tabs.length].id);
    }

    close(groupId: string, mode: CloseMode, id?: string): boolean {
        const group = this.group(groupId);
        if (!group) return false;
        const index = group.tabs.findIndex((tab) => tab.id === id);
        if (mode !== "all" && index < 0) return false;

        const targets = {
            self: group.tabs.slice(index, index + 1),
            others: group.tabs.filter((tab) => tab.id !== id),
            right: group.tabs.slice(index + 1),
            all: group.tabs,
        }[mode].filter((tab) => mode === "self" || !tab.pinned);
        if (!targets.length) return false;

        this.rememberClosed(targets, group);
        this.updateGroup(removeTabs(group, new Set(targets.map((tab) => tab.id))));
        return true;
    }

    pin(id: string, pinned: boolean): void {
        const group = this.findGroup(id);
        const tab = group?.tabs.find((item) => item.id === id);
        if (!group || !tab || tab.pinned === pinned) return;
        const tabs = group.tabs.filter((item) => item.id !== id);
        const boundary = tabs.filter((item) => item.pinned).length;
        tabs.splice(boundary, 0, { ...tab, pinned });
        this.updateGroup({ ...group, tabs });
    }

    canStepTab(group: EditorGroup, id: string, direction: Direction): boolean {
        const index = group.tabs.findIndex((tab) => tab.id === id);
        return index >= 0 && group.tabs[index + direction]?.pinned === group.tabs[index].pinned;
    }

    stepTab(id: string, direction: Direction): void {
        const group = this.findGroup(id);
        if (!group || !this.canStepTab(group, id, direction)) return;
        const order = group.tabs.map((tab) => tab.id);
        const index = order.indexOf(id);
        order.splice(index, 1);
        order.splice(index + direction, 0, id);
        this.reorder(group.id, order);
    }

    reorder(groupId: string, order: readonly string[]): void {
        const group = this.group(groupId);
        if (!group || order.length !== group.tabs.length || new Set(order).size !== order.length) return;
        const byId = new Map(group.tabs.map((tab) => [tab.id, tab]));
        const tabs: EditorTab[] = [];
        for (const id of order) {
            const tab = byId.get(id);
            if (!tab) return;
            tabs.push(tab);
        }
        const sorted = pinnedFirst(tabs);
        if (sorted.some((tab, index) => tab !== group.tabs[index])) this.updateGroup({ ...group, tabs: sorted });
    }

    reopen(): EditorTab | undefined {
        while (this.closed.length) {
            const previous = this.closed.shift()!;
            const tab = this.open(previous, {
                groupId: this.group(previous.groupId)?.id ?? this.focusedGroup.id,
                newInstance: true,
            });
            if (!tab) {
                this.update({ ...this.workspace });
                continue;
            }
            if (previous.pinned) this.pin(tab.id, true);
            return this.findGroup(tab.id)?.tabs.find((item) => item.id === tab.id);
        }
    }

    private rememberClosed(tabs: readonly EditorTab[], group: EditorGroup): void {
        const recent = [...tabs].reverse();
        const active = activeTab(group);
        if (active && recent.includes(active)) recent.unshift(...recent.splice(recent.indexOf(active), 1));
        this.closed = [...recent, ...this.closed].slice(0, historyLimit);
    }

    private group(id: string): EditorGroup | undefined {
        return this.workspace.groups.find((group) => group.id === id);
    }

    private findGroup(tabId: string): EditorGroup | undefined {
        return this.workspace.groups.find((group) => group.tabs.some((tab) => tab.id === tabId));
    }

    private updateGroup(group: EditorGroup, focusedGroupId = this.workspace.focusedGroupId): void {
        this.update({
            ...this.workspace,
            groups: this.workspace.groups.map((item) => (item.id === group.id ? group : item)),
            focusedGroupId,
        });
    }

    private update(workspace: EditorWorkspace): void {
        this.workspace = workspace;
        for (const listener of this.listeners) listener(workspace);
    }
}
