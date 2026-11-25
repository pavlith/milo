import type { EditorChoice } from "$lib/editors/model";
import type { EditorRegistry } from "$lib/editors/registry";
import { Settings } from "@lucide/svelte";
import { settingsEditorType, settingsOwner } from "./identity.ts";

export const settingsEditor: EditorChoice = {
    id: "settings",
    editorTypeId: settingsEditorType,
    title: "tab.settings",
    icon: Settings,
};

export function registerSettingsEditor(registry: EditorRegistry) {
    return registry.register({
        ownerId: settingsOwner,
        id: settingsEditor.editorTypeId,
        title: settingsEditor.title,
        icon: settingsEditor.icon,
        kind: "singleton",
        restore: true,
        preview: false,
        load: () => import("./editor.svelte"),
    });
}
