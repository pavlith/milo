<script lang="ts">
    import type { Activity } from "$lib/activities";
    import * as Popover from "$lib/components/ui/popover";
    import * as Sidebar from "$lib/components/ui/sidebar";
    import { t } from "$lib/i18n";
    import { LayoutGrid, Settings, UserRound } from "@lucide/svelte";

    let {
        activities,
        activeId,
        select,
        openSettings,
    }: {
        activities: readonly Activity[];
        activeId?: string;
        select: (activity: Activity) => void;
        openSettings: () => void;
    } = $props();
    const buttonClass = "justify-center p-0";
</script>

<Sidebar.Root data-region="left" class="w-(--sidebar-width-icon) shrink-0 border-e">
    <Sidebar.Content>
        <Sidebar.Group role="navigation" aria-label={$t("workbench.left")}>
            <Sidebar.GroupContent>
                <Sidebar.Menu>
                    {#each activities as activity (activity.id)}
                        {@const Icon = activity.icon ?? LayoutGrid}
                        {@const label = $t(activity.title)}
                        <Sidebar.MenuItem>
                            <Sidebar.MenuButton
                                class={buttonClass}
                                isActive={activeId === activity.id}
                                aria-pressed={activeId === activity.id}
                                aria-controls={activity.navigation.length ? "primary" : undefined}
                                aria-label={label}
                                tooltipContent={label}
                                onclick={() => select(activity)}
                            >
                                <Icon />
                            </Sidebar.MenuButton>
                        </Sidebar.MenuItem>
                    {/each}
                </Sidebar.Menu>
            </Sidebar.GroupContent>
        </Sidebar.Group>
    </Sidebar.Content>
    <Sidebar.Footer>
        <Sidebar.Menu>
            <Sidebar.MenuItem>
                <Popover.Popover>
                    <Popover.PopoverTrigger>
                        {#snippet child({ props })}
                            <Sidebar.MenuButton
                                {...props}
                                class={buttonClass}
                                aria-label={$t("workbench.userSpace")}
                                tooltipContent={$t("workbench.userSpace")}
                            >
                                <UserRound />
                            </Sidebar.MenuButton>
                        {/snippet}
                    </Popover.PopoverTrigger>
                    <Popover.PopoverContent side="right" align="end" class="w-auto text-sm">
                        <p class="font-medium">{$t("workbench.userSpace")}</p>
                        <p class="text-muted-foreground">{$t("workbench.guest")}</p>
                    </Popover.PopoverContent>
                </Popover.Popover>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem>
                <Sidebar.MenuButton
                    class={buttonClass}
                    aria-label={$t("tab.settings")}
                    tooltipContent={$t("tab.settings")}
                    onclick={openSettings}
                >
                    <Settings />
                </Sidebar.MenuButton>
            </Sidebar.MenuItem>
        </Sidebar.Menu>
    </Sidebar.Footer>
</Sidebar.Root>
