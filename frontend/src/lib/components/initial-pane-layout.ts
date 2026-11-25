import type { Pane } from "paneforge";
import { tick } from "svelte";

// Restore legacy preferences once through the public pane API. Keep the
// component defaults stable because PaneForge uses them in its storage key.
export function initialPaneLayout(
    group: string,
    pane: () => ReturnType<typeof Pane> | undefined,
    preference: { size: number; open: boolean }
) {
    let initialized = false;
    return () => {
        if (initialized) return;
        initialized = true;
        try {
            if (localStorage.getItem(`paneforge:${group}`) !== null) return;
        } catch {
            // The pane can still be initialized when storage is unavailable.
        }
        void tick().then(() => {
            const current = pane();
            current?.resize(preference.size);
            if (!preference.open) current?.collapse();
        });
    };
}
