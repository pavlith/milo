<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { t } from "$lib/i18n";
    import {
        canMoveTab,
        closeTabs,
        focusTab,
        moveTab,
        pinTab,
        reorderTabs,
        type CloseType,
        type TabState,
    } from "$lib/tab";
    import { tick } from "svelte";
    import { dndzone, type DndEvent } from "svelte-dnd-action";
    import { PaneHeader, PaneHeaderItem } from "./header";
    import PaneMenu from "./menu.svelte";
    import RootPane from "./root.svelte";
    import { viewById } from "./views";

    interface Props {
        editor: TabState;
        onchange: (editor: TabState) => void;
        onopen: (id: string) => void;
    }

    interface DragItem {
        id: string;
        tabId: string;
        pinned: boolean;
    }

    let { editor, onchange, onopen }: Props = $props();
    let strip: HTMLDivElement | undefined = $state();
    let dragItems = $state.raw<DragItem[] | null>(null);
    let items = $derived(dragItems ?? editor.tabs.map((tab) => ({ ...tab, tabId: tab.id })));

    const finalizeMove = ({ detail }: CustomEvent<DndEvent<DragItem>>) => {
        dragItems = null;
        onchange(
            reorderTabs(
                editor,
                detail.items.map(({ id }) => id)
            )
        );
    };

    const close = async (id: string, type: CloseType = "self") => {
        const focused = document.activeElement?.closest<HTMLElement>("[data-tab]");
        const next = closeTabs(editor, id, type);
        onchange(next);

        if (focused && !next.tabs.some((tab) => tab.id === focused.dataset.tab)) {
            await tick();
            const replacement = strip?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
            (replacement ?? strip?.parentElement?.querySelector<HTMLButtonElement>("[data-open-tab]"))?.focus();
        }
    };
</script>

<div class="flex h-full w-full flex-col">
    <PaneHeader>
        <div
            bind:this={strip}
            class="scrollbar-none flex min-w-0 flex-1 overflow-x-auto"
            role="group"
            aria-label={$t("workbench.editor.tabs")}
            use:dndzone={{
                items,
                type: "workbench-tabs",
                dropTargetStyle: {},
                dropAnimationDisabled: true,
                useCursorForDetection: true,
                autoAriaDisabled: true,
                zoneTabIndex: -1,
                zoneItemTabIndex: -1,
            }}
            onconsider={({ detail }) => (dragItems = detail.items)}
            onfinalize={finalizeMove}
        >
            {#each items as item (item.id)}
                {@const view = viewById.get(item.tabId)}
                <div class="shrink-0" data-tab={item.tabId}>
                    <PaneHeaderItem
                        name={view ? $t(view.title) : item.tabId}
                        icon={view?.icon}
                        active={editor.activeId === item.tabId}
                        pinned={item.pinned}
                        canMoveLeft={canMoveTab(editor.tabs, item.tabId, -1)}
                        canMoveRight={canMoveTab(editor.tabs, item.tabId, 1)}
                        onclick={() => onchange(focusTab(editor, item.tabId))}
                        onclose={(type) => close(item.tabId, type)}
                        onpin={(pinned) => onchange(pinTab(editor, item.tabId, pinned))}
                        onmove={(direction) => onchange(moveTab(editor, item.tabId, direction))}
                    />
                </div>
            {/each}
        </div>
        <PaneMenu {onopen} />
    </PaneHeader>

    <div class="min-h-0 flex-1 overflow-auto">
        {#if editor.activeId}
            {@const id = editor.activeId}
            {#key id}
                <RootPane {id} onclose={() => close(id)} />
            {/key}
        {:else}
            <div class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <p class="text-muted-foreground text-sm">{$t("pane.empty.title")}</p>
                <Button size="sm" variant="outline" onclick={() => onopen("welcome")}
                    >{$t("workbench.openWelcome")}</Button
                >
            </div>
        {/if}
    </div>
</div>
