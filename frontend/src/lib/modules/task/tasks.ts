import type { Change, Snapshot, Task } from "../../../../bindings/milo.local/platform/modules/task/models";

export function applyTaskChange(snapshot: Snapshot, { revision, task, evicted }: Change): Snapshot {
    const active = (snapshot.active ?? []).filter(({ run }) => run !== task.run);
    const completed = (snapshot.completed ?? []).filter(({ run }) => run !== evicted && run !== task.run);
    if (task.status === "running") {
        active.push(task);
        active.sort((a, b) => a.run - b.run);
    } else completed.push(task);
    return { revision, active, completed };
}

export function aggregateProgress(active: readonly Task[]) {
    if (!active.length || active.some(({ progress }) => progress == null)) return undefined;
    return active.reduce((sum, { progress }) => sum + (progress ?? 0), 0) / active.length;
}

export const percent = (progress: number) => Math.round(progress * 100);
