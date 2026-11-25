import type { EditorManager } from "./editors/manager";

export type DesktopRuntime = typeof import("@wailsio/runtime");

export function connectDesktop(
    manager: EditorManager,
    onReady: (runtime: DesktopRuntime, customTitlebar: boolean) => void,
    onName: (name: string) => void
): (() => void) | undefined {
    if (location.protocol !== "wails:") return;

    let disposed = false;
    let pending: number | undefined;
    const unsubscribe: (() => void)[] = [];
    const report = (error: unknown) => console.error("Could not connect the workbench to the desktop host", error);

    void Promise.all([
        import("@wailsio/runtime"),
        import("../../bindings/milo.local/platform/app/host"),
        import("../../bindings/events"),
    ])
        .then(async ([runtime, { WorkbenchReady, ResolveWindowClose }, { MiloHostReady, MiloCloseRequested }]) => {
            if (disposed) return;
            unsubscribe.push(
                runtime.Events.Once(MiloHostReady, ({ data }) => onName(data)),
                runtime.Events.On(MiloCloseRequested, ({ data }) => {
                    if (pending === data) return;
                    pending = data;
                    const resolve = (approved: boolean) => ResolveWindowClose(data, approved);
                    void manager
                        .requestShutdown(() => resolve(true))
                        .then((approved) => (approved ? undefined : resolve(false)))
                        .catch(async (error: unknown) => {
                            report(error);
                            await resolve(false).catch(report);
                        })
                        .finally(() => {
                            if (pending === data) pending = undefined;
                        });
                })
            );
            await WorkbenchReady();
            if (!disposed) onReady(runtime, runtime.Flags.GetFlag("milo.customTitlebar") === true);
        })
        .catch(report);

    return () => {
        disposed = true;
        for (const stop of unsubscribe) stop();
    };
}
