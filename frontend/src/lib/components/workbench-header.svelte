<script lang="ts" module>
    import { PanelBottom, PanelLeft, PanelRight } from "@lucide/svelte";

    export const paneIcons = { primary: PanelLeft, panel: PanelBottom, secondary: PanelRight };
</script>

<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Tooltip from "$lib/components/ui/tooltip";
    import type { ResizableRegion } from "$lib/state";
    import { t } from "$lib/i18n";
    import { Copy, Minus, Search, Square, X } from "@lucide/svelte";
    import mark from "./milo-mark.svg";
    import type { Snippet } from "svelte";

    interface Props {
        appName: string;
        desktop?: typeof import("@wailsio/runtime");
        customTitlebar: boolean;
        openPalette: () => void;
        paletteShortcut: string;
        applicationMenu: Snippet;
        openRegions: Readonly<Record<ResizableRegion, boolean>>;
        toggleRegion: (region: ResizableRegion) => void;
    }

    let {
        appName,
        desktop,
        customTitlebar,
        openPalette,
        paletteShortcut,
        applicationMenu,
        openRegions,
        toggleRegion,
    }: Props = $props();
    let header: HTMLElement;
    let maximized = $state(false);

    const layoutOrder: readonly ResizableRegion[] = ["primary", "panel", "secondary"];
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
</script>

{#snippet control(
    label: string,
    Icon: typeof PanelLeft,
    run: () => void,
    region?: ResizableRegion,
    destructive = false
)}
    <Tooltip.Root>
        <Tooltip.Trigger>
            {#snippet child({ props })}
                <Button
                    {...props}
                    size="icon-xs"
                    variant="ghost"
                    aria-label={label}
                    aria-controls={region}
                    aria-pressed={region ? openRegions[region] : undefined}
                    class={[
                        "aria-pressed:border-input aria-pressed:bg-background size-7 rounded-sm transition-none active:translate-y-0",
                        destructive && "hover:bg-destructive dark:hover:bg-destructive hover:text-white",
                    ]}
                    onclick={run}
                >
                    <Icon class="size-3.5" />
                </Button>
            {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom" sideOffset={4} class="data-closed:animate-none data-open:animate-none">
            {label}
        </Tooltip.Content>
    </Tooltip.Root>
{/snippet}

<Tooltip.Provider>
    <header
        bind:this={header}
        data-region="header"
        class:frameless={customTitlebar}
        class="bg-sidebar grid h-9 shrink-0 grid-cols-[1fr_minmax(0,18rem)_1fr] items-center gap-2 border-b px-2 select-none"
    >
        <div class="flex min-w-max items-center gap-1.5">
            <div class="bg-primary grid size-5 shrink-0 place-items-center rounded-sm">
                <img src={mark} alt={appName} class="size-5 invert dark:invert-0" />
            </div>
            <div data-header-control>
                {@render applicationMenu()}
            </div>
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
        <div class="flex min-w-max items-center gap-0.5 justify-self-end" data-header-control>
            {#each layoutOrder as region (region)}
                {@render control($t("workbench." + region), paneIcons[region], () => toggleRegion(region), region)}
            {/each}
            {#if desktop && customTitlebar}
                {@const Window = desktop.Window}
                {@const maximizeLabel = $t(maximized ? "workbench.window.restore" : "workbench.window.maximize")}
                {@render control($t("workbench.window.minimize"), Minus, () => void Window.Minimise().catch(report))}
                {@render control(
                    maximizeLabel,
                    maximized ? Copy : Square,
                    () => void Window.ToggleMaximise().catch(report)
                )}
                {@render control(
                    $t("workbench.window.close"),
                    X,
                    () => void Window.Close().catch(report),
                    undefined,
                    true
                )}
            {/if}
        </div>
    </header>
</Tooltip.Provider>

<style>
    .frameless {
        --wails-draggable: drag;
    }

    :global([data-header-control]) {
        --wails-draggable: no-drag;
    }
</style>
