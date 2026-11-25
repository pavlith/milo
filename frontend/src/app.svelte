<script lang="ts">
    import Command, { type WorkbenchCommand } from "$lib/components/command.svelte";
    import Content from "$lib/components/content.svelte";
    import { viewById, views } from "$lib/components/pane/views";
    import { Button } from "$lib/components/ui/button";
    import { t } from "$lib/i18n";
    import { bindShortcuts, formatShortcut } from "$lib/shortcut";
    import {
        loadWorkbench,
        modeStorageKey,
        resizableRegions,
        saveWorkbench,
        type PanePreferences,
        type ResizableRegion,
    } from "$lib/state";
    import { closeTabs, openTab, type TabState } from "$lib/tab";
    import { Command as CommandIcon, LayoutGrid, PanelBottom, PanelRight, X } from "@lucide/svelte";
    import { ModeWatcher } from "mode-watcher";
    import { onMount } from "svelte";

    const paletteBinding = { key: "p", shift: true };
    const closeBinding = { key: "w" };
    const paneIcons = { primary: LayoutGrid, secondary: PanelRight, panel: PanelBottom };

    let workbench = $state.raw(loadWorkbench(views.map((view) => view.id)));
    let content: ReturnType<typeof Content> | undefined = $state();
    let paletteOpen = $state(false);
    let appName = $state("slicer");
    let activeView = $derived(workbench.editor.activeId ? viewById.get(workbench.editor.activeId) : undefined);

    const updateEditor = (editor: TabState) => {
        if (editor !== workbench.editor) workbench = { ...workbench, editor };
    };
    const updateLayout = (panes: PanePreferences) => {
        if (panes !== workbench.panes) workbench = { ...workbench, panes };
    };
    const open = (id: string) => updateEditor(openTab(workbench.editor, id));
    const closeActive = () => {
        if (workbench.editor.activeId) updateEditor(closeTabs(workbench.editor, workbench.editor.activeId));
    };
    const togglePane = (region: ResizableRegion) => {
        const pane = workbench.panes[region];
        const panes = { ...workbench.panes, [region]: { ...pane, open: !pane.open } };
        updateLayout(panes);
        content?.applyLayout(panes);
    };

    $effect(() => saveWorkbench(workbench));

    onMount(() =>
        bindShortcuts([
            { binding: paletteBinding, run: () => (paletteOpen = true) },
            {
                binding: closeBinding,
                run: closeActive,
                enabled: () => !paletteOpen && workbench.editor.activeId !== null,
            },
        ])
    );

    onMount(() => {
        if (location.protocol !== "wails:") return;

        let disposed = false;
        let unsubscribe: (() => void) | undefined;
        void Promise.all([
            import("@wailsio/runtime"),
            import("../bindings/github.com/pavlith/slicer/app/host"),
            import("../bindings/events"),
        ])
            .then(([{ Events }, { WorkbenchReady }, { SlicerHostReady }]) => {
                if (disposed) return;
                unsubscribe = Events.Once(SlicerHostReady, ({ data }) => (appName = data));
                return WorkbenchReady();
            })
            .catch((error: unknown) => {
                unsubscribe?.();
                console.error("Could not connect the workbench to the desktop host", error);
            });
        return () => {
            disposed = true;
            unsubscribe?.();
        };
    });

    let commands = $derived<WorkbenchCommand[]>([
        ...views.map((view) => ({
            id: "open." + view.id,
            label: $t("workbench.command.open", $t(view.title)),
            icon: view.icon,
            run: () => open(view.id),
        })),
        ...resizableRegions.map((region) => ({
            id: "toggle." + region,
            label: $t(
                workbench.panes[region].open ? "workbench.command.hide" : "workbench.command.show",
                $t("workbench." + region)
            ),
            icon: paneIcons[region],
            run: () => togglePane(region),
        })),
        ...(workbench.editor.activeId
            ? [{ id: "close", label: $t("workbench.command.close"), icon: X, binding: closeBinding, run: closeActive }]
            : []),
    ]);
</script>

<svelte:head>
    <title>{activeView ? `${$t(activeView.title)} | ${appName}` : appName}</title>
</svelte:head>
<ModeWatcher {modeStorageKey} synchronousModeChanges />

{#snippet paneButton(region: ResizableRegion)}
    {@const Icon = paneIcons[region]}
    {@const label = $t("workbench." + region)}
    <Button
        size="icon-sm"
        variant="ghost"
        title={label}
        aria-label={label}
        aria-controls={region}
        aria-pressed={workbench.panes[region].open}
        class="aria-pressed:bg-accent"
        onclick={() => togglePane(region)}
    >
        <Icon />
    </Button>
{/snippet}

<header data-region="header" class="bg-muted/50 flex h-10 shrink-0 items-center justify-between gap-3 border-b px-3">
    <span class="text-sm font-semibold">{appName}</span>
    <Button variant="outline" size="sm" class="min-w-0 gap-2" onclick={() => (paletteOpen = true)}>
        <CommandIcon />
        <span class="truncate">{$t("workbench.command")}</span>
        <kbd class="text-muted-foreground hidden text-xs sm:inline">{formatShortcut(paletteBinding)}</kbd>
    </Button>
    <div class="flex shrink-0 gap-1">
        {@render paneButton("secondary")}
        {@render paneButton("panel")}
    </div>
</header>

<div class="flex min-h-0 flex-1">
    <nav
        data-region="left"
        aria-label={$t("workbench.left")}
        class="bg-muted/50 flex w-11 shrink-0 justify-center border-r pt-1.5"
    >
        {@render paneButton("primary")}
    </nav>
    <Content
        bind:this={content}
        panes={workbench.panes}
        editor={workbench.editor}
        onlayout={updateLayout}
        oneditor={updateEditor}
        onopen={open}
    />
</div>

<footer
    data-region="footer"
    class="bg-muted/50 text-muted-foreground flex h-6 shrink-0 items-center border-t px-3 text-xs"
>
    {activeView ? $t(activeView.title) : $t("pane.empty.title")}
</footer>

<Command bind:open={paletteOpen} {commands} />
