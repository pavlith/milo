<script lang="ts">
    import { preference, settings, themeID } from "./state";

    import { resolveTheme } from "./color-mode";

    let resolved = $derived(resolveTheme(preference($settings, themeID)?.value.text));
    $effect(() => {
        document.documentElement.classList.toggle("dark", resolved === "dark");
        document.documentElement.style.colorScheme = resolved;
    });
</script>
