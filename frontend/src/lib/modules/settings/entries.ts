import type { Change, Setting, Snapshot } from "../../../../bindings/milo.local/platform/modules/settings/models";

export function applySettings(snapshot: Snapshot, change: Change): Snapshot {
    const entries = new Map(snapshot.entries?.map((entry) => [entry.schema.id, entry]));
    for (const id of change.removed ?? []) entries.delete(id);
    for (const entry of change.upsert ?? []) entries.set(entry.schema.id, entry);
    return {
        revision: change.revision,
        entries: [...entries.values()].sort((a, b) => a.schema.id.localeCompare(b.schema.id)),
    };
}

export function filterSettings(entries: readonly Setting[], query: string, translate: (key: string) => string) {
    const words = query.toLowerCase().trim().split(/\s+/);
    return entries.filter(({ schema }) => {
        const text = [
            schema.id,
            translate("settings.category." + schema.category),
            translate(schema.label),
            translate(schema.description ?? ""),
            ...(schema.options ?? []).map((option) => translate("settings.option." + option)),
        ]
            .join(" ")
            .toLowerCase();
        return words.every((word) => text.includes(word));
    });
}
