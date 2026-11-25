import type { MenuItem, MenuRegistration, MenuRegistry } from "./menu";
import { formatShortcut } from "./shortcut";
import type { ResizableRegion } from "./state";
import type { WorkbenchEditorAction } from "./workbench-editor-actions";

const owner = "milo.workbench";
type WithoutOwner<Entry> = Entry extends MenuRegistration ? Omit<Entry, "owner"> : never;

interface WorkbenchMenuOptions {
    editorActions: readonly WorkbenchEditorAction[];
    openPalette: () => void;
    paletteShortcut: string;
    openWelcome: () => void;
    quit: () => void;
    isDesktop: () => boolean;
    toggle: (region: ResizableRegion) => void;
    isOpen: (region: ResizableRegion) => boolean;
}

export function registerWorkbenchMenu(menu: MenuRegistry, options: WorkbenchMenuOptions) {
    const actions = new Map<string, () => void>();
    const register = (entry: WithoutOwner<MenuRegistration>) => menu.register({ ...entry, owner });
    const file = owner + ".file";
    const edit = owner + ".edit";
    const view = owner + ".view";
    const help = owner + ".help";
    register({ kind: "section", id: file, label: "workbench.menu.file", order: 100 });
    register({ kind: "section", id: edit, label: "workbench.menu.edit", order: 200 });
    register({ kind: "section", id: view, label: "workbench.menu.view", order: 300 });
    register({ kind: "section", id: help, label: "workbench.menu.help", order: 400 });

    const item = (
        parent: string,
        name: string,
        label: string,
        run: () => void,
        extra: Pick<MenuItem, "visible" | "enabled" | "order" | "shortcut" | "checked"> = {}
    ) => {
        const action = owner + "." + name;
        actions.set(action, run);
        register({ kind: "item", id: parent + "." + name, parent, label, action, ...extra });
    };

    item(file, "commands", "workbench.command", options.openPalette, { shortcut: options.paletteShortcut });
    register({ kind: "separator", id: file + ".quit-separator", parent: file, visible: options.isDesktop, order: 900 });
    item(file, "quit", "workbench.menu.quit", options.quit, { visible: options.isDesktop, order: 910 });
    for (const region of ["primary", "panel", "secondary"] as const) {
        item(view, "toggle-" + region, "workbench." + region, () => options.toggle(region), {
            checked: () => options.isOpen(region),
        });
    }
    register({ kind: "separator", id: view + ".editor-separator", parent: view, order: 100 });
    for (const [index, action] of options.editorActions.entries()) {
        item(view, action.id, action.label, action.run, {
            order: 110 + index,
            enabled: action.enabled,
            shortcut: action.binding && formatShortcut(action.binding),
        });
    }
    item(help, "welcome", "tab.welcome", options.openWelcome);

    return (id: string, requester: string) => (requester === owner ? actions.get(id) : undefined);
}
