import { systemPrefersMode } from "mode-watcher";

export function resolveTheme(preference: string | undefined) {
    if (preference === "light" || preference === "dark") return preference;
    return systemPrefersMode.current ?? "light";
}
