import { focusActiveEditor } from "./components/editor-area/focus.ts";
import type { EditorManager } from "./editors/manager";
import { activeTab, type EditorChoice, type EditorGroup, type EditorWorkspace } from "./editors/model.ts";
import { actionIDs, editorOpenAction, workbenchOwner } from "./modules/action/ids.ts";
import type { Action, ActionIcon, ActionRegistry, Arguments } from "./modules/action/registry";

export function registerEditorActions(
    actions: ActionRegistry,
    manager: EditorManager,
    workspace: () => EditorWorkspace,
    choices: readonly EditorChoice[],
    icons: Partial<Record<string, ActionIcon>> = {}
) {
    const findGroup = (args: Arguments) =>
        workspace().groups.find(({ id }) => id === (args.group ?? workspace().focusedGroupId));
    const groupArgs = (args: Arguments) => Object.keys(args).every((key) => key === "group") && !!findGroup(args);
    const findTab = (id: string) =>
        workspace()
            .groups.flatMap(({ tabs }) => tabs)
            .find((tab) => tab.id === id);
    const tabArgs = (args: Arguments) =>
        Object.keys(args).length === 0 || (Object.keys(args).length === 1 && typeof args.tab === "string");
    const split = () => workspace().groups.length > 1;
    type EditorAction = Omit<Action, "owner" | "run"> & { run: Action["run"]; focus?: boolean };
    const register = ({ focus = true, run, ...action }: EditorAction) =>
        actions.register({
            owner: workbenchOwner,
            category: "workbench.editor",
            available: ({ layer }) => layer !== "modal",
            icon: icons[action.id],
            ...action,
            run: async (args, signal, context, owner) => {
                const previous = activeTab(manager.focusedGroup)?.id;
                const previousGroup = manager.focusedGroup.id;
                const forceFocus = await run(args, signal, context, owner);
                if (
                    focus &&
                    (forceFocus === true ||
                        previous !== activeTab(manager.focusedGroup)?.id ||
                        previousGroup !== manager.focusedGroup.id)
                ) {
                    await focusActiveEditor(manager);
                }
            },
        });

    const targeted =
        (run: (group: EditorGroup) => unknown): Action["run"] =>
        (args) => {
            const target = findGroup(args);
            if (!target) return;
            return run(target);
        };
    const disposers = choices.map((choice) =>
        register({
            id: editorOpenAction(choice.id),
            title: (t) => t("workbench.command.open", t(choice.title)),
            icon: choice.icon,
            focus: false,
            validate: (args) =>
                Object.keys(args).every((key) => key === "group" || key === "preview") &&
                !!findGroup(args) &&
                (args.preview === undefined || args.preview === "true"),
            enabled: () => !!manager.registry.resolve(choice),
            run: async (args) => {
                const opened = manager.open(choice, {
                    groupId: args.group,
                    preview: args.preview === "true" && choice.preview,
                });
                if (opened && args.preview !== "true") await focusActiveEditor(manager);
            },
        })
    );
    disposers.push(
        ...(
            [
                {
                    id: actionIDs.split,
                    title: "workbench.editor.split",
                    binding: { key: "\\", code: "Backslash", context: "group", editable: true },
                    requires: ["group"],
                    validate: groupArgs,
                    enabled: (_context, args) => findGroup(args) === workspace().groups[0],
                    run: targeted((group) => {
                        manager.focusGroup(group.id);
                        manager.splitRight();
                    }),
                },
                {
                    id: actionIDs.focusOther,
                    title: "workbench.editor.focusOther",
                    requires: ["multiple-groups"],
                    validate: groupArgs,
                    run: targeted((group) => {
                        manager.focusGroup(group.id);
                        manager.focusOtherGroup();
                    }),
                },
                {
                    id: actionIDs.moveGroup,
                    title: "workbench.editor.moveGroup",
                    requires: ["editor"],
                    validate: tabArgs,
                    enabled: (_context, { tab }) => !tab || !!findTab(tab),
                    run: ({ tab }) => {
                        const id = tab ?? manager.focusedGroup.activeId;
                        if (id) manager.moveToOtherGroup(id);
                    },
                },
                ...(
                    [
                        [actionIDs.nextTab, "workbench.editor.next", false, 1],
                        [actionIDs.previousTab, "workbench.editor.previous", true, -1],
                    ] as const
                ).map(([id, title, shift, direction]): EditorAction => ({
                    id,
                    title,
                    requires: ["group"],
                    binding: { key: "tab", code: "Tab", shift, context: "group", editable: true },
                    enabled: () => (findGroup({})?.tabs.length ?? 0) > 1,
                    run: () => manager.navigate(direction),
                })),
                {
                    id: actionIDs.closeTab,
                    title: "workbench.command.close",
                    binding: { key: "w", context: "editor", editable: true },
                    requires: ["editor"],
                    validate: tabArgs,
                    enabled: (_context, { tab }) => !tab || !!findTab(tab),
                    run: async ({ tab }) => {
                        const target = tab ? findTab(tab) : activeTab(manager.focusedGroup);
                        if (target) await manager.close(target.groupId, "self", target.id);
                    },
                },
                {
                    id: actionIDs.reopenTab,
                    title: "workbench.editor.reopen",
                    binding: { key: "t", shift: true, context: "group", editable: true },
                    requires: ["group"],
                    enabled: () => {
                        workspace();
                        return manager.canReopen;
                    },
                    run: () => {
                        manager.reopen();
                    },
                },
                {
                    id: actionIDs.closeGroup,
                    title: "workbench.editor.closeGroup",
                    requires: ["multiple-groups"],
                    validate: groupArgs,
                    enabled: split,
                    run: targeted((group) => manager.closeGroup(group.id)),
                },
                {
                    id: actionIDs.focusTab,
                    title: "workbench.tab.open",
                    listed: false,
                    validate: (args) => Object.keys(args).length === 1 && typeof args.tab === "string",
                    enabled: (_context, { tab }) =>
                        workspace().groups.some(({ tabs }) => tabs.some(({ id }) => id === tab)),
                    run: ({ tab }) => {
                        manager.focusTab(tab);
                        return true;
                    },
                },
            ] satisfies EditorAction[]
        ).map(register)
    );
    return () => {
        for (const dispose of disposers.reverse()) dispose();
    };
}
