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
    import type { CloseType, TabDirection } from "$lib/tab";
    import { Pin, X, type LucideProps } from "@lucide/svelte";
    import type { Component } from "svelte";

    interface Props {
        name: string;
        icon?: Component<LucideProps>;
        active: boolean;
        pinned: boolean;
        canMoveLeft: boolean;
        canMoveRight: boolean;
        onclick: () => void;
        onclose: (type: CloseType) => void;
        onpin: (pinned: boolean) => void;
        onmove: (direction: TabDirection) => void;
    }

    let {
        name,
        icon: Icon,
        active,
        pinned,
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
                    active ? "border-t-primary bg-background" : "hover:bg-muted"
                )}
            >
                <button
                    bind:this={button}
                    type="button"
                    class="focus-visible:ring-ring flex h-full min-w-0 items-center gap-1.5 px-2.5 text-sm focus-visible:ring-1 focus-visible:ring-inset focus-visible:outline-none"
                    aria-pressed={active}
                    {onclick}
                >
                    {#if Icon}<Icon size={15} class="text-muted-foreground shrink-0" />{/if}
                    <span class="truncate">{name}</span>
                    {#if pinned}
                        <Pin size={12} class="text-muted-foreground shrink-0" aria-label={$t("workbench.tab.pinned")} />
                    {/if}
                </button>
                <button
                    type="button"
                    class="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring mr-1 flex size-5 shrink-0 items-center justify-center rounded-sm focus-visible:ring-1 focus-visible:outline-none"
                    aria-label={$t("workbench.tab.close", name)}
                    onclick={() => onclose("self")}
                >
                    <X size={14} />
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
        <ContextMenuItem disabled={!canMoveLeft} onSelect={() => onmove(-1)}
            >{$t("workbench.tab.moveLeft")}</ContextMenuItem
        >
        <ContextMenuItem disabled={!canMoveRight} onSelect={() => onmove(1)}
            >{$t("workbench.tab.moveRight")}</ContextMenuItem
        >
    </ContextMenuContent>
</ContextMenu>
