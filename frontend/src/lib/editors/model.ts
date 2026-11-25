import type { LucideProps } from "@lucide/svelte";
import type { Component } from "svelte";

export type ResourceRef = string;

export interface EditorMetadata {
    title: string;
    icon?: Component<LucideProps>;
}

export interface EditorTab extends EditorMetadata {
    id: string;
    ownerId: string;
    editorTypeId: string;
    resource?: ResourceRef;
    groupId: string;
    pinned: boolean;
    preview: boolean;
    dirty: boolean;
}

export interface EditorGroup {
    id: string;
    tabs: readonly EditorTab[];
    activeId: string | null;
}

export interface EditorWorkspace {
    groups: readonly EditorGroup[];
    focusedGroupId: string;
}

export interface EditorInput {
    editorTypeId: string;
    resource?: ResourceRef;
}

export interface EditorChoice extends EditorInput, EditorMetadata {
    id: string;
    preview?: boolean;
}

export interface OpenEditorOptions {
    groupId?: string;
    newInstance?: boolean;
    preview?: boolean;
}

export type CloseMode = "self" | "others" | "right" | "all";
export type Direction = -1 | 1;

export const mainGroupId = "main";
export const splitMinSize = 25;

export function emptyGroup(id = mainGroupId): EditorGroup {
    return { id, tabs: [], activeId: null };
}

export function editorWorkspace(): EditorWorkspace {
    return { groups: [emptyGroup()], focusedGroupId: mainGroupId };
}

export function activeTab(group: EditorGroup | undefined): EditorTab | undefined {
    return group?.tabs.find((tab) => tab.id === group.activeId);
}

export function pinnedFirst(tabs: readonly EditorTab[]): EditorTab[] {
    return [...tabs].sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

export function removeTabs(group: EditorGroup, removed: ReadonlySet<string>): EditorGroup {
    const tabs = group.tabs.filter((tab) => !removed.has(tab.id));
    if (tabs.length === group.tabs.length) return group;
    if (!group.activeId || !removed.has(group.activeId)) return { ...group, tabs };

    const activeIndex = group.tabs.findIndex((tab) => tab.id === group.activeId);
    const previous = group.tabs.slice(0, activeIndex).findLast((tab) => !removed.has(tab.id));
    return { ...group, tabs, activeId: previous?.id ?? tabs[0]?.id ?? null };
}

export function newEditorId(): string {
    return Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) => value.toString(16).padStart(8, "0")).join(
        ""
    );
}
