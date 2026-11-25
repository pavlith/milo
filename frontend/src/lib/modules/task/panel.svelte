<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Progress } from "$lib/components/ui/progress";
    import { t } from "$lib/i18n";
    import { Ban, CircleAlert, CircleCheck, Hourglass } from "@lucide/svelte";
    import type { Task } from "../../../../bindings/milo.local/platform/modules/task/models";
    import { taskAPI, tasks } from "./state";
    import { percent } from "./tasks";

    let active = $derived($tasks.status === "ready" ? ($tasks.value.active ?? []) : []);
    let completed = $derived($tasks.status === "ready" ? ($tasks.value.completed ?? []) : []);
    let failure = $state("");
    const icons = { "": Hourglass, running: Hourglass, succeeded: CircleCheck, failed: CircleAlert, cancelled: Ban };

    async function cancel(item: Task) {
        failure = "";
        try {
            await (await taskAPI()).Cancel(item.id, item.run);
        } catch (cause) {
            failure = String(cause);
        }
    }
</script>

<div class="h-full overflow-auto px-3 py-2 text-xs">
    {#if $tasks.status === "loading"}
        <p class="text-muted-foreground" role="status">{$t("system.loading")}</p>
    {:else if $tasks.status === "error"}
        <p class="text-destructive" role="alert">{$t($tasks.error)}</p>
    {:else}
        {#if failure}<p class="text-destructive pb-2" role="alert">{failure}</p>{/if}
        <h3 class="pb-1 font-semibold">{$t("task.active")}</h3>
        <ul class="divide-y">
            {#each active as item (item.run)}
                <li class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2">
                    <div class="min-w-0">
                        <p class="text-sm font-medium break-words">{item.title}</p>
                        {#if item.description}<p class="text-muted-foreground break-words">{item.description}</p>{/if}
                        <p class="text-muted-foreground">
                            {item.owner} ·
                            <time datetime={item.started}>{new Date(item.started).toLocaleTimeString()}</time>
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        {#if item.cancellationRequested}
                            <span>{$t("task.cancelling")}</span>
                        {:else if item.canCancel}
                            <Button
                                size="xs"
                                variant="outline"
                                aria-label={$t("task.cancelNamed", item.title)}
                                onclick={() => cancel(item)}
                            >
                                {$t("system.cancel")}
                            </Button>
                        {/if}
                        <span class="text-muted-foreground min-w-9 text-right tabular-nums">
                            {item.progress == null ? $t("task.working") : percent(item.progress) + "%"}
                        </span>
                    </div>
                    <Progress
                        class="col-span-2 h-1"
                        aria-label={$t("task.progressNamed", item.title)}
                        value={item.progress == null ? undefined : percent(item.progress)}
                        indeterminate={item.progress == null}
                    />
                </li>
            {:else}
                <li class="text-muted-foreground py-1">{$t("task.noneActive")}</li>
            {/each}
        </ul>
        <h3 class="mt-3 border-t pt-2 pb-1 font-semibold">{$t("task.recent")}</h3>
        <ul class="divide-y">
            {#each completed.toReversed() as item (item.run)}
                {@const Icon = icons[item.status]}
                <li class="flex items-start gap-2 py-2">
                    <Icon
                        class="mt-0.5 size-4 shrink-0 {item.status === 'failed'
                            ? 'text-destructive'
                            : 'text-muted-foreground'}"
                    />
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium break-words">{item.title}</p>
                        <p class="text-muted-foreground">
                            {item.owner} · {$t("task.status." + item.status)}
                            {#if item.completed}
                                · <time datetime={item.completed}>
                                    {new Date(item.completed).toLocaleString()}
                                </time>{/if}
                        </p>
                        {#if item.errorSummary}<p class="text-destructive break-words">{item.errorSummary}</p>{/if}
                    </div>
                </li>
            {:else}
                <li class="text-muted-foreground py-1">{$t("task.noneRecent")}</li>
            {/each}
        </ul>
    {/if}
</div>
