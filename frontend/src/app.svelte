<script lang="ts">
    import { activityRegistry, type Activity } from "$lib/activities";
    import AppMenu from "$lib/components/app-menu.svelte";
    import Command, { type WorkbenchCommand } from "$lib/components/command.svelte";
    import CloseDialog, { EditorCloseDialog } from "$lib/components/editor-area/close-dialog.svelte";
    import WorkbenchLayout from "$lib/components/workbench-layout.svelte";
    import WorkbenchHeader, { paneIcons } from "$lib/components/workbench-header.svelte";
    import { connectDesktop, type DesktopRuntime } from "$lib/desktop";
    import { registerBuiltinEditors } from "$lib/editors/builtins";
    import { EditorManager } from "$lib/editors/manager";
    import { activeTab } from "$lib/editors/model";
    import { EditorRegistry } from "$lib/editors/registry";
    import { t } from "$lib/i18n";
    import { MenuRegistry } from "$lib/menu";
    import { bindShortcuts, formatShortcut } from "$lib/shortcut";
    import { loadWorkbench, resizableRegions, saveWorkbench, type ResizableRegion } from "$lib/state";
    import { editorActions } from "$lib/workbench-editor-actions";
    import { registerWorkbenchMenu } from "$lib/workbench-menu";
    import { LayoutGrid, ListTodo, Settings } from "@lucide/svelte";
    import SystemFooter from "$lib/modules/footer.svelte";
    import { registerSystemMenu } from "$lib/modules/menu";
    import SystemPanel from "$lib/modules/panel.svelte";
    import SettingsDialog from "$lib/modules/settings/settings-dialog.svelte";
    import SettingsTheme from "$lib/modules/settings/theme.svelte";
    import { onMount } from "svelte";

    const paletteBinding = { key: "p", shift: true };

    const registry = new EditorRegistry();
    const choices = registerBuiltinEditors(registry);
    const choiceById = new Map(choices.map((choice) => [choice.id, choice]));
    const initial = loadWorkbench({ registry, defaultEditor: choices[0], legacyEditors: choiceById });
    const dialog = new EditorCloseDialog();
    const manager = new EditorManager(registry, initial.editor, dialog);

    let editor = $state.raw(manager.state);
    let layout: ReturnType<typeof WorkbenchLayout> | undefined = $state();
    let paletteOpen = $state(false);
    let settingsOpen = $state(false);
    const openSettings = () => (settingsOpen = true);
    let desktop = $state.raw<DesktopRuntime>();
    let customTitlebar = $state(false);
    let panelView = $state("output");
    let notificationsOpen = $state(false);
    let appName = $state("Milo");
    let groupIndex = $derived(editor.groups.findIndex(({ id }) => id === editor.focusedGroupId));
    let active = $derived(activeTab(editor.groups[groupIndex]));
    let dirty = $derived(editor.groups.some((group) => group.tabs.some((tab) => tab.dirty)));
    let modal = $derived(settingsOpen || !!(dialog.prompt || dialog.failure));

    const activities = activityRegistry();
    activities.register({
        id: "milo.workbench.views",
        owner: "milo.workbench",
        title: "workbench.views",
        icon: LayoutGrid,
        navigation: choices.map((choice) => ({
            ...choice,
            run: () => manager.open(choice, { preview: choice.preview }),
            isActive: () => active?.editorTypeId === choice.editorTypeId && active.resource === choice.resource,
        })),
    });
    activities.register({
        id: "milo.task.activity",
        owner: "milo.task",
        title: "task.title",
        icon: ListTodo,
        navigation: [
            {
                id: "milo.task.open",
                title: "task.title",
                icon: ListTodo,
                run: () => showPanel("tasks"),
                isActive: () => isRegionOpen("panel") && panelView === "tasks",
            },
        ],
    });

    let selectedActivityId = $state<string>();
    let activity = $derived($activities.find(({ id }) => id === selectedActivityId) ?? $activities[0]);
    const selectActivity = (selected: Activity) => {
        selectedActivityId = selected.id;
        if (selected.navigation.length) layout?.setOpen("primary", true);
    };

    const open = (id: string) => {
        const choice = choiceById.get(id);
        if (choice) manager.open(choice);
    };
    const isRegionOpen = (region: ResizableRegion) => layout?.isOpen(region) ?? false;
    const toggleRegion = (region: ResizableRegion) => layout?.toggle(region);
    const showPanel = (view: "output" | "tasks") => {
        panelView = view;
        layout?.setOpen("panel", true);
    };
    const openPalette = () => (paletteOpen = true);
    const actions = editorActions(
        manager,
        () => editor,
        () => !modal
    );
    const menu = new MenuRegistry();
    const resolveWorkbenchAction = registerWorkbenchMenu(menu, {
        editorActions: actions,
        openPalette,
        paletteShortcut: formatShortcut(paletteBinding),
        openWelcome: () => open("welcome"),
        quit: () =>
            void desktop?.Application.Quit().catch((error: unknown) => console.error("Could not quit Milo", error)),
        isDesktop: () => !!desktop,
        toggle: toggleRegion,
        isOpen: isRegionOpen,
    });

    const systemMenu = registerSystemMenu(menu, {
        settings: openSettings,
        output: () => showPanel("output"),
        tasks: () => showPanel("tasks"),
        notifications: () => (notificationsOpen = true),
    });
    const resolveMenuAction: typeof resolveWorkbenchAction = (id, owner) =>
        resolveWorkbenchAction(id, owner) ?? systemMenu.resolve(id, owner);

    $effect(() => saveWorkbench(editor, registry, initial.legacySplitSize));

    $effect(() => {
        if (!dirty || location.protocol === "wails:") return;
        const confirmUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", confirmUnload);
        return () => window.removeEventListener("beforeunload", confirmUnload);
    });

    onMount(() => systemMenu.dispose);
    onMount(() => manager.subscribe((workspace) => (editor = workspace)));
    onMount(() =>
        bindShortcuts([
            { binding: paletteBinding, run: openPalette, enabled: () => !modal },
            ...actions.flatMap(({ binding, run, enabled }) =>
                binding ? [{ binding, run, enabled: () => !paletteOpen && enabled() }] : []
            ),
        ])
    );

    onMount(() =>
        connectDesktop(
            manager,
            (runtime, titlebar) => {
                desktop = runtime;
                customTitlebar = titlebar;
            },
            (name) => (appName = name)
        )
    );

    let commands = $derived<WorkbenchCommand[]>([
        {
            id: "open.settings",
            label: $t("workbench.command.open", $t("tab.settings")),
            icon: Settings,
            run: openSettings,
        },
        ...choices.map((choice) => ({
            id: "open." + choice.id,
            label: $t("workbench.command.open", $t(choice.title)),
            icon: choice.icon,
            run: () => manager.open(choice),
        })),
        ...resizableRegions.map((region) => ({
            id: "toggle." + region,
            label: $t(
                isRegionOpen(region) ? "workbench.command.hide" : "workbench.command.show",
                $t("workbench." + region)
            ),
            icon: paneIcons[region],
            run: () => toggleRegion(region),
        })),
        ...actions.filter((action) => action.enabled()).map((action) => ({ ...action, label: $t(action.label) })),
    ]);
</script>

<svelte:head>
    <title>{active ? `${$t(active.title)} | ${appName}` : appName}</title>
</svelte:head>
<SettingsTheme />

<WorkbenchHeader
    {appName}
    {desktop}
    {customTitlebar}
    {openPalette}
    {isRegionOpen}
    {toggleRegion}
    paletteShortcut={formatShortcut(paletteBinding)}
>
    {#snippet applicationMenu()}
        <AppMenu {menu} resolve={resolveMenuAction} />
    {/snippet}
</WorkbenchHeader>

<WorkbenchLayout
    bind:this={layout}
    initialPanes={initial.panes}
    legacySplitSize={initial.legacySplitSize}
    activities={$activities}
    {activity}
    {selectActivity}
    {openSettings}
    {manager}
    {editor}
    {choices}
>
    {#snippet panel(open)}<SystemPanel bind:view={panelView} {open} />{/snippet}
</WorkbenchLayout>

<SystemFooter
    title={active ? $t(active.title) : $t("pane.empty.title")}
    group={editor.groups.length > 1 ? groupIndex + 1 : undefined}
    dirty={active?.dirty}
    bind:notificationsOpen
    openTasks={() => showPanel("tasks")}
/>

<Command bind:open={paletteOpen} {commands} />

<SettingsDialog bind:open={settingsOpen} />

<CloseDialog {dialog} />
