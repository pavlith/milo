import type { Change, Snapshot } from "../../../../bindings/milo.local/platform/modules/task/models";
import { backendStore } from "../backend-store";
import { applyTaskChange } from "./tasks";

export const taskAPI = () => import("../../../../bindings/milo.local/platform/modules/task/workbench");

export const tasks = backendStore<Snapshot, Change>(async () => {
    const [api, { Events }, { MiloTaskChanged }] = await Promise.all([
        taskAPI(),
        import("@wailsio/runtime"),
        import("../../../../bindings/events"),
    ]);
    return { load: api.List, listen: (receive) => Events.On(MiloTaskChanged, ({ data }) => receive(data)) };
}, applyTaskChange);
