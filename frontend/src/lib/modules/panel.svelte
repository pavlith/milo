<script lang="ts">
    import * as Tabs from "$lib/components/ui/tabs";
    import { t } from "$lib/i18n";
    import { ListTodo, Terminal } from "@lucide/svelte";
    import Output from "./logger/output.svelte";
    import Tasks from "./task/panel.svelte";

    let toolbar = $state<HTMLDivElement>();
    let { view = $bindable("output"), open }: { view?: string; open: boolean } = $props();
</script>

<Tabs.Root
    bind:value={view}
    class="@container/output-panel h-full min-h-0 min-w-0 gap-0 overflow-hidden"
    aria-label={$t("workbench.panel")}
>
    <div class="bg-muted/50 flex shrink-0 flex-wrap items-center gap-x-2 border-b px-2">
        <Tabs.List variant="line" class="h-7 shrink-0" aria-label={$t("workbench.panel")}>
            <Tabs.Trigger value="output" class="h-6 py-0 text-xs">
                <Terminal class="hidden size-3.5 @lg/output-panel:inline" />{$t("output.title")}
            </Tabs.Trigger>
            <Tabs.Trigger value="tasks" class="h-6 py-0 text-xs">
                <ListTodo class="hidden size-3.5 @lg/output-panel:inline" />{$t("task.title")}
            </Tabs.Trigger>
        </Tabs.List>
        <div bind:this={toolbar} hidden={view !== "output"} class="min-w-0 flex-[1_1_16rem] py-0.5"></div>
    </div>
    <Tabs.Content value="output" class="min-h-0 min-w-0 overflow-hidden">
        <Output visible={open && view === "output"} {toolbar} />
    </Tabs.Content>
    <Tabs.Content value="tasks" class="min-h-0 min-w-0 overflow-hidden"><Tasks /></Tabs.Content>
</Tabs.Root>
