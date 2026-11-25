import { settingsEditorType, settingsOwner } from "../modules/settings/identity.ts";
import {
    editorWorkspace,
    emptyGroup,
    mainGroupId,
    newEditorId,
    pinnedFirst,
    splitMinSize,
    type EditorGroup,
    type EditorTab,
    type EditorWorkspace,
} from "./model.ts";
import type { EditorRegistry } from "./registry.ts";

const validId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
const validSize = (size: unknown): size is number =>
    typeof size === "number" && size >= splitMinSize && size <= 100 - splitMinSize;

export function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function restoreEditorWorkspace(value: unknown, registry: EditorRegistry): EditorWorkspace | undefined {
    const input = asRecord(value);
    if (!Array.isArray(input.groups) || !input.groups.length) return;

    const groups: EditorGroup[] = [];
    const tabIds = new Set<string>();
    const singletons = new Set<string>();
    for (const row of input.groups) {
        const group = asRecord(row);
        if (!validId(group.id) || groups.some((item) => item.id === group.id) || !Array.isArray(group.tabs)) continue;

        const groupId = group.id;
        const tabs: EditorTab[] = [];
        let hasPreview = false;
        for (const raw of group.tabs) {
            const { id, resource, pinned, preview } = asRecord(raw);
            let { ownerId, editorTypeId } = asRecord(raw);
            if (ownerId === "milo.workbench" && editorTypeId === "milo.workbench.appearance") {
                ownerId = settingsOwner;
                editorTypeId = settingsEditorType;
            }
            if (!validId(id) || tabIds.has(id) || typeof editorTypeId !== "string") continue;
            if (resource !== undefined && typeof resource !== "string") continue;
            const resolved = registry.resolve({ editorTypeId, resource }, true);
            if (!resolved || resolved.registration.ownerId !== ownerId) continue;
            if (singletons.has(editorTypeId)) continue;

            const isPreview: boolean =
                preview === true && pinned !== true && !hasPreview && resolved.registration.preview !== false;
            tabs.push({
                ...resolved.metadata,
                id,
                editorTypeId,
                ownerId: resolved.registration.ownerId,
                resource,
                groupId,
                pinned: pinned === true,
                preview: isPreview,
                dirty: false,
            });
            tabIds.add(id);
            if (resolved.registration.kind === "singleton") singletons.add(editorTypeId);
            hasPreview ||= isPreview;
        }

        const ordered = pinnedFirst(tabs);
        const activeId = ordered.find((tab) => tab.id === group.activeId)?.id ?? ordered[0]?.id ?? null;
        groups.push({ id: groupId, tabs: ordered, activeId });
        if (groups.length === 2) break;
    }

    if (!groups.length) return;
    return {
        groups,
        focusedGroupId: groups.find((group) => group.id === input.focusedGroupId)?.id ?? groups[0].id,
        leftSize: validSize(input.leftSize) ? input.leftSize : 50,
    };
}

export function serializeEditorWorkspace(workspace: EditorWorkspace, registry: EditorRegistry) {
    return {
        focusedGroupId: workspace.focusedGroupId,
        leftSize: workspace.leftSize,
        groups: workspace.groups.map(({ id, activeId, tabs }) => ({
            id,
            activeId,
            tabs: tabs.flatMap(({ id, ownerId, editorTypeId, resource, pinned, preview }) => {
                const editor = registry.resolve({ editorTypeId, resource }, true);
                return editor?.registration.ownerId === ownerId
                    ? [{ id, ownerId, editorTypeId, resource, pinned, preview }]
                    : [];
            }),
        })),
    };
}

export function migrateEditorWorkspace(
    value: unknown,
    inputs: ReadonlyMap<string, { editorTypeId: string; resource?: string }>,
    registry: EditorRegistry
): EditorWorkspace | undefined {
    const { tabs, activeId } = asRecord(value);
    if (!Array.isArray(tabs)) return;
    const seen = new Map<string, string>();
    const migrated = tabs.flatMap((raw) => {
        const { id, pinned } = asRecord(raw);
        if (typeof id !== "string" || seen.has(id)) return [];
        const input = inputs.get(id);
        if (!input) return [];
        const editor = registry.resolve(input, true);
        if (!editor) return [];
        const instanceId = newEditorId();
        seen.set(id, instanceId);
        return [{ ...input, id: instanceId, pinned, ownerId: editor.registration.ownerId }];
    });
    const group = {
        ...emptyGroup(),
        activeId: typeof activeId === "string" ? seen.get(activeId) : null,
        tabs: migrated,
    };
    return restoreEditorWorkspace({ ...editorWorkspace(), focusedGroupId: mainGroupId, groups: [group] }, registry);
}
