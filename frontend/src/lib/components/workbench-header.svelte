<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { t } from "$lib/i18n";
    import { Copy, Minus, Search, Square, X } from "@lucide/svelte";
    import type { Snippet } from "svelte";

    interface Props {
        appName: string;
        desktop?: typeof import("@wailsio/runtime");
        customTitlebar: boolean;
        openPalette: () => void;
        paletteShortcut: string;
        layoutControls: Snippet;
    }

    let { appName, desktop, customTitlebar, openPalette, paletteShortcut, layoutControls }: Props = $props();
    let header: HTMLElement;
    let maximized = $state(false);

    const report = (error: unknown) => console.error("Could not control the window", error);

    $effect(() => {
        if (!desktop || !customTitlebar) return;
        const { Events, Window } = desktop;
        let observed = false;
        let disposed = false;

        const offMaximize = Events.On(Events.Types.Common.WindowMaximise, () => {
            observed = true;
            maximized = true;
        });
        const offRestore = Events.On(Events.Types.Common.WindowUnMaximise, () => {
            observed = true;
            maximized = false;
        });
        void Window.IsMaximised()
            .then((value) => {
                if (!disposed && !observed) maximized = value;
            })
            .catch(report);

        const doubleClick = (event: MouseEvent) => {
            if (
                event.button === 0 &&
                event.target instanceof Element &&
                !event.target.closest("[data-header-control]")
            ) {
                void Window.ToggleMaximise().catch(report);
            }
        };
        header.addEventListener("dblclick", doubleClick);
        return () => {
            disposed = true;
            offMaximize();
            offRestore();
            header.removeEventListener("dblclick", doubleClick);
        };
    });

    const windowControl = "h-7 w-8 rounded-sm transition-none active:translate-y-0";
</script>

<header
    bind:this={header}
    data-region="header"
    class:frameless={customTitlebar}
    class="bg-sidebar grid h-9 shrink-0 grid-cols-[1fr_minmax(0,18rem)_1fr] items-center gap-2 border-b px-2 select-none"
>
    <div class="flex min-w-max items-center gap-1.5">
        <span
            class="bg-primary text-primary-foreground grid size-5 place-items-center rounded-sm text-xs font-bold"
            aria-hidden="true"
        >
            M
        </span>
        <span class="text-xs font-semibold">{appName}</span>
    </div>
    <Button
        data-header-control
        variant="outline"
        size="xs"
        class="min-w-0 justify-center gap-2 rounded-sm shadow-none transition-none active:translate-y-0"
        title={`${$t("workbench.command")} (${paletteShortcut})`}
        aria-haspopup="dialog"
        onclick={openPalette}
    >
        <Search />
        <span class="truncate">{$t("workbench.command")}</span>
        <kbd class="text-muted-foreground hidden text-xs lg:inline">{paletteShortcut}</kbd>
    </Button>
    <div class="flex min-w-max items-center justify-self-end">
        <div data-header-control class="flex items-center gap-0.5">
            {@render layoutControls()}
        </div>
        {#if desktop && customTitlebar}
            {@const Window = desktop.Window}
            {@const maximizeLabel = $t(maximized ? "workbench.window.restore" : "workbench.window.maximize")}
            <div data-header-control class="ml-1.5 flex items-center border-l pl-1.5">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    class={windowControl}
                    title={$t("workbench.window.minimize")}
                    aria-label={$t("workbench.window.minimize")}
                    onclick={() => void Window.Minimise().catch(report)}
                >
                    <Minus />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    class={windowControl}
                    title={maximizeLabel}
                    aria-label={maximizeLabel}
                    onclick={() => void Window.ToggleMaximise().catch(report)}
                >
                    {#if maximized}<Copy />{:else}<Square />{/if}
                </Button>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    class={`${windowControl} hover:bg-destructive dark:hover:bg-destructive hover:text-white`}
                    title={$t("workbench.window.close")}
                    aria-label={$t("workbench.window.close")}
                    onclick={() => void Window.Close().catch(report)}
                >
                    <X />
                </Button>
            </div>
        {/if}
    </div>
</header>

<style>
    .frameless {
        --wails-draggable: drag;
    }

    :global([data-header-control]) {
        --wails-draggable: no-drag;
    }
</style>
