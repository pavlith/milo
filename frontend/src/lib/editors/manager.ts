import type { EditorContext, EditorFeedback, EditorOperation, EditorSession } from "./lifecycle.ts";
import {
    activeTab,
    editorWorkspace,
    emptyGroup,
    newEditorId,
    pinnedFirst,
    removeTabs,
    splitMinSize,
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

interface SessionRecord {
    session?: EditorSession;
    context: EditorContext;
    revision: number;
    operating: boolean;
}

export class EditorManager {
    private listeners = new Set<(workspace: EditorWorkspace) => void>();
    private workspace: EditorWorkspace;
    private closed: (EditorInput & { pinned: boolean })[] = [];
    private sessions = new Map<string, SessionRecord>();
    private closing = false;
    private shuttingDown = false;

    readonly registry: EditorRegistry;
    private readonly feedback?: EditorFeedback;

    constructor(registry: EditorRegistry, workspace = editorWorkspace(), feedback?: EditorFeedback) {
        this.registry = registry;
        this.workspace = workspace;
        this.feedback = feedback;
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
        if (this.closing || this.shuttingDown) return;
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
            if (!options.preview) this.promote(existing.id);
            return this.tab(existing.id);
        }

        const preview = options.preview === true && registration.preview !== false;
        const replaced = preview && group.tabs.find((tab) => tab.preview && !tab.pinned && !tab.dirty);
        const tab: EditorTab = {
            ...metadata,
            id: newEditorId(),
            ownerId: registration.ownerId,
            editorTypeId: registration.id,
            resource: input.resource,
            groupId: group.id,
            pinned: false,
            preview,
            dirty: false,
        };
        let tabs = [...group.tabs, tab];
        if (replaced) {
            tabs = group.tabs.map((item) => (item.id === replaced.id ? tab : item));
            this.disposeSession(replaced.id);
        }
        this.updateGroup({ ...group, tabs, activeId: tab.id }, group.id);
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

    splitRight(): void {
        if (this.closing || this.shuttingDown) return;
        const source = this.focusedGroup;
        const right = this.workspace.groups[1] ?? this.addRightGroup();
        if (source === right) return;
        const tab = activeTab(source);
        if (tab && this.registry.get(tab.editorTypeId)?.kind === "resource") {
            if (this.open(tab, { groupId: right.id })) return;
        }
        this.focusGroup(right.id);
    }

    focusOtherGroup(): void {
        const other = this.workspace.groups.find((group) => group.id !== this.workspace.focusedGroupId);
        if (other) this.focusGroup(other.id);
    }

    moveToOtherGroup(id: string): void {
        if (this.closing || this.shuttingDown) return;
        const source = this.findGroup(id);
        if (!source) return;
        const target = this.workspace.groups.find((group) => group !== source) ?? this.addRightGroup();
        this.moveTab(id, target.id);
    }

    moveTab(id: string, targetId: string, beforeId?: string): void {
        if (this.closing || this.shuttingDown) return;
        const source = this.findGroup(id);
        const target = this.group(targetId);
        const tab = source?.tabs.find((item) => item.id === id);
        if (!source || !target || !tab || id === beforeId) return;

        const tabs = target.tabs.filter((item) => item.id !== id);
        const before = tabs.findIndex((item) => item.id === beforeId);
        if (source === target) {
            tabs.splice(before < 0 ? tabs.length : before, 0, tab);
            this.reorder(
                targetId,
                tabs.map((item) => item.id)
            );
            this.focusTab(id);
            return;
        }

        tabs.splice(before < 0 ? tabs.length : before, 0, {
            ...tab,
            groupId: targetId,
            preview: tab.preview && !tabs.some((item) => item.preview),
        });
        const groups = this.workspace.groups.map((group) =>
            group === source ? removeTabs(group, new Set([id])) : { ...target, tabs: pinnedFirst(tabs), activeId: id }
        );
        this.update({ ...this.workspace, groups, focusedGroupId: targetId });
    }

    closeGroup(id: string): Promise<boolean> {
        const group = this.group(id);
        const other = this.workspace.groups.find((item) => item !== group);
        if (!group || !other) return Promise.resolve(false);

        // Group closing is a bulk operation. Preserve its pinned tabs in the remaining group.
        const targets = group.tabs.filter((tab) => !tab.pinned);
        return this.protectClose(targets, () => {
            const remaining = this.group(other.id)!;
            const pinned = this.group(id)!
                .tabs.filter((tab) => tab.pinned)
                .map((tab) => ({ ...tab, groupId: other.id }));
            const tabs = pinnedFirst([...remaining.tabs, ...pinned]);
            const activeId = remaining.activeId ?? tabs[0]?.id ?? null;
            this.rememberClosed(targets, group);
            for (const tab of targets) this.disposeSession(tab.id);
            this.update({ ...this.workspace, groups: [{ ...remaining, tabs, activeId }], focusedGroupId: other.id });
        });
    }

    resizeGroups(size: number): void {
        if (this.workspace.groups.length !== 2 || !Number.isFinite(size)) return;
        const leftSize = Math.min(100 - splitMinSize, Math.max(splitMinSize, size));
        if (leftSize !== this.workspace.leftSize) this.update({ ...this.workspace, leftSize });
    }

    private addRightGroup(): EditorGroup {
        const right = emptyGroup(newEditorId());
        this.update({ ...this.workspace, groups: [...this.workspace.groups, right] });
        return right;
    }

    async close(groupId: string, mode: CloseMode, id?: string): Promise<boolean> {
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

        return this.protectClose(targets, () => this.removeClosed(targets));
    }

    closeOwner(ownerId: string): Promise<boolean> {
        const tabs = this.workspace.groups.flatMap((group) => group.tabs.filter((tab) => tab.ownerId === ownerId));
        return this.protectClose(tabs, () => this.removeClosed(tabs));
    }

    requestShutdown(closeWindow: () => Promise<unknown>): Promise<boolean> {
        return this.protectClose(
            this.workspace.groups.flatMap((group) => group.tabs),
            async () => {
                this.shuttingDown = true;
                try {
                    await closeWindow();
                } catch (error) {
                    this.shuttingDown = false;
                    throw error;
                }
                for (const id of this.sessions.keys()) this.disposeSession(id);
            }
        );
    }

    promote(id: string): void {
        if (this.closing || this.shuttingDown) return;
        this.changeTab(id, (tab) => (tab.preview ? { ...tab, preview: false } : tab));
    }

    context(id: string): EditorContext {
        const existing = this.sessions.get(id);
        if (existing) return existing.context;
        const tab = this.tab(id);
        const registration = tab && this.registry.get(tab.editorTypeId);
        if (!tab || !registration || registration.ownerId !== tab.ownerId) throw new Error("Editor is unavailable");

        const record: SessionRecord = {
            revision: 0,
            operating: false,
            context: { save: () => this.operate(id, "save"), discard: () => this.operate(id, "discard") },
        };
        this.sessions.set(id, record);
        try {
            record.session = registration.createSession?.(tab, (dirty) => {
                if (this.sessions.get(id) !== record || this.shuttingDown) return;
                record.revision++;
                this.changeTab(id, (item) =>
                    item.dirty !== dirty || (dirty && item.preview)
                        ? { ...item, dirty, preview: item.preview && !dirty }
                        : item
                );
            });
            record.context.session = record.session;
            return record.context;
        } catch (error) {
            this.sessions.delete(id);
            throw error;
        }
    }

    pin(id: string, pinned: boolean): void {
        if (this.closing || this.shuttingDown) return;
        const group = this.findGroup(id);
        const tab = group?.tabs.find((item) => item.id === id);
        if (!group || !tab || tab.pinned === pinned) return;
        const tabs = group.tabs.filter((item) => item.id !== id);
        const boundary = tabs.filter((item) => item.pinned).length;
        tabs.splice(boundary, 0, { ...tab, pinned, preview: false });
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
        if (this.closing || this.shuttingDown) return;
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
        if (this.closing || this.shuttingDown || !this.closed.length) return;
        const before = this.workspace;
        while (this.closed.length) {
            const previous = this.closed.shift()!;
            const tab = this.open(previous, {
                newInstance: true,
            });
            if (!tab) continue;
            if (previous.pinned) this.pin(tab.id, true);
            if (before === this.workspace) this.update({ ...this.workspace });
            return this.tab(tab.id);
        }
        this.update({ ...this.workspace });
    }

    private async protectClose(tabs: readonly EditorTab[], finish: () => void | Promise<void>): Promise<boolean> {
        if (this.closing || this.shuttingDown || tabs.some(({ id }) => this.sessions.get(id)?.operating)) return false;

        const revisions = tabs.map(({ id }) => this.sessions.get(id)?.revision ?? 0);
        const unchanged = () =>
            tabs.every(({ id }, index) => (this.sessions.get(id)?.revision ?? 0) === revisions[index]);
        this.closing = true;
        try {
            const saves: string[] = [];
            const discards: string[] = [];
            for (const tab of tabs) {
                if (!tab.dirty) continue;
                const session = this.sessions.get(tab.id)?.session;
                const decision = await this.feedback?.confirm({ tab, canSave: !!session?.save });
                if (!decision || decision === "cancel" || !unchanged()) return false;
                if (decision === "save") saves.push(tab.id);
                else if (session?.discard) discards.push(tab.id);
            }
            for (const id of saves) {
                if (!(await this.perform(id, "save")) || !unchanged()) return false;
            }
            for (const id of discards) {
                if (!(await this.perform(id, "discard")) || !unchanged()) return false;
            }
            await finish();
            return true;
        } finally {
            this.closing = false;
        }
    }

    private async operate(id: string, operation: EditorOperation): Promise<boolean> {
        if (this.closing || this.shuttingDown) return false;
        return this.perform(id, operation);
    }

    private async perform(id: string, operation: EditorOperation): Promise<boolean> {
        const tab = this.tab(id);
        const record = this.sessions.get(id);
        const session = record?.session;
        if (!tab?.dirty || !record || !session || record.operating) return false;

        const revision = record.revision;
        record.operating = true;
        try {
            const result = await session[operation]?.();
            if (result === true && record.revision === revision) {
                this.changeTab(id, (item) => ({ ...item, dirty: false }));
                return true;
            }
        } catch {
            // A provider failure leaves the editor open with its draft.
        } finally {
            record.operating = false;
        }
        this.feedback?.failed(tab, operation);
        return false;
    }

    private removeClosed(tabs: readonly EditorTab[]): void {
        const removed = new Set(tabs.map((tab) => tab.id));
        const groups = this.workspace.groups.map((group) => {
            const targets = group.tabs.filter((tab) => removed.has(tab.id));
            if (targets.length) this.rememberClosed(targets, group);
            return removeTabs(group, removed);
        });
        for (const id of removed) this.disposeSession(id);
        this.update({ ...this.workspace, groups });
    }

    private disposeSession(id: string): void {
        const record = this.sessions.get(id);
        this.sessions.delete(id);
        try {
            record?.session?.dispose?.();
        } catch (error) {
            console.error("Could not dispose editor session", error);
        }
    }

    private tab(id: string): EditorTab | undefined {
        return this.findGroup(id)?.tabs.find((tab) => tab.id === id);
    }

    private changeTab(id: string, change: (tab: EditorTab) => EditorTab): void {
        const group = this.findGroup(id);
        const tab = group?.tabs.find((item) => item.id === id);
        if (!group || !tab) return;

        const updated = change(tab);
        if (updated !== tab)
            this.updateGroup({ ...group, tabs: group.tabs.map((item) => (item === tab ? updated : item)) });
    }

    private rememberClosed(tabs: readonly EditorTab[], group: EditorGroup): void {
        const recent = [...tabs].reverse();
        const active = activeTab(group);
        if (active && recent.includes(active)) recent.unshift(...recent.splice(recent.indexOf(active), 1));
        const entries = recent.map(({ editorTypeId, resource, pinned }) => ({ editorTypeId, resource, pinned }));
        this.closed = [...entries, ...this.closed].slice(0, historyLimit);
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
