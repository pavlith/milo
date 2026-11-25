import type { Change, Level, Record, Snapshot } from "../../../../bindings/milo.local/platform/modules/logger/models";

export const levels = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof levels)[number] | "";

export function applyLogChange(snapshot: Snapshot, change: Change): Snapshot {
    const records = change.cleared ? [] : (snapshot.records ?? []).filter(({ id }) => id !== change.evicted);
    if (change.added) records.push(change.added);
    return { revision: change.revision, records };
}

const timestamp = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
});

export const logTime = (record: Record) => timestamp.format(new Date(record.time));
export const fieldsText = (record: Record) =>
    record.fields && Object.keys(record.fields).length ? JSON.stringify(record.fields) : "";

export function filterLogs(records: readonly Record[], level: LogLevel, owner: string, query: string) {
    const text = query.trim().toLowerCase();
    return records.filter(
        (record) =>
            (!level || levels.indexOf(record.level as Exclude<LogLevel, "">) >= levels.indexOf(level)) &&
            (!owner || record.owner === owner) &&
            [record.message, record.owner, fieldsText(record)].join(" ").toLowerCase().includes(text)
    );
}

export function copyText(records: readonly Record[], selected: ReadonlySet<number>) {
    const visibleSelection = records.filter(({ id }) => selected.has(id));
    return (visibleSelection.length ? visibleSelection : records)
        .map((record) =>
            [record.time, record.level.toUpperCase(), record.owner, record.message, fieldsText(record)]
                .filter(Boolean)
                .join(" ")
        )
        .join("\n");
}

export function severityClass(level: Level) {
    switch (level) {
        case "warn":
            return "text-amber-700 dark:text-amber-400";
        case "error":
            return "text-destructive";
        case "debug":
            return "text-muted-foreground";
        default:
            return "text-foreground";
    }
}
