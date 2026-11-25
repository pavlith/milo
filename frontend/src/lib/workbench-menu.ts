import type { MenuItem, MenuRegistration, MenuRegistry } from "./menu";
import { actionIDs, editorMenuActions, editorOpenAction, paneAction, workbenchOwner } from "./modules/action/ids.ts";
import type { ResizableRegion } from "./state";

type WithoutOwner<Entry> = Entry extends MenuRegistration ? Omit<Entry, "owner"> : never;

export function registerWorkbenchMenu(
    menu: MenuRegistry,
    isDesktop: () => boolean,
    isOpen: (region: ResizableRegion) => boolean
) {
    const owner = workbenchOwner;
    const disposers: (() => void)[] = [];
    const add = (entry: MenuRegistration) => {
        disposers.push(menu.register(entry));
    };
    const register = (entry: WithoutOwner<MenuRegistration>) => add({ ...entry, owner });
    const file = owner + ".file";
    const edit = owner + ".edit";
    const view = owner + ".view";
    const help = owner + ".help";
    const system = view + ".system";
    register({ kind: "section", id: file, label: "workbench.menu.file", order: 100 });
    register({ kind: "section", id: edit, label: "workbench.menu.edit", order: 200 });
    register({ kind: "section", id: view, label: "workbench.menu.view", order: 300 });
    register({ kind: "section", id: help, label: "workbench.menu.help", order: 400 });

    const item = (
        parent: string,
        action: string,
        extra: Partial<Pick<MenuItem, "label" | "visible" | "order" | "checked">> = {}
    ) => {
        const actionOwner = action.slice(0, action.lastIndexOf("."));
        add({
            kind: "item",
            id: action + ".menu",
            owner: actionOwner,
            parent,
            action,
            ...extra,
        });
    };
    item(file, actionIDs.commands);
    register({ kind: "separator", id: file + ".quit-separator", parent: file, visible: isDesktop, order: 900 });
    item(file, actionIDs.quit, { visible: isDesktop, order: 910 });
    item(edit, actionIDs.settings, { label: "tab.settings" });
    for (const region of ["primary", "panel", "secondary"] as const) {
        item(view, paneAction(region), { label: "workbench." + region, checked: () => isOpen(region) });
    }
    register({ kind: "separator", id: view + ".editor-separator", parent: view, order: 100 });
    for (const [index, action] of editorMenuActions.entries()) item(view, action, { order: 110 + index });
    register({ kind: "group", id: system, parent: view, order: 200 });
    for (const action of [actionIDs.output, actionIDs.tasks, actionIDs.notifications]) item(system, action);
    item(help, editorOpenAction("welcome"), { label: "tab.welcome" });
    return () => {
        for (const dispose of disposers.reverse()) dispose();
    };
}
