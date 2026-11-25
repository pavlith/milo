<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import * as Popover from "$lib/components/ui/popover";
    import { Toaster } from "$lib/components/ui/sonner";
    import { useActions } from "$lib/modules/action/context";
    import { actionIDs } from "$lib/modules/action/ids";
    import { titleOf } from "$lib/modules/action/registry";
    import { t } from "$lib/i18n";
    import { Bell, Check, CircleAlert, CircleCheck, Info, TriangleAlert, X } from "@lucide/svelte";
    import { onDestroy } from "svelte";
    import { actionReference } from "../command-backend";
    import { resolveTheme } from "../settings/color-mode";
    import { preference, settings, themeID } from "../settings/state";
    import { notificationAPI, notificationStore } from "./state";

    let { open = $bindable(false) }: { open?: boolean } = $props();
    const actions = useActions();
    const { notifications, dispose } = notificationStore(actions);
    onDestroy(dispose);
    let error = $state("");
    let items = $derived($notifications.status === "ready" ? ($notifications.value.items ?? []) : []);
    let unread = $derived(items.filter(({ read }) => !read).length);
    let theme = $derived(resolveTheme(preference($settings, themeID)?.value.text));
    const icons = { "": Info, info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert };

    async function change(run: (api: Awaited<ReturnType<typeof notificationAPI>>) => PromiseLike<void>) {
        error = "";
        try {
            await run(await notificationAPI());
        } catch (cause) {
            error = String(cause);
        }
    }
</script>

<Popover.Root
    bind:open={
        () => open,
        (next) => {
            if (next) void actions.invoke({ id: actionIDs.notifications });
            else open = false;
        }
    }
>
    <Popover.Trigger
        aria-label={unread ? $t("notify.unread", unread) : $t("notify.title")}
        title={unread ? $t("notify.unread", unread) : $t("notify.title")}
        class="hover:bg-accent focus-visible:ring-ring flex h-5 items-center gap-1 rounded-sm px-1.5 focus-visible:ring-1"
    >
        <Bell class="size-3.5" />
        {#if unread}<span
                class="bg-foreground text-background min-w-4 rounded-full px-1 text-center text-[10px] leading-4 tabular-nums"
            >
                {unread}
            </span>{/if}
    </Popover.Trigger>
    <Popover.Content
        side="top"
        align="end"
        class="w-[min(27rem,calc(100vw-1.5rem))] gap-0 p-0"
        aria-label={$t("notify.title")}
    >
        <div class="flex flex-wrap items-center justify-between gap-1 border-b px-3 py-2">
            <Popover.Title class="font-semibold">{$t("notify.title")}</Popover.Title>
            <div class="flex gap-1">
                <Button size="xs" variant="ghost" disabled={!unread} onclick={() => change((api) => api.MarkAllRead())}>
                    {$t("notify.markAll")}
                </Button>
                <Button size="xs" variant="ghost" disabled={!items.length} onclick={() => change((api) => api.Clear())}>
                    {$t("notify.clear")}
                </Button>
            </div>
        </div>
        {#if error}<p role="alert" class="text-destructive px-3 py-2 text-xs">{error}</p>{/if}
        {#if $notifications.status === "loading"}
            <p role="status" class="px-3 py-3 text-xs">{$t("system.loading")}</p>
        {:else if $notifications.status === "error"}
            <p role="alert" class="text-destructive px-3 py-3 text-xs">{$t($notifications.error)}</p>
        {:else}
            <ul class="max-h-[min(26rem,60vh)] divide-y overflow-auto">
                {#each items.toReversed() as item (item.id)}
                    {@const Icon = icons[item.severity]}
                    <li class="flex items-start gap-2 px-3 py-2 {item.read ? '' : 'bg-muted/60'}">
                        <Icon aria-label={$t("notify.severity." + item.severity)} class="mt-0.5 size-4 shrink-0" />
                        <div class="min-w-0 flex-1">
                            <p class="font-medium break-words">{item.title}</p>
                            {#if item.description}<p
                                    class="text-muted-foreground text-xs break-words whitespace-pre-wrap"
                                >
                                    {item.description}
                                </p>{/if}
                            <div class="text-muted-foreground flex flex-wrap gap-x-2 pt-1 text-xs">
                                <span>{item.owner}</span>
                                <time datetime={item.time}>{new Date(item.time).toLocaleString()}</time>
                                {#if !item.read}<span>{$t("notify.new")}</span>{/if}
                            </div>
                            {#if item.actions?.length}
                                <div class="flex flex-wrap gap-1 pt-1">
                                    {#each item.actions as wire}
                                        {@const ref = actionReference(wire)}
                                        {@const action = $actions.find(({ id }) => id === ref.id)}
                                        {@const disabled = !action || actions.status(ref, item.owner) !== "enabled"}
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            {disabled}
                                            title={disabled ? $t("notify.actionUnavailable") : undefined}
                                            onclick={() => {
                                                open = false;
                                                void actions.invoke(ref, item.owner);
                                            }}
                                        >
                                            {action ? titleOf(action.title, $t) : $t("notify.actionUnavailable")}
                                        </Button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={item.read}
                            title={$t("notify.markRead")}
                            aria-label={$t("notify.markReadNamed", item.title)}
                            onclick={() => change((api) => api.MarkRead(item.id))}
                        >
                            <Check />
                        </Button>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            title={$t("notify.dismiss")}
                            aria-label={$t("notify.dismissNamed", item.title)}
                            onclick={() => change((api) => api.Dismiss(item.id))}
                        >
                            <X />
                        </Button>
                    </li>
                {:else}
                    <li class="text-muted-foreground px-3 py-4 text-xs">{$t("notify.empty")}</li>
                {/each}
            </ul>
        {/if}
    </Popover.Content>
</Popover.Root>
<Toaster {theme} closeButton position="bottom-right" />
