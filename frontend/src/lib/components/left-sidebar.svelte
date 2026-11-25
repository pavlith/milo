<script lang="ts">
    import type { Activity } from "$lib/activities";
    import * as Popover from "$lib/components/ui/popover";
    import * as Sidebar from "$lib/components/ui/sidebar";
    import { useActions } from "$lib/modules/action/context";
    import { actionIDs } from "$lib/modules/action/ids";
    import { t } from "$lib/i18n";
    import { LayoutGrid, Settings, UserRound } from "@lucide/svelte";

    let {
        activities,
        activeId,
        select,
    }: {
        activities: readonly Activity[];
        activeId?: string;
        select: (activity: Activity) => void;
    } = $props();
    const actions = useActions();
    const buttonClass =
        "relative h-9 justify-center rounded-md p-0 text-sidebar-foreground/70 hover:text-sidebar-foreground data-active:text-sidebar-foreground [&_svg]:size-5";
    const activityButtonClass = `${buttonClass} data-active:before:bg-sidebar-foreground data-active:before:absolute data-active:before:inset-y-2 data-active:before:start-0 data-active:before:w-0.5 data-active:before:rounded-full`;
</script>

<Sidebar.Root data-region="left" class="w-(--sidebar-width-icon) shrink-0 border-e">
    <Sidebar.Content>
        <Sidebar.Group class="px-1.5 py-2" role="navigation" aria-label={$t("workbench.left")}>
            <Sidebar.GroupContent>
                <Sidebar.Menu class="gap-1">
                    {#each activities as activity (activity.id)}
                        {@const Icon = activity.icon ?? LayoutGrid}
                        {@const label = $t(activity.title)}
                        <Sidebar.MenuItem>
                            <Sidebar.MenuButton
                                class={activityButtonClass}
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
    <Sidebar.Footer class="shrink-0 px-1.5 py-2">
        <Sidebar.Menu class="gap-1">
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
                    <Popover.PopoverContent
                        side="right"
                        align="end"
                        sideOffset={8}
                        class="w-auto gap-1 px-3 py-2 text-sm"
                    >
                        <p class="font-medium">{$t("workbench.userSpace")}</p>
                        <p class="text-muted-foreground">{$t("workbench.guest")}</p>
                    </Popover.PopoverContent>
                </Popover.Popover>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem>
                <Sidebar.MenuButton
                    class={buttonClass}
                    aria-label={$t("tab.settings")}
                    aria-haspopup="dialog"
                    tooltipContent={$t("tab.settings")}
                    onclick={() => void actions.invoke({ id: actionIDs.settings })}
                >
                    <Settings />
                </Sidebar.MenuButton>
            </Sidebar.MenuItem>
        </Sidebar.Menu>
    </Sidebar.Footer>
</Sidebar.Root>
