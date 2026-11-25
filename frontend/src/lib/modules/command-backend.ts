import { t } from "$lib/i18n";
import { ListTodo, Trash2 } from "@lucide/svelte";
import { toast } from "svelte-sonner";
import { get } from "svelte/store";
import type { Reference as WireReference } from "../../../bindings/milo.local/platform/modules/action/models";
import {
    ActionRejection,
    type ActionIcon,
    type ActionRegistry,
    type ContextFlag,
    type Reference,
} from "./action/registry";
import { connectCatalog, withSignal } from "./backend-catalog";
import type { SearchRegistry } from "./search/registry";

const icons: Readonly<Record<string, ActionIcon | undefined>> = Object.assign(Object.create(null), {
    tasks: ListTodo,
    trash: Trash2,
});
const flags: readonly ContextFlag[] = [
    "workbench",
    "editor",
    "group",
    "multiple-groups",
    "editable",
    "command",
    "search",
    "modal",
];

export function actionReference(ref: WireReference): Reference {
    // The generated index signature is optional. The dispatcher validates all
    // keys and values again before passing the data on to a handler.
    return { id: ref.id, args: ref.args ?? undefined } as Reference;
}

export function connectCommandBackend(actions: ActionRegistry, searches: SearchRegistry) {
    if (location.protocol !== "wails:") return;
    let disposed = false;
    const disconnect: (() => void)[] = [];
    const error = () => {
        console.error("Could not load the native command catalog");
        toast.error(get(t)("workbench.command.catalogError"));
    };

    void Promise.all([
        import("@wailsio/runtime"),
        import("../../../bindings/events"),
        import("../../../bindings/milo.local/platform/modules/action/workbench"),
        import("../../../bindings/milo.local/platform/modules/search/workbench"),
    ])
        .then(([{ Events }, events, actionAPI, searchAPI]) => {
            if (disposed) return;
            disconnect.push(
                connectCatalog(
                    (signal) => withSignal(signal, actionAPI.List),
                    (changed) => Events.On(events.MiloActionCatalogChanged, changed),
                    ({ binding, requires, delegates, icon, acceptsArguments, ...meta }) => {
                        const known = (flag: string): flag is ContextFlag => flags.includes(flag as ContextFlag);
                        const supported =
                            requires?.every(known) !== false && (!binding?.context || known(binding.context));
                        return actions.register({
                            ...meta,
                            icon: icon ? icons[icon] : undefined,
                            binding: binding
                                ? { ...binding, context: binding.context as ContextFlag | undefined }
                                : undefined,
                            requires: requires?.filter(known),
                            delegates: delegates ?? undefined,
                            available: () => supported,
                            validate: acceptsArguments ? () => true : undefined,
                            run: async (args, signal, context, owner) => {
                                try {
                                    await withSignal(signal, () =>
                                        actionAPI.Invoke({ id: meta.id, args }, owner, [...context.flags])
                                    );
                                } catch (error) {
                                    if (error instanceof Error && error.name === "RuntimeError") {
                                        switch (error.message) {
                                            case "action not found":
                                                throw new ActionRejection("missing");
                                            case "action unavailable":
                                                throw new ActionRejection("unavailable");
                                            case "invalid action arguments":
                                                throw new ActionRejection("arguments");
                                        }
                                    }
                                    throw error;
                                }
                            },
                        });
                    },
                    error
                )
            );
            disconnect.push(
                connectCatalog(
                    (signal) => withSignal(signal, searchAPI.List),
                    (changed) => Events.On(events.MiloSearchCatalogChanged, changed),
                    (meta) =>
                        searches.register({
                            ...meta,
                            debounceMS: 120,
                            query: async (query, limit, signal) => {
                                if (!query) return [];
                                const items = await withSignal(signal, () => searchAPI.Query(meta.id, query, limit));
                                return (items ?? []).map(({ action, icon, ...item }) => ({
                                    ...item,
                                    action: action ? actionReference(action) : undefined,
                                    icon: icon ? icons[icon] : undefined,
                                }));
                            },
                        }),
                    error
                )
            );
        })
        .catch(() => {
            if (!disposed) error();
        });

    return () => {
        disposed = true;
        for (const stop of disconnect.reverse()) stop();
    };
}
