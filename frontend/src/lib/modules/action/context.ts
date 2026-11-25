import { getContext, setContext } from "svelte";
import type { ActionRegistry, ContextFlag } from "./registry.ts";

const key = Symbol("workbench actions");

export const provideActions = (actions: ActionRegistry) => setContext(key, actions);
export const useActions = () => getContext<ActionRegistry>(key);

export function editableControl(target: EventTarget | null | undefined): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.isContentEditable ||
        !!target.closest(
            'textarea, select, [role="textbox"], input:not([type]), input:is([type="text"], [type="search"], [type="number"], [type="email"], [type="password"], [type="url"], [type="tel"])'
        )
    );
}

export function focusFlags(target: EventTarget | null): ContextFlag[] {
    return editableControl(target) ? ["editable"] : [];
}
