<script lang="ts">
    import { activityRegistry, type Activity } from "$lib/activities";
    import AppMenu from "$lib/components/app-menu.svelte";
    import Command, { type WorkbenchCommand } from "$lib/components/command.svelte";
    import Content from "$lib/components/content.svelte";
    import CloseDialog, { EditorCloseDialog } from "$lib/components/editor-area/close-dialog.svelte";
    import LeftSidebar from "$lib/components/left-sidebar.svelte";
    import { Button } from "$lib/components/ui/button";
    import * as Sidebar from "$lib/components/ui/sidebar";
    import WorkbenchHeader from "$lib/components/workbench-header.svelte";
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
    import { LayoutGrid, ListTodo, PanelBottom, PanelLeft, PanelRight } from "@lucide/svelte";
    import SystemFooter from "$lib/modules/footer.svelte";
    import { registerSystemMenu } from "$lib/modules/menu";
    import SystemPanel from "$lib/modules/panel.svelte";
    import { registerSettingsEditor, settingsEditor } from "$lib/modules/settings/contribution";
    import SettingsTheme from "$lib/modules/settings/theme.svelte";
    import { onMount } from "svelte";

    const paletteBinding = { key: "p", shift: true };
    const paneIcons = { primary: PanelLeft, panel: PanelBottom, secondary: PanelRight };

    const registry = new EditorRegistry();
    const disposeSettings = registerSettingsEditor(registry);
    const builtinChoices = registerBuiltinEditors(registry);
    const choices = [...builtinChoices, settingsEditor];
    const choiceById = new Map(choices.map((choice) => [choice.id, choice]));
    choiceById.set("appearance", settingsEditor);
    const initial = loadWorkbench({ registry, defaultEditor: choices[0], legacyEditors: choiceById });
    const dialog = new EditorCloseDialog();
    const manager = new EditorManager(registry, initial.editor, dialog);

    const openRegions = $state({ primary: false, panel: false, secondary: false });
    let editor = $state.raw(manager.state);
    let content: ReturnType<typeof Content> | undefined = $state();
    let paletteOpen = $state(false);
    let desktop = $state.raw<DesktopRuntime>();
    let customTitlebar = $state(false);
    let panelView = $state("output");
    let notificationsOpen = $state(false);
    let appName = $state("Milo");
    let groupIndex = $derived(editor.groups.findIndex(({ id }) => id === editor.focusedGroupId));
    let active = $derived(activeTab(editor.groups[groupIndex]));
    let dirty = $derived(editor.groups.some((group) => group.tabs.some((tab) => tab.dirty)));
    let modal = $derived(!!(dialog.prompt || dialog.failure));

    const activities = activityRegistry();
    activities.register({
        id: "milo.workbench.views",
        owner: "milo.workbench",
        title: "workbench.views",
        icon: LayoutGrid,
        navigation: builtinChoices.map((choice) => ({
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
                isActive: () => openRegions.panel && panelView === "tasks",
            },
        ],
    });

    let selectedActivityId = $state<string>();
    let activity = $derived($activities.find(({ id }) => id === selectedActivityId) ?? $activities[0]);
    const selectActivity = (selected: Activity) => {
        selectedActivityId = selected.id;
        if (selected.navigation.length) content?.setOpen("primary", true);
    };

    const open = (id: string) => {
        const choice = choiceById.get(id);
        if (choice) manager.open(choice);
    };
    const toggleRegion = (region: ResizableRegion) => {
        content?.setOpen(region, !openRegions[region]);
    };
    const showPanel = (view: "output" | "tasks") => {
        panelView = view;
        content?.setOpen("panel", true);
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
        isOpen: (region) => openRegions[region],
    });

    const systemMenu = registerSystemMenu(menu, {
        settings: () => open("settings"),
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

    onMount(() => () => {
        systemMenu.dispose();
        disposeSettings();
    });
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
        ...choices.map((choice) => ({
            id: "open." + choice.id,
            label: $t("workbench.command.open", $t(choice.title)),
            icon: choice.icon,
            run: () => manager.open(choice),
        })),
        ...resizableRegions.map((region) => ({
            id: "toggle." + region,
            label: $t(
                openRegions[region] ? "workbench.command.hide" : "workbench.command.show",
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

{#snippet paneButton(region: ResizableRegion)}
    {@const Icon = paneIcons[region]}
    {@const label = $t("workbench." + region)}
    <Button
        size="icon-xs"
        variant="ghost"
        title={label}
        aria-label={label}
        aria-controls={region}
        aria-pressed={openRegions[region]}
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

<Sidebar.Provider class="flex-1">
    <LeftSidebar
        activities={$activities}
        activeId={activity?.id}
        select={selectActivity}
        openSettings={() => open("settings")}
    />
    <Content
        bind:this={content}
        initialPanes={initial.panes}
        legacySplitSize={initial.legacySplitSize}
        {openRegions}
        {activity}
        {manager}
        {editor}
        {choices}
        onvisibilitychange={(region, open) => (openRegions[region] = open)}
    >
        {#snippet panel()}<SystemPanel bind:view={panelView} />{/snippet}
    </Content>
</Sidebar.Provider>

<SystemFooter
    title={active ? $t(active.title) : $t("pane.empty.title")}
    group={editor.groups.length > 1 ? groupIndex + 1 : undefined}
    dirty={active?.dirty}
    bind:notificationsOpen
    openTasks={() => showPanel("tasks")}
/>

<Command bind:open={paletteOpen} {commands} />

<CloseDialog {dialog} />
