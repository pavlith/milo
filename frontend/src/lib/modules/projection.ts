interface Revision {
    revision: number;
}

export type ProjectionState<T> =
    { status: "loading" } | { status: "ready"; value: T } | { status: "error"; error: string };

// Listen before loading. Snapshots cover buffered deltas at or below their
// revision. A gap (including buffer overflow) triggers a fresh snapshot.
export function connectProjection<T extends Revision, D extends Revision>(
    load: () => PromiseLike<T>,
    listen: (receive: (delta: D) => void) => () => void,
    apply: (current: T, delta: D) => T,
    update: (state: ProjectionState<T>) => void,
    applied?: (delta: D) => void
) {
    let current: T | undefined;
    let loading = false;
    let stopped = false;
    let newest = 0;
    const pending = new Map<number, D>();

    function drain() {
        if (!current) return;
        for (const revision of pending.keys()) {
            if (revision <= current.revision) pending.delete(revision);
        }
        for (let delta = pending.get(current.revision + 1); delta; delta = pending.get(current.revision + 1)) {
            current = apply(current, delta);
            pending.delete(delta.revision);
            applied?.(delta);
        }
        update({ status: "ready", value: current });
        if (current.revision < newest) void refresh();
    }

    async function refresh() {
        if (loading || stopped) return;
        loading = true;
        try {
            const snapshot = await load();
            if (stopped) return;
            if (!current || snapshot.revision >= current.revision) current = snapshot;
        } catch (error) {
            if (!stopped) update({ status: "error", error: String(error) });
            return;
        } finally {
            loading = false;
        }
        drain();
    }

    const unsubscribe = listen((delta) => {
        if (stopped || delta.revision <= (current?.revision ?? -1)) return;
        newest = Math.max(newest, delta.revision);
        if (pending.size >= 256) pending.clear();
        pending.set(delta.revision, delta);
        if (!loading) {
            if (current) drain();
            else void refresh();
        }
    });
    void refresh();

    return () => {
        stopped = true;
        pending.clear();
        unsubscribe();
    };
}
