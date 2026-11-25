import type { CancellablePromise } from "@wailsio/runtime";

export async function withSignal<T>(signal: AbortSignal, call: () => CancellablePromise<T>): Promise<T> {
    signal.throwIfAborted();
    return await call().cancelOn(signal);
}

// Listen before loading and coalesce invalidations received during a load.
export function connectCatalog<T extends { id: string }>(
    load: (signal: AbortSignal) => PromiseLike<T[] | null>,
    listen: (invalidate: () => void) => () => void,
    register: (metadata: T) => () => void,
    onError: () => void
) {
    const entries = new Map<string, { metadata: string; dispose: () => void }>();
    const lifetime = new AbortController();
    let running = false;
    let dirty = false;

    async function refresh() {
        dirty = true;
        if (running) return;
        running = true;
        try {
            while (dirty && !lifetime.signal.aborted) {
                dirty = false;
                try {
                    const catalog = await load(lifetime.signal);
                    if (dirty || lifetime.signal.aborted) continue;
                    const ids = new Set(catalog?.map(({ id }) => id));
                    for (const [id, entry] of entries) {
                        if (!ids.has(id)) {
                            entry.dispose();
                            entries.delete(id);
                        }
                    }
                    for (const item of catalog ?? []) {
                        const metadata = JSON.stringify(item);
                        const previous = entries.get(item.id);
                        if (previous?.metadata === metadata) continue;
                        previous?.dispose();
                        entries.delete(item.id);
                        entries.set(item.id, { metadata, dispose: register(item) });
                    }
                } catch {
                    if (!lifetime.signal.aborted) onError();
                }
            }
        } finally {
            running = false;
        }
    }

    const off = listen(() => void refresh());
    void refresh();
    return () => {
        lifetime.abort();
        off();
        for (const entry of entries.values()) entry.dispose();
        entries.clear();
    };
}
