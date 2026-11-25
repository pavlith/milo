import type { MenuRegistry, ResolveMenuAction } from "$lib/menu";
import { settingsOwner } from "./settings/identity.ts";

export function registerSystemMenu(
    menu: MenuRegistry,
    open: { settings: () => void; output: () => void; tasks: () => void; notifications: () => void }
) {
    const group = "milo.workbench.view.system";
    const disposeGroup = menu.register({
        kind: "group",
        owner: "milo.workbench",
        id: group,
        parent: "milo.workbench.view",
        order: 200,
    });
    const entries = [
        { owner: settingsOwner, name: "settings", parent: "milo.workbench.edit", label: "tab.settings" },
        { owner: "milo.logger", name: "output", parent: group, label: "output.title" },
        { owner: "milo.task", name: "tasks", parent: group, label: "task.title" },
        { owner: "milo.notify", name: "notifications", parent: group, label: "notify.title" },
    ] as const;
    const actions = new Map<string, { owner: string; run: () => void }>();
    const disposeItems = entries.map(({ owner, name, parent, label }) => {
        const action = owner + ".open";
        actions.set(action, { owner, run: open[name] });
        return menu.register({ kind: "item", id: owner + ".menu", owner, parent, label, action });
    });

    const resolve: ResolveMenuAction = (id, owner) => {
        const action = actions.get(id);
        if (action?.owner === owner) return action.run;
    };
    const dispose = () => {
        for (const remove of disposeItems) remove();
        disposeGroup();
        actions.clear();
    };
    return { resolve, dispose };
}
