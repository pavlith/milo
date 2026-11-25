<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import type { EditorManager } from "$lib/editors/manager";
    import type { EditorTab } from "$lib/editors/model";
    import { t } from "$lib/i18n";

    let { tab, manager, onclose }: { tab: EditorTab; manager: EditorManager; onclose: () => void } = $props();
    let attempt = $state(0);
    let registryRevision = $state(0);
    let tabId = $derived(tab.id);
    let typeId = $derived(tab.editorTypeId);
    let ownerId = $derived(tab.ownerId);

    $effect(() => manager.registry.subscribe(() => registryRevision++));
    let registration = $derived.by(() => {
        registryRevision;
        const entry = manager.registry.get(typeId);
        return entry?.ownerId === ownerId ? entry : undefined;
    });

    let renderer = $derived.by(() => {
        attempt;
        const entry = registration;
        if (!entry) return;
        const id = tabId;
        return manager.registry.resolveRenderer(entry).then((Renderer) => ({
            Renderer,
            context: manager.context(id),
        }));
    });
</script>

{#snippet unavailable(retry: boolean)}
    <div class="space-y-3 p-4">
        <p class="text-muted-foreground text-sm" role="status">{$t("workbench.view.unavailable")}</p>
        {#if retry}
            <Button variant="outline" size="sm" onclick={() => attempt++}>{$t("workbench.view.retry")}</Button>
        {/if}
        <Button variant="ghost" size="sm" onclick={onclose}>{$t("pane.header.menu.close.self")}</Button>
    </div>
{/snippet}

{#if renderer}
    {#await renderer}
        <p class="text-muted-foreground p-4 text-sm" role="status">{$t("pane.loading")}</p>
    {:then { Renderer, context }}
        <svelte:boundary>
            <Renderer {tab} {context} />
            {#snippet failed()}
                {@render unavailable(true)}
            {/snippet}
        </svelte:boundary>
    {:catch}
        {@render unavailable(true)}
    {/await}
{:else}
    {@render unavailable(false)}
{/if}
