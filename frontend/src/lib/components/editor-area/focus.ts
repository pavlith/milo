import type { EditorManager } from "$lib/editors/manager";
import { tick } from "svelte";

export async function focusActiveEditor(manager: EditorManager): Promise<void> {
    await tick();
    const { id, activeId } = manager.focusedGroup;
    const group = document.getElementById("editor-group-" + id);
    const tab = activeId && document.getElementById("editor-tab-" + activeId);
    (tab || group)?.querySelector<HTMLElement>(tab ? "[data-editor-tab-button]" : "[data-open-tab]")?.focus();
}
