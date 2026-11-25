<script lang="ts">
    import { activityRegistry, type Activity } from "$lib/activities";
    import AppMenu from "$lib/components/app-menu.svelte";
    import Command from "$lib/components/command.svelte";
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
    import { focusFlags, provideActions } from "$lib/modules/action/context";
    import { actionIDs, editorOpenAction, paneAction, workbenchOwner } from "$lib/modules/action/ids";
    import {
        ActionRegistry,
        titleOf,
        type Action,
        type ActionLayer,
        type ContextFlag,
    } from "$lib/modules/action/registry";
    import { bindShortcuts } from "$lib/modules/action/shortcuts";
    import { connectCommandBackend } from "$lib/modules/command-backend";
    import SystemFooter from "$lib/modules/footer.svelte";
    import SystemPanel from "$lib/modules/panel.svelte";
    import { registerBuiltinSearch } from "$lib/modules/search/builtins";
    import { SearchRegistry } from "$lib/modules/search/registry";
    import SettingsDialog from "$lib/modules/settings/settings-dialog.svelte";
    import { settings } from "$lib/modules/settings/state";
    import SettingsTheme from "$lib/modules/settings/theme.svelte";
    import { loadWorkbench, resizableRegions, saveWorkbench, type ResizableRegion } from "$lib/state";
    import { registerEditorActions } from "$lib/workbench-editor-actions";
    import { registerWorkbenchMenu } from "$lib/workbench-menu";
    import {
        Bell,
        Columns2,
        LayoutGrid,
        ListTodo,
        MoveHorizontal,
        Redo2,
        Search,
        Settings,
        Terminal,
        Undo2,
        X,
    } from "@lucide/svelte";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";

    const registry = new EditorRegistry();
    const choices = registerBuiltinEditors(registry);
    const initial = loadWorkbench({
        registry,
        defaultEditor: choices[0],
        legacyEditors: new Map(choices.map((choice) => [choice.id, choice])),
    });
    const dialog = new EditorCloseDialog();
    const manager = new EditorManager(registry, initial.editor, dialog);

    let editor = $state.raw(manager.state);
    let layout: ReturnType<typeof WorkbenchLayout> | undefined = $state();
    let paletteOpen = $state(false);
    let query = $state("");
    let paletteOrigin = $state.raw<HTMLElement>();
    let settingsOpen = $state(false);
    let selectedCategory = $state("general");
    let desktop = $state.raw<DesktopRuntime>();
    let customTitlebar = $state(false);
    let panelView = $state("output");
    let notificationsOpen = $state(false);
    let appName = $state("Milo");
    let groupIndex = $derived(editor.groups.findIndex(({ id }) => id === editor.focusedGroupId));
    let active = $derived(activeTab(editor.groups[groupIndex]));
    let dirty = $derived(editor.groups.some((group) => group.tabs.some((tab) => tab.dirty)));
    let modal = $derived(settingsOpen || !!(dialog.prompt || dialog.failure));

    const actions = new ActionRegistry(
        () => {
            const focused = document.activeElement;
            const layer: ActionLayer =
                modal ||
                (!paletteOpen && !!focused?.closest('[role="dialog"][aria-modal="true"], [role="alertdialog"]'))
                    ? "modal"
                    : paletteOpen
                      ? query.startsWith(">")
                          ? "command"
                          : "search"
                      : "workbench";
            const flags: ContextFlag[] = [layer, ...focusFlags(focused)];
            if (layer === "command" || layer === "search") flags.push("workbench");
            if (groupIndex >= 0) flags.push("group");
            if (active) flags.push("editor");
            if (editor.groups.length > 1) flags.push("multiple-groups");
            return { layer, flags };
        },
        (failure, id, title) => {
            if (failure === "failed") console.error("Action failed", id);
            const label = title ? titleOf(title, $t) : id;
            toast.error($t("workbench.action." + failure, label));
        }
    );
    provideActions(actions);
    const searches = new SearchRegistry();

    const isRegionOpen = (region: ResizableRegion) => layout?.isOpen(region) ?? false;
    const showPanel = (view: "output" | "tasks") => {
        panelView = view;
        layout?.setOpen("panel", true);
    };
    const openCenter = (mode: "command" | "search") => {
        if (!paletteOpen) {
            const focused = document.activeElement;
            paletteOrigin = focused instanceof HTMLElement ? focused : undefined;
        }
        query = mode === "command" ? ">" : "";
        paletteOpen = true;
    };

    const register = (action: Action) =>
        actions.register({
            available: ({ layer }) => layer !== "modal",
            ...action,
        });
    const disposers = [
        registerEditorActions(actions, manager, () => editor, choices, {
            [actionIDs.split]: Columns2,
            [actionIDs.focusOther]: MoveHorizontal,
            [actionIDs.moveGroup]: MoveHorizontal,
            [actionIDs.nextTab]: Redo2,
            [actionIDs.previousTab]: Undo2,
            [actionIDs.closeTab]: X,
            [actionIDs.reopenTab]: Undo2,
            [actionIDs.closeGroup]: X,
        }),
        register({
            id: actionIDs.commands,
            owner: workbenchOwner,
            title: "workbench.command",
            icon: Search,
            binding: { key: "p", shift: true, editable: true },
            listed: false,
            run: () => openCenter("command"),
        }),
        register({
            id: actionIDs.search,
            owner: workbenchOwner,
            title: "workbench.search",
            icon: Search,
            binding: { key: "p", editable: true },
            listed: false,
            run: () => openCenter("search"),
        }),
        register({
            id: actionIDs.settings,
            owner: "milo.settings",
            title: (t) => t("workbench.command.open", t("tab.settings")),
            icon: Settings,
            delegates: [workbenchOwner],
            validate: (args) => {
                if (!Object.keys(args).length) return true;
                const state = $settings;
                return (
                    Object.keys(args).length === 1 &&
                    state.status === "ready" &&
                    !!state.value.entries?.some(({ schema }) => schema.category === args.category)
                );
            },
            run: ({ category }) => {
                if (category) selectedCategory = category;
                settingsOpen = true;
            },
        }),
        register({
            id: actionIDs.output,
            owner: "milo.logger",
            title: "output.title",
            icon: Terminal,
            delegates: [workbenchOwner],
            run: () => showPanel("output"),
        }),
        register({
            id: actionIDs.tasks,
            owner: "milo.task",
            title: "task.title",
            icon: ListTodo,
            delegates: ["*"],
            run: () => showPanel("tasks"),
        }),
        register({
            id: actionIDs.notifications,
            owner: "milo.notify",
            title: "notify.title",
            icon: Bell,
            delegates: [workbenchOwner],
            run: () => {
                notificationsOpen = true;
            },
        }),
        register({
            id: actionIDs.quit,
            owner: workbenchOwner,
            title: "workbench.menu.quit",
            icon: X,
            available: ({ layer }) => layer !== "modal" && !!desktop,
            run: () => desktop?.Application.Quit(),
        }),
        ...resizableRegions.map((region) =>
            register({
                id: paneAction(region),
                owner: workbenchOwner,
                icon: paneIcons[region],
                title: (t) =>
                    t(
                        isRegionOpen(region) ? "workbench.command.hide" : "workbench.command.show",
                        t("workbench." + region)
                    ),
                enabled: () => !!layout,
                run: () => layout?.toggle(region),
            })
        ),
        registerBuiltinSearch(
            searches,
            actions,
            () => $actions,
            choices,
            () => editor,
            () => $settings,
            () => $t
        ),
    ];

    const activities = activityRegistry();
    disposers.push(
        activities.register({
            id: "milo.workbench.views",
            owner: workbenchOwner,
            title: "workbench.views",
            icon: LayoutGrid,
            navigation: choices.map((choice) => ({
                ...choice,
                action: { id: editorOpenAction(choice.id), args: { preview: "true" } },
                isActive: () => active?.editorTypeId === choice.editorTypeId && active.resource === choice.resource,
            })),
        })
    );
    disposers.push(
        activities.register({
            id: "milo.task.activity",
            owner: "milo.task",
            title: "task.title",
            icon: ListTodo,
            navigation: [
                {
                    id: actionIDs.tasks,
                    title: "task.title",
                    icon: ListTodo,
                    action: { id: actionIDs.tasks },
                    isActive: () => isRegionOpen("panel") && panelView === "tasks",
                },
            ],
        })
    );

    let selectedActivityId = $state<string>();
    let activity = $derived($activities.find(({ id }) => id === selectedActivityId) ?? $activities[0]);
    const selectActivity = (selected: Activity) => {
        selectedActivityId = selected.id;
        if (selected.navigation.length) layout?.setOpen("primary", true);
    };
    const menu = new MenuRegistry();
    disposers.push(registerWorkbenchMenu(menu, () => !!desktop, isRegionOpen));

    $effect(() => saveWorkbench(editor, registry, initial.legacySplitSize));
    $effect(() => {
        if (!dirty || location.protocol === "wails:") return;
        const confirmUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", confirmUnload);
        return () => window.removeEventListener("beforeunload", confirmUnload);
    });

    onMount(() => {
        const disconnect = connectCommandBackend(actions, searches);
        const unbind = bindShortcuts(actions);
        const unsubscribe = manager.subscribe((workspace) => (editor = workspace));
        return () => {
            disconnect?.();
            unbind();
            unsubscribe();
            for (const dispose of disposers.reverse()) dispose();
        };
    });

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
</script>

<svelte:head>
    <title>{active ? `${$t(active.title)} | ${appName}` : appName}</title>
</svelte:head>
<SettingsTheme />

<div class="contents" inert={paletteOpen}>
    <WorkbenchHeader {appName} {desktop} {customTitlebar} {isRegionOpen}>
        {#snippet applicationMenu()}<AppMenu {menu} />{/snippet}
    </WorkbenchHeader>

    <WorkbenchLayout
        bind:this={layout}
        initialPanes={initial.panes}
        legacySplitSize={initial.legacySplitSize}
        activities={$activities}
        {activity}
        {selectActivity}
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
    />
</div>

<Command bind:open={paletteOpen} bind:query {searches} origin={paletteOrigin} />

<SettingsDialog bind:open={settingsOpen} bind:selectedCategory />

<CloseDialog {dialog} />
