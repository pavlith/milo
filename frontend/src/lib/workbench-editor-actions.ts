import { Columns2, MoveHorizontal, Redo2, Undo2, X } from "@lucide/svelte";
import type { WorkbenchCommand } from "./components/command.svelte";
import { focusActiveEditor } from "./components/editor-area/focus";
import type { EditorManager } from "./editors/manager";
import { activeTab, type EditorWorkspace } from "./editors/model";

export interface WorkbenchEditorAction extends WorkbenchCommand {
    enabled: () => boolean;
}

export function editorActions(
    manager: EditorManager,
    workspace: () => EditorWorkspace,
    available: () => boolean
): WorkbenchEditorAction[] {
    const group = () => workspace().groups.find(({ id }) => id === workspace().focusedGroupId)!;
    const hasTab = () => !!group().activeId;
    const hasOtherTab = () => group().tabs.length > 1;
    const hasSplit = () => workspace().groups.length > 1;
    const actions: WorkbenchEditorAction[] = [
        {
            id: "split-editor",
            label: "workbench.editor.split",
            binding: { key: "\\", code: "Backslash" },
            icon: Columns2,
            enabled: () => group() === workspace().groups[0],
            run: () => manager.splitRight(),
        },
        {
            id: "focus-other-group",
            label: "workbench.editor.focusOther",
            icon: MoveHorizontal,
            enabled: hasSplit,
            run: () => manager.focusOtherGroup(),
        },
        {
            id: "move-editor-group",
            label: "workbench.editor.moveGroup",
            icon: MoveHorizontal,
            enabled: hasTab,
            run: () => {
                const tab = activeTab(manager.focusedGroup);
                if (tab) manager.moveToOtherGroup(tab.id);
            },
        },
        {
            id: "next-tab",
            label: "workbench.editor.next",
            binding: { key: "tab" },
            icon: Redo2,
            enabled: hasOtherTab,
            run: () => manager.navigate(1),
        },
        {
            id: "previous-tab",
            label: "workbench.editor.previous",
            binding: { key: "tab", shift: true },
            icon: Undo2,
            enabled: hasOtherTab,
            run: () => manager.navigate(-1),
        },
        {
            id: "close-active-tab",
            label: "workbench.command.close",
            binding: { key: "w" },
            icon: X,
            enabled: hasTab,
            run: async () => {
                const { id, activeId } = manager.focusedGroup;
                if (activeId) await manager.close(id, "self", activeId);
            },
        },
        {
            id: "reopen-tab",
            label: "workbench.editor.reopen",
            binding: { key: "t", shift: true },
            icon: Undo2,
            enabled: () => {
                workspace();
                return manager.canReopen;
            },
            run: () => manager.reopen(),
        },
        {
            id: "close-editor-group",
            label: "workbench.editor.closeGroup",
            icon: X,
            enabled: hasSplit,
            run: async () => {
                await manager.closeGroup(manager.focusedGroup.id);
            },
        },
    ];
    return actions.map(({ run, enabled, ...action }) => ({
        ...action,
        enabled: () => available() && enabled(),
        run: async () => {
            const previous = activeTab(manager.focusedGroup)?.id;
            const previousGroup = manager.focusedGroup.id;
            await run();
            if (previous !== activeTab(manager.focusedGroup)?.id || previousGroup !== manager.focusedGroup.id) {
                void focusActiveEditor(manager);
            }
        },
    }));
}
