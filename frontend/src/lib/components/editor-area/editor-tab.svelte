<script lang="ts">
    import { cn } from "$lib/components/utils";
    import {
        ContextMenu,
        ContextMenuContent,
        ContextMenuItem,
        ContextMenuLabel,
        ContextMenuSeparator,
        ContextMenuTrigger,
    } from "$lib/components/ui/context-menu";
    import { t } from "$lib/i18n";
    import type { CloseMode, Direction } from "$lib/editors/model";
    import { Circle, Pin, X, type LucideProps } from "@lucide/svelte";
    import type { Component } from "svelte";

    interface Props {
        name: string;
        icon?: Component<LucideProps>;
        active: boolean;
        pinned: boolean;
        dirty?: boolean;
        preview?: boolean;
        focusedGroup?: boolean;
        tabId?: string;
        onpromote?: () => void;
        onnew?: () => void;
        onothergroup?: () => void;
        canMoveLeft: boolean;
        canMoveRight: boolean;
        onclick: () => void;
        onclose: (type: CloseMode) => void;
        onpin: (pinned: boolean) => void;
        onmove: (direction: Direction) => void;
    }

    let {
        name,
        icon: Icon,
        active,
        pinned,
        dirty = false,
        preview = false,
        focusedGroup = true,
        tabId,
        onpromote,
        onnew,
        onothergroup,
        canMoveLeft,
        canMoveRight,
        onclick,
        onclose,
        onpin,
        onmove,
    }: Props = $props();
    let button: HTMLButtonElement | undefined = $state();

    $effect(() => {
        if (active) button?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });

    const openContextMenu = (event: KeyboardEvent) => {
        if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;

        const target = event.currentTarget as HTMLElement;
        const { left, bottom } = target.getBoundingClientRect();
        event.preventDefault();
        target.dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: left, clientY: bottom })
        );
    };
</script>

<ContextMenu>
    <ContextMenuTrigger>
        {#snippet child({ props })}
            <div
                {...props}
                onkeydown={openContextMenu}
                role="group"
                aria-label={name}
                class={cn(
                    "flex h-full max-w-60 items-center border-t border-r border-t-transparent",
                    active
                        ? focusedGroup
                            ? "border-t-primary bg-background"
                            : "border-t-muted-foreground/60 bg-background"
                        : "hover:bg-muted"
                )}
            >
                <button
                    bind:this={button}
                    type="button"
                    class="focus-visible:ring-ring flex h-full min-w-0 items-center gap-1.5 px-2.5 text-sm focus-visible:ring-1 focus-visible:outline-none focus-visible:ring-inset"
                    aria-pressed={active}
                    aria-label={preview || dirty
                        ? `${name} · ${$t(dirty ? "workbench.editor.dirty" : "workbench.editor.preview")}`
                        : undefined}
                    data-editor-tab-button={tabId}
                    title={name}
                    ondblclick={onpromote}
                    {onclick}
                >
                    {#if Icon}<Icon size={15} class="text-muted-foreground shrink-0" />{/if}
                    <span class="truncate" class:italic={preview}>{name}</span>
                    {#if pinned}
                        <Pin size={12} class="text-muted-foreground shrink-0" aria-label={$t("workbench.tab.pinned")} />
                    {/if}
                </button>
                <button
                    type="button"
                    class="group/close text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring mr-1 flex size-5 shrink-0 items-center justify-center rounded-sm focus-visible:ring-1 focus-visible:outline-none"
                    aria-label={$t("workbench.tab.close", name)}
                    onclick={() => onclose("self")}
                >
                    {#if dirty}
                        <Circle
                            size={8}
                            class="fill-current group-hover/close:hidden group-focus-visible/close:hidden"
                        />
                    {/if}
                    <X
                        size={14}
                        class={dirty ? "hidden group-hover/close:block group-focus-visible/close:block" : undefined}
                    />
                </button>
            </div>
        {/snippet}
    </ContextMenuTrigger>
    <ContextMenuContent class="min-w-48">
        <ContextMenuLabel>{name}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onclose("self")}>{$t("pane.header.menu.close.self")}</ContextMenuItem>
        <ContextMenuItem onSelect={() => onclose("others")}>{$t("pane.header.menu.close.others")}</ContextMenuItem>
        <ContextMenuItem onSelect={() => onclose("right")}>{$t("pane.header.menu.close.right")}</ContextMenuItem>
        <ContextMenuItem onSelect={() => onclose("all")}>{$t("pane.header.menu.close.all")}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onpin(!pinned)}>
            {$t(pinned ? "pane.header.menu.unpin" : "pane.header.menu.pin")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!canMoveLeft} onSelect={() => onmove(-1)}>
            {$t("workbench.tab.moveLeft")}
        </ContextMenuItem>
        <ContextMenuItem disabled={!canMoveRight} onSelect={() => onmove(1)}>
            {$t("workbench.tab.moveRight")}
        </ContextMenuItem>
        {#if onothergroup || onnew || (preview && onpromote)}
            <ContextMenuSeparator />
            {#if preview && onpromote}
                <ContextMenuItem onSelect={onpromote}>{$t("workbench.editor.keepOpen")}</ContextMenuItem>
            {/if}
            {#if onnew}
                <ContextMenuItem onSelect={onnew}>{$t("workbench.editor.newInstance")}</ContextMenuItem>
            {/if}
            {#if onothergroup}
                <ContextMenuItem onSelect={onothergroup}>{$t("workbench.editor.moveGroup")}</ContextMenuItem>
            {/if}
        {/if}
    </ContextMenuContent>
</ContextMenu>
