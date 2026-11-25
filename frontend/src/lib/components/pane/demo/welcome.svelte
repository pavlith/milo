<script lang="ts">
    import type { EditorRendererProps } from "$lib/editors/registry";
    import { t } from "$lib/i18n";

    let { tab }: EditorRendererProps = $props();
</script>

<div class="mx-auto w-full max-w-2xl p-4 @sm/editor:p-8">
    <h1 class="text-2xl font-semibold">{$t(tab.title)}</h1>
    <p class="text-muted-foreground mt-3 text-sm">{$t("workbench.welcome.description")}</p>
</div>
