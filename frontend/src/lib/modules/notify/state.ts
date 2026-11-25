import { toast } from "svelte-sonner";
import { get } from "svelte/store";
import type { Change, Snapshot } from "../../../../bindings/milo.local/platform/modules/notify/models";
import { backendStore } from "../backend-store";
import { preference, settings, toastsID } from "../settings/state";
import { applyNotificationChange } from "./inbox";

export const notificationAPI = () => import("../../../../bindings/milo.local/platform/modules/notify/workbench");

const toasts = new Set<string>();
const toastLimit = 4;

function dismissToast(id: string) {
    if (toasts.delete(id)) toast.dismiss(id);
}

function deliver(change: Change) {
    if (change.cleared) for (const id of toasts) dismissToast(id);
    if (change.removed) dismissToast(change.removed);
    const item = change.added;
    if (!item || !(preference(get(settings), toastsID)?.value.enabled ?? true)) return;
    if (toasts.size >= toastLimit) {
        const oldest = toasts.values().next().value;
        if (oldest) dismissToast(oldest);
    }
    const forget = () => toasts.delete(item.id);
    toasts.add(item.id);
    const options = { id: item.id, description: item.description, onAutoClose: forget, onDismiss: forget };
    switch (item.severity) {
        case "success":
            toast.success(item.title, options);
            break;
        case "warning":
            toast.warning(item.title, options);
            break;
        case "error":
            toast.error(item.title, options);
            break;
        default:
            toast.info(item.title, options);
    }
}

export const notifications = backendStore<Snapshot, Change>(
    async () => {
        const [api, { Events }, { MiloNotificationChanged }] = await Promise.all([
            notificationAPI(),
            import("@wailsio/runtime"),
            import("../../../../bindings/events"),
        ]);
        return { load: api.List, listen: (receive) => Events.On(MiloNotificationChanged, ({ data }) => receive(data)) };
    },
    applyNotificationChange,
    deliver
);
