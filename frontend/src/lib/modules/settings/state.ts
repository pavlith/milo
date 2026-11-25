import { readable } from "svelte/store";
import type { Change, Setting, Snapshot } from "../../../../bindings/milo.local/platform/modules/settings/models";
import { connectProjection, type ProjectionState } from "../projection";

export const themeID = "settings.appearance.theme";
export const toastsID = "settings.general.notification-toasts";
export const editorStatusID = "settings.workbench.editor-status";
const legacyModeKey = "milo.state.mode";

export const settingsAPI = () => import("../../../../bindings/milo.local/platform/modules/settings/workbench");

export function applySettings(snapshot: Snapshot, change: Change): Snapshot {
    const entries = new Map(snapshot.entries?.map((entry) => [entry.schema.id, entry]));
    for (const id of change.removed ?? []) entries.delete(id);
    for (const entry of change.upsert ?? []) entries.set(entry.schema.id, entry);
    return {
        revision: change.revision,
        entries: [...entries.values()].sort((a, b) => a.schema.id.localeCompare(b.schema.id)),
    };
}

export const settings = readable<SettingsState>({ status: "loading" }, (update) => {
    if (location.protocol !== "wails:") {
        update({ status: "error", error: "settings.desktop" });
        return;
    }
    let disposed = false;
    let stop: (() => void) | undefined;
    update({ status: "loading" });
    void Promise.all([settingsAPI(), import("@wailsio/runtime"), import("../../../../bindings/events")])
        .then(async ([api, { Events }, { MiloSettingsChanged }]) => {
            if (disposed) return;
            let legacy = "";
            try {
                legacy = localStorage.getItem(legacyModeKey) ?? "";
            } catch {
                // A blocked WebKit profile has no accessible preference to migrate.
            }
            let migrationError: string | undefined;
            try {
                if (legacy) await api.MigrateTheme(legacy);
                if (legacy) localStorage.removeItem(legacyModeKey);
            } catch (error) {
                migrationError = String(error);
            }
            if (disposed) return;
            stop = connectProjection(
                api.List,
                (receive) => Events.On(MiloSettingsChanged, ({ data }) => receive(data)),
                applySettings,
                (state) => update(state.status === "ready" ? { ...state, migrationError } : state)
            );
        })
        .catch((error: unknown) => {
            if (!disposed) update({ status: "error", error: String(error) });
        });
    return () => {
        disposed = true;
        stop?.();
    };
});

export function preference(state: SettingsState, id: string): Setting | undefined {
    return state.status === "ready" ? state.value.entries?.find(({ schema }) => schema.id === id) : undefined;
}

type SettingsState = ProjectionState<Snapshot> & { migrationError?: string };

export function filterSettings(entries: readonly Setting[], query: string, translate: (key: string) => string) {
    const words = query.toLowerCase().trim().split(/\s+/);
    return entries.filter(({ schema }) => {
        const text = [
            schema.id,
            translate("settings.category." + schema.category),
            translate(schema.label),
            translate(schema.description ?? ""),
            ...(schema.options ?? []).map(translate),
        ]
            .join(" ")
            .toLowerCase();
        return words.every((word) => text.includes(word));
    });
}
