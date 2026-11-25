<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import type { EditorRendererProps } from "$lib/editors/registry";
    import { t } from "$lib/i18n";
    import { setMode, userPrefersMode } from "mode-watcher";

    let { tab }: EditorRendererProps = $props();
    const modes = ["light", "dark", "system"] as const;
</script>

<div class="mx-auto w-full max-w-2xl p-4 @sm/editor:p-8">
    <h1 class="text-2xl font-semibold">{$t(tab.title)}</h1>
    <div class="mt-6 space-y-2">
        <h2 id="appearance-mode" class="text-sm font-medium">{$t("workbench.appearance.mode")}</h2>
        <div role="group" aria-labelledby="appearance-mode" class="flex flex-wrap gap-2">
            {#each modes as mode (mode)}
                <Button
                    variant={userPrefersMode.current === mode ? "secondary" : "outline"}
                    aria-pressed={userPrefersMode.current === mode}
                    onclick={() => setMode(mode)}
                >
                    {$t("workbench.appearance." + mode)}
                </Button>
            {/each}
        </div>
    </div>
</div>
