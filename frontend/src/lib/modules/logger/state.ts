import type { Change, Snapshot } from "../../../../bindings/milo.local/platform/modules/logger/models";
import { backendStore } from "../backend-store";
import { applyLogChange } from "./records";

export const loggerAPI = () => import("../../../../bindings/milo.local/platform/modules/logger/workbench");

export const output = backendStore<Snapshot, Change>(async () => {
    const [api, { Events }, { MiloLogChanged }] = await Promise.all([
        loggerAPI(),
        import("@wailsio/runtime"),
        import("../../../../bindings/events"),
    ]);
    return { load: api.List, listen: (receive) => Events.On(MiloLogChanged, ({ data }) => receive(data)) };
}, applyLogChange);
