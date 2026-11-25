<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs";
    import { t } from "$lib/i18n";
    import { ListTodo, Terminal } from "@lucide/svelte";
    import Output from "./logger/output.svelte";
    import Tasks from "./task/panel.svelte";

    let { view = $bindable("output") }: { view?: string } = $props();
</script>

<Tabs.Root bind:value={view} class="h-full min-h-0 gap-0" aria-label={$t("workbench.panel")}>
    <div class="bg-muted/50 shrink-0 border-b px-2">
        <Tabs.List variant="line" class="h-7" aria-label={$t("workbench.panel")}>
            <Tabs.Trigger value="output" class="h-6 py-0 text-xs">
                <Terminal class="size-3.5" />{$t("output.title")}
            </Tabs.Trigger>
            <Tabs.Trigger value="tasks" class="h-6 py-0 text-xs">
                <ListTodo class="size-3.5" />{$t("task.title")}
            </Tabs.Trigger>
        </Tabs.List>
    </div>
    <Tabs.Content value="output" class="min-h-0"><Output /></Tabs.Content>
    <Tabs.Content value="tasks" class="min-h-0"><Tasks /></Tabs.Content>
</Tabs.Root>
