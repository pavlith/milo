import type { EditorChoice, EditorWorkspace } from "$lib/editors/model";
import { actionIDs, editorOpenAction, workbenchOwner } from "../action/ids";
import { titleOf, type Action, type ActionRegistry, type Translate } from "../action/registry";
import { filterSettings } from "../settings/entries";
import type { SettingsState } from "../settings/state";
import { matches, type SearchRegistry } from "./registry";

export function registerBuiltinSearch(
    searches: SearchRegistry,
    actions: ActionRegistry,
    actionList: () => readonly Action[],
    choices: readonly EditorChoice[],
    workspace: () => EditorWorkspace,
    preferences: () => SettingsState,
    translate: () => Translate
) {
    const disposers = [
        searches.register({
            id: workbenchOwner + ".actions",
            owner: workbenchOwner,
            label: "workbench.search.actions",
            scope: "actions",
            limit: 16,
            timeoutMS: 250,
            query: (query, limit) => {
                const t = translate();
                if (!query) return [];
                return actionList()
                    .filter(
                        ({ id, listed }) => listed !== false && actions.status({ id }, workbenchOwner) === "enabled"
                    )
                    .map(({ id, title, description, category, icon }) => ({
                        id,
                        title: titleOf(title, t),
                        description: description && t(description),
                        icon,
                        action: { id },
                        category: category && t(category),
                    }))
                    .filter((item) => matches(query, item.title, item.description, item.category, item.id))
                    .slice(0, limit);
            },
        }),
        searches.register({
            id: workbenchOwner + ".editors",
            owner: workbenchOwner,
            label: "workbench.search.editors",
            scope: "editors",
            limit: 24,
            timeoutMS: 250,
            query: (query, limit) => {
                const t = translate();
                const { groups } = workspace();
                const open = groups.flatMap(({ tabs }, index) =>
                    tabs.map((tab) => ({
                        id: "tab." + tab.id,
                        title: t(tab.title),
                        description: t("workbench.search.openTab", index + 1),
                        icon: tab.icon,
                        resource: tab.resource,
                        action: { id: actionIDs.focusTab, args: { tab: tab.id } },
                    }))
                );
                const available = choices.map((choice) => ({
                    id: "editor." + choice.id,
                    title: t(choice.title),
                    description: t("workbench.search.openEditor"),
                    icon: choice.icon,
                    resource: choice.resource,
                    action: { id: editorOpenAction(choice.id) },
                }));
                return [...open, ...available]
                    .filter((item) => matches(query, item.title, item.description, item.resource))
                    .filter((item) => actions.status(item.action, workbenchOwner) === "enabled")
                    .slice(0, limit);
            },
        }),
        searches.register({
            id: "milo.settings.preferences",
            owner: "milo.settings",
            label: "tab.settings",
            scope: "settings",
            limit: 16,
            timeoutMS: 250,
            query: (query, limit) => {
                const state = preferences();
                if (state.status !== "ready" || !query) return [];
                const t = translate();
                return filterSettings(state.value.entries ?? [], query, t)
                    .slice(0, limit)
                    .map(({ schema }) => ({
                        id: schema.id,
                        title: t(schema.label),
                        description: t("settings.category." + schema.category),
                        resource: schema.id,
                        action: { id: actionIDs.settings, args: { category: schema.category } },
                    }));
            },
        }),
    ];
    return () => {
        for (const dispose of disposers.reverse()) dispose();
    };
}
