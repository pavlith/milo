import type { Change, Snapshot } from "../../../../bindings/milo.local/platform/modules/notify/models";

export function applyNotificationChange(snapshot: Snapshot, change: Change): Snapshot {
    const items = change.cleared
        ? []
        : (snapshot.items ?? [])
              .filter(({ id }) => id !== change.removed && id !== change.added?.id)
              .map((item) => (change.readAll || change.read === item.id ? { ...item, read: true } : item));
    if (change.added) items.push(change.added);
    return { revision: change.revision, items };
}
