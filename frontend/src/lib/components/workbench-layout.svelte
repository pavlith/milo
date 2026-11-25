<script lang="ts">
    import type { Activity } from "$lib/activities";
    import LeftSidebar from "$lib/components/left-sidebar.svelte";
    import EditorArea from "$lib/components/editor-area/editor-area.svelte";
    import * as Sidebar from "$lib/components/ui/sidebar";
    import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "$lib/components/ui/resizable";
    import type { EditorManager } from "$lib/editors/manager";
    import type { EditorChoice, EditorWorkspace } from "$lib/editors/model";
    import { t } from "$lib/i18n";
    import { paneDefaults, type PanePreferences, type ResizableRegion } from "$lib/state";
    import { untrack, type Snippet } from "svelte";

    import { initialPaneLayout } from "./initial-pane-layout";

    interface Props {
        initialPanes: PanePreferences;
        activities: readonly Activity[];
        selectActivity: (activity: Activity) => void;
        openSettings: () => void;
        activity?: Activity;
        legacySplitSize?: number;
        manager: EditorManager;
        editor: EditorWorkspace;
        choices: readonly EditorChoice[];
        panel: Snippet<[open: boolean]>;
    }

    let {
        initialPanes,
        activities,
        selectActivity,
        openSettings,
        activity,
        legacySplitSize,
        manager,
        editor,
        choices,
        panel,
    }: Props = $props();
    type Pane = ReturnType<typeof ResizablePane>;
    let primary: Pane | undefined = $state();
    let secondary: Pane | undefined = $state();
    let bottom: Pane | undefined = $state();
    let panelMounted = $state(false);
    let panelReady = false;
    let primaryOpen = $derived(primary?.isExpanded() ?? false);
    let secondaryOpen = $derived(secondary?.isExpanded() ?? false);
    let panelOpen = $derived(bottom?.isExpanded() ?? false);
    const groups = {
        primary: "milo.workbench.body",
        panel: "milo.workbench.workspace",
        secondary: "milo.workbench.main",
    };
    function getPane(region: ResizableRegion) {
        switch (region) {
            case "primary":
                return primary;
            case "secondary":
                return secondary;
            case "panel":
                return bottom;
        }
    }

    export function isOpen(region: ResizableRegion) {
        switch (region) {
            case "primary":
                return primaryOpen;
            case "secondary":
                return secondaryOpen;
            case "panel":
                return panelOpen;
        }
    }
    const initialize = untrack(() => ({
        primary: initialPaneLayout(groups.primary, () => primary, initialPanes.primary),
        panel: initialPaneLayout(
            groups.panel,
            () => bottom,
            initialPanes.panel,
            () => {
                panelReady = true;
                if (bottom?.isExpanded()) panelMounted = true;
            }
        ),
        secondary: initialPaneLayout(groups.secondary, () => secondary, initialPanes.secondary),
    }));

    export function setOpen(region: ResizableRegion, open: boolean) {
        const pane = getPane(region);
        if (!pane || isOpen(region) === open) return;
        if (open) pane.expand();
        else pane.collapse();
    }

    export function toggle(region: ResizableRegion) {
        setOpen(region, !isOpen(region));
    }

    function syncSidebarSize(pane: Pane | undefined, divider: HTMLElement) {
        if (!pane || !primaryOpen || !secondaryOpen) return;

        const group = divider.parentElement;
        const sidebar = group?.querySelector<HTMLElement>(`[data-region="${pane.getId()}"]`);
        if (!group || !sidebar) return;

        // Start a manual resize from the rendered width when the window has capped this sidebar.
        const availableWidth = group.clientWidth - divider.offsetWidth;
        const width = sidebar.getBoundingClientRect().width;
        if (availableWidth > 0 && (pane.getSize() * availableWidth) / 100 - width > 1) {
            pane.resize((100 * width) / availableWidth);
        }
    }
</script>

{#snippet sidebarDivider(region: "primary" | "secondary", pane: Pane | undefined)}
    <ResizableHandle
        id={`resize-${region}`}
        aria-label={$t(`workbench.resize.${region}`)}
        onmousedowncapture={(event) => {
            if (event.button === 0) syncSidebarSize(pane, event.currentTarget);
        }}
        ontouchstartcapture={(event) => syncSidebarSize(pane, event.currentTarget)}
        onkeydowncapture={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") syncSidebarSize(pane, event.currentTarget);
        }}
    />
{/snippet}

<Sidebar.Provider data-region="body" class="h-auto flex-1 overflow-hidden">
    <LeftSidebar {activities} activeId={activity?.id} select={selectActivity} {openSettings} />
    <ResizablePaneGroup
        id={groups.primary}
        autoSaveId={groups.primary}
        direction="horizontal"
        class="@container min-h-0 min-w-0 flex-1"
        data-sidebars-open={primaryOpen && secondaryOpen ? "" : undefined}
        keyboardResizeBy={2}
        onLayoutChange={initialize.primary}
    >
        <ResizablePane
            bind:this={primary}
            id="primary"
            data-region="primary"
            class="workbench-sidebar"
            order={1}
            defaultSize={paneDefaults.primary.size}
            minSize={paneDefaults.primary.min}
            maxSize={paneDefaults.primary.max}
            collapsible
        >
            <Sidebar.Root class="w-full overflow-hidden" inert={!primaryOpen}>
                {#if activity}
                    <Sidebar.Content>
                        <Sidebar.Group role="navigation" aria-label={$t(activity.title)}>
                            <Sidebar.GroupLabel>{$t(activity.title)}</Sidebar.GroupLabel>
                            <Sidebar.GroupContent>
                                <Sidebar.Menu>
                                    {#each activity.navigation as item (item.id)}
                                        {@const isActive = item.isActive?.() ?? false}
                                        <Sidebar.MenuItem>
                                            <Sidebar.MenuButton
                                                {isActive}
                                                aria-current={isActive ? "page" : undefined}
                                                onclick={item.run}
                                            >
                                                {#if item.icon}<item.icon />{/if}
                                                <span>{$t(item.title)}</span>
                                            </Sidebar.MenuButton>
                                        </Sidebar.MenuItem>
                                    {/each}
                                </Sidebar.Menu>
                            </Sidebar.GroupContent>
                        </Sidebar.Group>
                    </Sidebar.Content>
                {/if}
            </Sidebar.Root>
        </ResizablePane>
        {@render sidebarDivider("primary", primary)}
        <ResizablePane id="workspace" order={2} minSize={100 - paneDefaults.primary.max}>
            <ResizablePaneGroup
                id={groups.secondary}
                autoSaveId={groups.secondary}
                direction="horizontal"
                keyboardResizeBy={2}
                onLayoutChange={initialize.secondary}
            >
                <ResizablePane id="center" order={1} minSize={100 - paneDefaults.secondary.max}>
                    <ResizablePaneGroup
                        id={groups.panel}
                        autoSaveId={groups.panel}
                        direction="vertical"
                        keyboardResizeBy={2}
                        onLayoutChange={initialize.panel}
                    >
                        <ResizablePane
                            id="editor"
                            data-region="editor"
                            order={1}
                            minSize={100 - paneDefaults.panel.max}
                        >
                            <main class="h-full min-w-0 overflow-hidden" aria-label={$t("workbench.editor")}>
                                <EditorArea {manager} workspace={editor} {choices} {legacySplitSize} />
                            </main>
                        </ResizablePane>
                        <ResizableHandle id="resize-panel" aria-label={$t("workbench.resize.panel")} />
                        <ResizablePane
                            bind:this={bottom}
                            id="panel"
                            data-region="panel"
                            order={2}
                            defaultSize={paneDefaults.panel.size}
                            minSize={paneDefaults.panel.min}
                            maxSize={paneDefaults.panel.max}
                            collapsible
                            onExpand={() => {
                                if (panelReady) panelMounted = true;
                            }}
                        >
                            {#if panelMounted}
                                <div class="h-full min-w-0 overflow-hidden" hidden={!panelOpen}>
                                    {@render panel(panelOpen)}
                                </div>
                            {/if}
                        </ResizablePane>
                    </ResizablePaneGroup>
                </ResizablePane>
                {@render sidebarDivider("secondary", secondary)}
                <ResizablePane
                    bind:this={secondary}
                    id="secondary"
                    data-region="secondary"
                    class="workbench-sidebar"
                    order={2}
                    defaultSize={paneDefaults.secondary.size}
                    minSize={paneDefaults.secondary.min}
                    maxSize={paneDefaults.secondary.max}
                    collapsible
                >
                    <div class="h-full min-w-0 overflow-hidden" inert={!secondaryOpen}>
                        <aside aria-labelledby="secondary-title" class="bg-sidebar h-full overflow-auto">
                            <h2 id="secondary-title" class="px-3 pt-3 pb-2 text-xs font-semibold">
                                {$t("workbench.secondary")}
                            </h2>
                            <p class="text-muted-foreground px-3 text-sm">{$t("workbench.secondary.empty")}</p>
                        </aside>
                    </div>
                </ResizablePane>
            </ResizablePaneGroup>
        </ResizablePane>
    </ResizablePaneGroup>
</Sidebar.Provider>

<style>
    :global([data-sidebars-open]) :global(.workbench-sidebar) {
        /* Leave 360px for the editor plus 2px for the horizontal dividers. */
        max-inline-size: max(12cqw, calc((100cqw - 362px) / 2));
    }
</style>
