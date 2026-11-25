<script lang="ts">
    import { systemPrefersMode } from "mode-watcher";
    import { preference, settings, themeID } from "./state";

    let requested = $derived(preference($settings, themeID)?.value.text ?? "system");
    let resolved = $derived(requested === "system" ? (systemPrefersMode.current ?? "light") : requested);
    $effect(() => {
        document.documentElement.classList.toggle("dark", resolved === "dark");
        document.documentElement.style.colorScheme = resolved;
    });
</script>
