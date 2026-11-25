<script lang="ts">
    import Pane from "$lib/components/pane/pane.svelte";
    import { views } from "$lib/components/pane/views";
    import { Button } from "$lib/components/ui/button";
    import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "$lib/components/ui/resizable";
    import { t } from "$lib/i18n";
    import { columns, paneLimits, resizePane, rows, type PanePreferences } from "$lib/state";
    import type { TabState } from "$lib/tab";
    import { untrack } from "svelte";

    interface Props {
        panes: PanePreferences;
        editor: TabState;
        onlayout: (panes: PanePreferences) => void;
        oneditor: (editor: TabState) => void;
        onopen: (id: string) => void;
    }

    let { panes, editor, onlayout, oneditor, onopen }: Props = $props();
    let horizontal: ReturnType<typeof ResizablePaneGroup> | undefined = $state();
    let vertical: ReturnType<typeof ResizablePaneGroup> | undefined = $state();

    const initialColumns = untrack(() => columns(panes));
    const initialRows = untrack(() => rows(panes));

    export const applyLayout = (next: PanePreferences) => {
        horizontal?.setLayout(columns(next));
        vertical?.setLayout(rows(next));
    };

    const resizeColumns = ([primary, , secondary]: number[]) =>
        onlayout(resizePane(resizePane(panes, "primary", primary), "secondary", secondary));

    const resizeRows = ([, panel]: number[]) => onlayout(resizePane(panes, "panel", panel));
</script>

<ResizablePaneGroup bind:this={horizontal} direction="horizontal" class="min-w-0 flex-1" onLayoutChange={resizeColumns}>
    <ResizablePane
        id="primary"
        data-region="primary"
        order={1}
        defaultSize={initialColumns[0]}
        minSize={paneLimits.primary.min}
        maxSize={paneLimits.primary.max}
        collapsedSize={0}
        collapsible
    >
        {#if panes.primary.open}
            <nav aria-label={$t("workbench.views")} class="bg-sidebar h-full overflow-auto">
                <h2 class="px-3 pt-3 pb-2 text-xs font-semibold">{$t("workbench.views")}</h2>
                <div class="space-y-0.5 px-2">
                    {#each views as view (view.id)}
                        <Button
                            variant="ghost"
                            size="sm"
                            class="w-full justify-start overflow-hidden"
                            aria-current={editor.activeId === view.id ? "page" : undefined}
                            onclick={() => onopen(view.id)}
                        >
                            <view.icon />
                            <span class="truncate">{$t(view.title)}</span>
                        </Button>
                    {/each}
                </div>
            </nav>
        {/if}
    </ResizablePane>
    <ResizableHandle
        disabled={!panes.primary.open}
        class={panes.primary.open ? undefined : "hidden"}
        aria-label={$t("workbench.resize.primary")}
    />
    <ResizablePane
        order={2}
        defaultSize={initialColumns[1]}
        minSize={100 - paneLimits.primary.max - paneLimits.secondary.max}
    >
        <ResizablePaneGroup bind:this={vertical} direction="vertical" onLayoutChange={resizeRows}>
            <ResizablePane
                id="editor"
                data-region="editor"
                order={1}
                defaultSize={initialRows[0]}
                minSize={100 - paneLimits.panel.max}
            >
                <main class="h-full" aria-label={$t("workbench.editor")}>
                    <Pane {editor} onchange={oneditor} {onopen} />
                </main>
            </ResizablePane>
            <ResizableHandle
                disabled={!panes.panel.open}
                class={panes.panel.open ? undefined : "hidden"}
                aria-label={$t("workbench.resize.panel")}
            />
            <ResizablePane
                id="panel"
                data-region="panel"
                order={2}
                defaultSize={initialRows[1]}
                minSize={paneLimits.panel.min}
                maxSize={paneLimits.panel.max}
                collapsedSize={0}
                collapsible
            >
                {#if panes.panel.open}
                    <section aria-labelledby="panel-title" class="h-full overflow-auto">
                        <h2 id="panel-title" class="bg-muted/50 border-b px-3 py-2 text-xs font-semibold">
                            {$t("workbench.panel")}
                        </h2>
                        <p class="text-muted-foreground px-3 py-3 text-sm">{$t("workbench.panel.empty")}</p>
                    </section>
                {/if}
            </ResizablePane>
        </ResizablePaneGroup>
    </ResizablePane>
    <ResizableHandle
        disabled={!panes.secondary.open}
        class={panes.secondary.open ? undefined : "hidden"}
        aria-label={$t("workbench.resize.secondary")}
    />
    <ResizablePane
        id="secondary"
        data-region="secondary"
        order={3}
        defaultSize={initialColumns[2]}
        minSize={paneLimits.secondary.min}
        maxSize={paneLimits.secondary.max}
        collapsedSize={0}
        collapsible
    >
        {#if panes.secondary.open}
            <aside aria-labelledby="secondary-title" class="bg-sidebar h-full overflow-auto">
                <h2 id="secondary-title" class="px-3 pt-3 pb-2 text-xs font-semibold">{$t("workbench.secondary")}</h2>
                <p class="text-muted-foreground px-3 text-sm">{$t("workbench.secondary.empty")}</p>
            </aside>
        {/if}
    </ResizablePane>
</ResizablePaneGroup>
