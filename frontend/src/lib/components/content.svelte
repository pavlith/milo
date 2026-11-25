<script lang="ts">
    import type { Activity } from "$lib/activities";
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
        openRegions: Record<ResizableRegion, boolean>;
        activity?: Activity;
        legacySplitSize?: number;
        manager: EditorManager;
        editor: EditorWorkspace;
        choices: readonly EditorChoice[];
        panel: Snippet;
        onvisibilitychange: (region: ResizableRegion, open: boolean) => void;
    }

    let {
        initialPanes,
        openRegions,
        activity,
        legacySplitSize,
        manager,
        editor,
        choices,
        panel,
        onvisibilitychange,
    }: Props = $props();
    type Pane = ReturnType<typeof ResizablePane>;
    let primary: Pane | undefined = $state();
    let secondary: Pane | undefined = $state();
    let bottom: Pane | undefined = $state();
    const groups = {
        primary: "milo.workbench.body",
        panel: "milo.workbench.workspace",
        secondary: "milo.workbench.main",
    };
    const getPane = (region: ResizableRegion) => ({ primary, secondary, panel: bottom })[region];
    const initialize = untrack(() => ({
        primary: initialPaneLayout(groups.primary, () => primary, initialPanes.primary),
        panel: initialPaneLayout(groups.panel, () => bottom, initialPanes.panel),
        secondary: initialPaneLayout(groups.secondary, () => secondary, initialPanes.secondary),
    }));

    export function setOpen(region: ResizableRegion, open: boolean) {
        const pane = getPane(region);
        if (open) pane?.expand();
        else pane?.collapse();
    }
</script>

<ResizablePaneGroup
    id={groups.primary}
    autoSaveId={groups.primary}
    direction="horizontal"
    class="min-h-0 min-w-0 flex-1"
    onLayoutChange={initialize.primary}
>
    <ResizablePane
        bind:this={primary}
        id="primary"
        data-region="primary"
        order={1}
        defaultSize={paneDefaults.primary.size}
        minSize={paneDefaults.primary.min}
        maxSize={paneDefaults.primary.max}
        collapsible
        onCollapse={() => onvisibilitychange("primary", false)}
        onExpand={() => onvisibilitychange("primary", true)}
    >
        <Sidebar.Root class="w-full overflow-hidden" inert={!openRegions.primary}>
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
    <ResizableHandle aria-label={$t("workbench.resize.primary")} />
    <ResizablePane id="workspace" order={2} minSize={100 - paneDefaults.primary.max}>
        <ResizablePaneGroup
            id={groups.panel}
            autoSaveId={groups.panel}
            direction="vertical"
            onLayoutChange={initialize.panel}
        >
            <ResizablePane id="main-area" order={1} minSize={100 - paneDefaults.panel.max}>
                <ResizablePaneGroup
                    id={groups.secondary}
                    autoSaveId={groups.secondary}
                    direction="horizontal"
                    onLayoutChange={initialize.secondary}
                >
                    <ResizablePane
                        id="editor"
                        data-region="editor"
                        order={1}
                        minSize={100 - paneDefaults.secondary.max}
                    >
                        <main class="h-full min-w-0 overflow-hidden" aria-label={$t("workbench.editor")}>
                            <EditorArea {manager} workspace={editor} {choices} {legacySplitSize} />
                        </main>
                    </ResizablePane>
                    <ResizableHandle aria-label={$t("workbench.resize.secondary")} />
                    <ResizablePane
                        bind:this={secondary}
                        id="secondary"
                        data-region="secondary"
                        order={2}
                        defaultSize={paneDefaults.secondary.size}
                        minSize={paneDefaults.secondary.min}
                        maxSize={paneDefaults.secondary.max}
                        collapsible
                        onCollapse={() => onvisibilitychange("secondary", false)}
                        onExpand={() => onvisibilitychange("secondary", true)}
                    >
                        <div class="h-full min-w-0 overflow-hidden" inert={!openRegions.secondary}>
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
            <ResizableHandle aria-label={$t("workbench.resize.panel")} />
            <ResizablePane
                bind:this={bottom}
                id="panel"
                data-region="panel"
                order={2}
                defaultSize={paneDefaults.panel.size}
                minSize={paneDefaults.panel.min}
                maxSize={paneDefaults.panel.max}
                collapsible
                onCollapse={() => onvisibilitychange("panel", false)}
                onExpand={() => onvisibilitychange("panel", true)}
            >
                <div class="h-full min-w-0 overflow-hidden" inert={!openRegions.panel}>
                    {@render panel()}
                </div>
            </ResizablePane>
        </ResizablePaneGroup>
    </ResizablePane>
</ResizablePaneGroup>
