<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { t } from "$lib/i18n";
    import { viewById } from "./views";

    interface Props {
        id: string;
        onclose: () => void;
    }

    let { id, onclose }: Props = $props();
    let view = $derived(viewById.get(id));
    let attempt = $state(0);
</script>

{#snippet unavailable(retry: boolean)}
    <div class="space-y-3 p-6">
        <p class="text-muted-foreground text-sm" role="status">{$t("workbench.view.unavailable")}</p>
        {#if retry}
            <Button variant="outline" size="sm" onclick={() => attempt++}>{$t("workbench.view.retry")}</Button>
        {/if}
        <Button variant="ghost" size="sm" onclick={onclose}>{$t("pane.header.menu.close.self")}</Button>
    </div>
{/snippet}

{#if view}
    {#key attempt}
        {#await view.load()}
            <p class="text-muted-foreground p-6 text-sm" role="status">{$t("pane.loading")}</p>
        {:then { default: View }}
            <View />
        {:catch}
            {@render unavailable(true)}
        {/await}
    {/key}
{:else}
    {@render unavailable(false)}
{/if}
