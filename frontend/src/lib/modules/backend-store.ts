import { readable } from "svelte/store";
import { connectProjection, type ProjectionState } from "./projection";

export function backendStore<T extends { revision: number }, D extends { revision: number }>(
    connect: () => Promise<{
        load: () => PromiseLike<T>;
        listen: (receive: (delta: D) => void) => () => void;
    }>,
    apply: (current: T, delta: D) => T,
    applied?: (delta: D) => void
) {
    return readable<ProjectionState<T>>({ status: "loading" }, (update) => {
        if (location.protocol !== "wails:") {
            update({ status: "error", error: "system.desktop" });
            return;
        }
        let disposed = false;
        let disconnect: (() => void) | undefined;
        update({ status: "loading" });
        void connect()
            .then(({ load, listen }) => {
                if (!disposed) disconnect = connectProjection(load, listen, apply, update, applied);
            })
            .catch((error: unknown) => {
                if (!disposed) update({ status: "error", error: String(error) });
            });
        return () => {
            disposed = true;
            disconnect?.();
        };
    });
}
