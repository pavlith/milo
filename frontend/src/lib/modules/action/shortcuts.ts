import { editableControl } from "./context.ts";
import type { ActionContext, ActionRegistry, Binding } from "./registry.ts";

const isMac = () => /Macintosh|Mac OS/.test(navigator.userAgent);

export function formatShortcut({ key, shift }: Binding, mac = isMac()): string {
    const label = key.toLowerCase() === "tab" ? "Tab" : key.toUpperCase();
    return mac ? `⌘${shift ? "⇧" : ""}${label}` : `Ctrl+${shift ? "Shift+" : ""}${label}`;
}

export function resolveShortcut(
    actions: ActionRegistry,
    event: KeyboardEvent,
    context: ActionContext,
    mac: boolean,
    editable: boolean
) {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.repeat || event.altKey) return;
    if (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return;

    let best: string | undefined;
    let score = -1;
    for (const { id, binding } of actions.list()) {
        if (!binding || event.shiftKey !== !!binding.shift || (editable && !binding.editable)) continue;
        if (context.layer !== "workbench" && binding.context !== context.layer) continue;
        if (binding.context && !context.flags.includes(binding.context)) continue;
        const key = event.key.toLowerCase() === binding.key.toLowerCase();
        if (!key && (!binding.code || event.code !== binding.code)) continue;
        if (actions.status({ id }, "", context) !== "enabled") continue;
        // Context-specific bindings take precedence. A logical key beats its physical fallback.
        const rank = (binding.context && binding.context !== "workbench" ? 2 : 0) + Number(key);
        if (rank > score) {
            best = id;
            score = rank;
        } else if (rank === score) {
            best = undefined;
        }
    }
    return best;
}

export function bindShortcuts(
    actions: ActionRegistry,
    target: Pick<Window, "addEventListener" | "removeEventListener"> = window,
    mac = isMac(),
    isEditable = editableControl
) {
    const onKeydown = (event: KeyboardEvent) => {
        const context = actions.context();
        const editable = isEditable(event.composedPath()[0] ?? event.target);
        const flags = editable
            ? [...context.flags.filter((flag) => flag !== "editable"), "editable" as const]
            : context.flags;
        const id = resolveShortcut(actions, event, { ...context, flags }, mac, editable);
        if (!id) return;
        event.preventDefault();
        void actions.invoke({ id });
    };
    target.addEventListener("keydown", onKeydown);
    return () => target.removeEventListener("keydown", onKeydown);
}
