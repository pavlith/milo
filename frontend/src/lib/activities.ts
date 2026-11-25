import { writable } from "svelte/store";
import type { EditorMetadata } from "./editors/model.ts";
import type { Reference } from "./modules/action/registry.ts";

interface NavigationItem extends EditorMetadata {
    id: string;
    action: Reference;
    isActive?: () => boolean;
}

export interface Activity extends EditorMetadata {
    id: string;
    owner: string;
    navigation: readonly NavigationItem[];
}

export function activityRegistry() {
    const entries = new Map<string, Activity>();
    const { subscribe, set } = writable<readonly Activity[]>([]);
    const publish = () => set([...entries.values()]);

    return {
        subscribe,
        register(activity: Activity) {
            const { id, owner } = activity;
            if (!owner || !id.startsWith(owner + ".") || entries.has(id)) {
                throw new Error(`Invalid or duplicate activity ID ${id}`);
            }
            entries.set(id, activity);
            publish();
            return () => {
                if (entries.get(id) !== activity) return;
                entries.delete(id);
                publish();
            };
        },
        removeOwner(owner: string) {
            for (const [id, activity] of entries) {
                if (activity.owner === owner) entries.delete(id);
            }
            publish();
        },
    };
}
