<script lang="ts">
    import { t } from "$lib/i18n";
    import NotificationCenter from "./notify/center.svelte";
    import { editorStatusID, preference, settings } from "./settings/state";
    import TaskProgress from "./task/footer.svelte";

    let {
        title,
        group,
        dirty,
        notificationsOpen = $bindable(false),
        openTasks,
    }: {
        title: string;
        group?: number;
        dirty?: boolean;
        notificationsOpen?: boolean;
        openTasks: () => void;
    } = $props();
</script>

<footer
    data-region="footer"
    class="bg-muted/50 text-muted-foreground flex h-6 shrink-0 items-center gap-3 border-t px-2 text-xs"
>
    {#if preference($settings, editorStatusID)?.value.enabled ?? true}
        {#if group !== undefined}<span class="shrink-0">{$t("workbench.editor.group", group)}</span>{/if}
        <span class="truncate">{title}</span>
        {#if dirty}<span class="shrink-0">{$t("workbench.editor.dirty")}</span>{/if}
    {/if}
    <div class="ml-auto flex shrink-0 items-center gap-1">
        <TaskProgress onclick={openTasks} />
        <NotificationCenter bind:open={notificationsOpen} />
    </div>
</footer>
