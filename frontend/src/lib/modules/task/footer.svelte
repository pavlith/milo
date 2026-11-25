<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Progress } from "$lib/components/ui/progress";
    import { t } from "$lib/i18n";
    import { ListTodo } from "@lucide/svelte";
    import { tasks } from "./state";
    import { aggregateProgress, percent } from "./tasks";

    let { onclick }: { onclick: () => void } = $props();
    let active = $derived($tasks.status === "ready" ? ($tasks.value.active ?? []) : []);
    let progress = $derived(aggregateProgress(active));
</script>

{#if active.length}
    <div class="flex shrink-0 items-center gap-1">
        <Button
            size="xs"
            variant="ghost"
            class="h-5 gap-1 px-1.5"
            title={$t("task.runningCount", active.length)}
            aria-label={$t("task.runningCount", active.length)}
            {onclick}
        >
            <ListTodo class="size-3.5" />
            <span>{active.length}</span>
            {#if progress !== undefined}<span class="tabular-nums">{percent(progress)}%</span>{/if}
        </Button>
        <Progress
            aria-label={$t("task.aggregate")}
            value={progress === undefined ? undefined : percent(progress)}
            indeterminate={progress === undefined}
            class="h-1 w-10"
        />
    </div>
{/if}
