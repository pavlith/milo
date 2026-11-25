<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/components/utils";
    import type { EditorManager } from "$lib/editors/manager";
    import { activeTab, type CloseMode, type EditorChoice, type EditorGroup } from "$lib/editors/model";
    import { t } from "$lib/i18n";
    import EditorRenderer from "./editor-renderer.svelte";
    import EditorTab from "./editor-tab.svelte";
    import { focusActiveEditor } from "./focus";
    import OpenEditorMenu from "./open-editor-menu.svelte";

    interface Props {
        manager: EditorManager;
        group: EditorGroup;
        choices: readonly EditorChoice[];
        focused: boolean;
        split: boolean;
        index: number;
        dragging: string | undefined;
        ondragtab: (id: string | undefined) => void;
    }

    const dragType = "application/x-milo-editor-tab";
    let { manager, group, choices, focused, split, index, dragging, ondragtab }: Props = $props();

    let active = $derived(activeTab(group));
    let dropBefore = $state<string | null>();
    let welcome = $derived(choices[0]);

    const close = async (mode: CloseMode, id: string) => {
        const focusedTab = document.activeElement?.closest<HTMLElement>("[data-tab]")?.dataset.tab;
        if (await manager.close(group.id, mode, id)) {
            if (focused && (!focusedTab || !manager.focusedGroup.tabs.some((tab) => tab.id === focusedTab))) {
                void focusActiveEditor(manager);
            }
        }
    };

    const startDrag = (event: DragEvent, id: string) => {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData(dragType, id);
        event.dataTransfer.effectAllowed = "move";
        ondragtab(id);
    };

    const insertionPoint = (event: DragEvent) => {
        const element = (event.target as Element | null)?.closest<HTMLElement>("[data-tab]");
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        const index = group.tabs.findIndex((tab) => tab.id === element.dataset.tab);
        return (event.clientX < bounds.x + bounds.width / 2 ? group.tabs[index] : group.tabs[index + 1])?.id ?? null;
    };

    const dragOver = (event: DragEvent) => {
        if (!dragging || !event.dataTransfer?.types.includes(dragType)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        dropBefore = insertionPoint(event);
    };

    const leave = (event: DragEvent) => {
        if (event.relatedTarget instanceof Node && (event.currentTarget as HTMLElement).contains(event.relatedTarget))
            return;
        dropBefore = undefined;
    };

    const drop = (event: DragEvent) => {
        const id = event.dataTransfer?.getData(dragType);
        if (!id || id !== dragging) return;
        event.preventDefault();
        const before = insertionPoint(event);
        manager.moveTab(id, group.id, before ?? undefined);
        dropBefore = undefined;
        ondragtab(undefined);
        void focusActiveEditor(manager);
    };
</script>

<section
    id={"editor-group-" + group.id}
    data-editor-group={group.id}
    data-focused={focused}
    aria-label={$t("workbench.editor.group", index + 1)}
    class="flex h-full min-w-0 flex-col"
    onfocusin={() => manager.focusGroup(group.id)}
    onpointerdown={() => manager.focusGroup(group.id)}
>
    <div class="bg-muted/50 flex h-9 min-h-9 w-full items-stretch border-b">
        <div
            class={cn(
                "flex min-w-0 flex-1 scrollbar-none overflow-x-auto",
                dragging && dropBefore !== undefined && "bg-accent",
                dragging && dropBefore === null && "shadow-[inset_-2px_0_var(--ring)]"
            )}
            role="group"
            aria-label={$t("workbench.editor.tabs")}
            ondragover={dragOver}
            ondragleave={leave}
            ondrop={drop}
        >
            {#each group.tabs as tab (tab.id)}
                <div
                    id={"editor-tab-" + tab.id}
                    class={cn("shrink-0", dragging && dropBefore === tab.id && "border-ring border-l-2")}
                    data-tab={tab.id}
                    role="presentation"
                    draggable="true"
                    ondragstart={(event) => startDrag(event, tab.id)}
                    ondragend={() => {
                        dropBefore = undefined;
                        ondragtab(undefined);
                    }}
                >
                    <EditorTab
                        tabId={tab.id}
                        name={$t(tab.title)}
                        icon={tab.icon}
                        active={group.activeId === tab.id}
                        focusedGroup={focused}
                        pinned={tab.pinned}
                        dirty={tab.dirty}
                        preview={tab.preview}
                        canMoveLeft={manager.canStepTab(group, tab.id, -1)}
                        canMoveRight={manager.canStepTab(group, tab.id, 1)}
                        onclick={() => manager.focusTab(tab.id)}
                        onclose={(mode) => close(mode, tab.id)}
                        onpin={(pinned) => manager.pin(tab.id, pinned)}
                        onmove={(direction) => manager.stepTab(tab.id, direction)}
                        onpromote={() => manager.promote(tab.id)}
                        onnew={tab.resource === undefined
                            ? undefined
                            : () => {
                                  manager.open(tab, { groupId: group.id, newInstance: true });
                                  void focusActiveEditor(manager);
                              }}
                        onothergroup={() => {
                            manager.moveToOtherGroup(tab.id);
                            void focusActiveEditor(manager);
                        }}
                    />
                </div>
            {/each}
        </div>

        <OpenEditorMenu
            {choices}
            onopen={(choice) => {
                manager.open(choice, { groupId: group.id });
                void focusActiveEditor(manager);
            }}
            onsplit={index === 0
                ? () => {
                      manager.focusGroup(group.id);
                      manager.splitRight();
                      void focusActiveEditor(manager);
                  }
                : undefined}
            onfocusother={split
                ? () => {
                      manager.focusGroup(group.id);
                      manager.focusOtherGroup();
                      void focusActiveEditor(manager);
                  }
                : undefined}
            onclosegroup={split
                ? async () => {
                      if (await manager.closeGroup(group.id)) void focusActiveEditor(manager);
                  }
                : undefined}
        />
    </div>

    <div class="@container/editor min-h-0 flex-1 overflow-auto">
        {#if active}
            {#key active.id}
                <EditorRenderer {manager} tab={active} onclose={() => close("self", active.id)} />
            {/key}
        {:else}
            <div class="flex h-full flex-col items-center justify-center gap-3 p-3 text-center">
                <p class="text-muted-foreground text-sm">{$t("pane.empty.title")}</p>
                {#if welcome}
                    <Button
                        size="sm"
                        variant="outline"
                        onclick={() => {
                            manager.open(welcome, { groupId: group.id });
                            void focusActiveEditor(manager);
                        }}
                    >
                        {$t("workbench.openWelcome")}
                    </Button>
                {/if}
            </div>
        {/if}
    </div>
</section>
