<script lang="ts">
    import AppMenu from "$lib/components/app-menu.svelte";
    import Command, { type WorkbenchCommand } from "$lib/components/command.svelte";
    import WorkbenchHeader from "$lib/components/workbench-header.svelte";
    import Content from "$lib/components/content.svelte";
    import { viewById, views } from "$lib/components/pane/views";
    import { Button } from "$lib/components/ui/button";
    import { t } from "$lib/i18n";
    import { MenuRegistry } from "$lib/menu";
    import { bindShortcuts, formatShortcut } from "$lib/shortcut";
    import {
        loadWorkbench,
        modeStorageKey,
        resizableRegions,
        resizePane,
        saveWorkbench,
        togglePane,
        type PanePreferences,
        type ResizableRegion,
    } from "$lib/state";
    import { closeTabs, openTab, type TabState } from "$lib/tab";
    import { registerWorkbenchMenu } from "$lib/workbench-menu";
    import { LayoutGrid, PanelBottom, PanelLeft, PanelRight, X } from "@lucide/svelte";
    import { ModeWatcher } from "mode-watcher";
    import { onMount } from "svelte";

    const paletteBinding = { key: "p", shift: true };
    const closeBinding = { key: "w" };
    const paneIcons = { primary: PanelLeft, panel: PanelBottom, secondary: PanelRight };

    let workbench = $state.raw(loadWorkbench(views.map((view) => view.id)));
    let content: ReturnType<typeof Content> | undefined = $state();
    let paletteOpen = $state(false);
    let desktop = $state.raw<typeof import("@wailsio/runtime")>();
    let customTitlebar = $state(false);
    let appName = $state("Milo");
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
    const toggleRegion = (region: ResizableRegion) => {
        const panes = togglePane(workbench.panes, region);
        updateLayout(panes);
        content?.applyLayout(panes, region);
    };
    const resizeRegion = (region: ResizableRegion, size: number) =>
        updateLayout(resizePane(workbench.panes, region, size));
    const openPalette = () => (paletteOpen = true);
    const menu = new MenuRegistry();
    const resolveMenuAction = registerWorkbenchMenu(menu, {
        openPalette,
        paletteShortcut: formatShortcut(paletteBinding),
        openAppearance: () => open("appearance"),
        openWelcome: () => open("welcome"),
        quit: () =>
            void desktop?.Application.Quit().catch((error: unknown) => console.error("Could not quit Milo", error)),
        isDesktop: () => !!desktop,
        toggle: toggleRegion,
        isOpen: (region) => workbench.panes[region].open,
    });

    $effect(() => saveWorkbench(workbench));

    onMount(() =>
        bindShortcuts([
            { binding: paletteBinding, run: openPalette },
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
            import("../bindings/milo.local/platform/app/host"),
            import("../bindings/events"),
        ])
            .then(async ([runtime, { WorkbenchReady }, { MiloHostReady }]) => {
                if (disposed) return;
                unsubscribe = runtime.Events.Once(MiloHostReady, ({ data }) => (appName = data));
                await WorkbenchReady();
                if (disposed) return;
                customTitlebar = runtime.Flags.GetFlag("milo.customTitlebar") === true;
                desktop = runtime;
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
            run: () => toggleRegion(region),
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
        size="icon-xs"
        variant="ghost"
        title={label}
        aria-label={label}
        aria-controls={region}
        aria-pressed={workbench.panes[region].open}
        class="aria-pressed:border-input aria-pressed:bg-background size-7 rounded-sm transition-none active:translate-y-0"
        onclick={() => toggleRegion(region)}
    >
        <Icon />
    </Button>
{/snippet}

<WorkbenchHeader {appName} {desktop} {customTitlebar} {openPalette} paletteShortcut={formatShortcut(paletteBinding)}>
    {#snippet applicationMenu()}
        <AppMenu {menu} resolve={resolveMenuAction} />
    {/snippet}
    {#snippet layoutControls()}
        {@render paneButton("primary")}
        {@render paneButton("panel")}
        {@render paneButton("secondary")}
    {/snippet}
</WorkbenchHeader>

<div class="flex min-h-0 flex-1">
    <nav
        data-region="left"
        aria-label={$t("workbench.left")}
        class="bg-muted/50 flex w-11 shrink-0 justify-center border-r pt-1.5"
    >
        <Button
            variant="ghost"
            size="icon-sm"
            class="aria-pressed:border-input aria-pressed:bg-background rounded-sm transition-none"
            title={$t("workbench.views")}
            aria-label={$t("workbench.views")}
            aria-controls="primary"
            aria-pressed={workbench.panes.primary.open}
            onclick={() => toggleRegion("primary")}
        >
            <LayoutGrid />
        </Button>
    </nav>
    <Content
        bind:this={content}
        panes={workbench.panes}
        editor={workbench.editor}
        onresize={resizeRegion}
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
