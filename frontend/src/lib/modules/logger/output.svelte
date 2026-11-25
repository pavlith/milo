<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { t } from "$lib/i18n";
    import { Portal } from "bits-ui";
    import { Copy, Trash2 } from "@lucide/svelte";
    import { tick } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { copyText, fieldsText, filterLogs, levels, logTime, severityClass, type LogLevel } from "./records";
    import { loggerAPI, output } from "./state";

    let { actions }: { actions?: HTMLElement } = $props();
    let level = $state<LogLevel>("");
    let owner = $state("");
    let query = $state("");
    let autoScroll = $state(true);
    let error = $state("");
    let list = $state<HTMLDivElement>();
    const selected = new SvelteSet<number>();
    let records = $derived($output.status === "ready" ? ($output.value.records ?? []) : []);
    let owners = $derived([...new Set(records.map(({ owner }) => owner))].sort());
    let visible = $derived(filterLogs(records, level, owner, query));

    $effect(() => {
        const retained = new Set(records.map(({ id }) => id));
        for (const id of selected) if (!retained.has(id)) selected.delete(id);
    });

    $effect(() => {
        const element = list;
        if (element && autoScroll && visible.length) {
            void tick().then(() => (element.scrollTop = element.scrollHeight));
        }
    });

    async function clear() {
        error = "";
        try {
            await (await loggerAPI()).Clear();
        } catch (cause) {
            error = String(cause);
        }
    }

    async function copy() {
        error = "";
        try {
            const { Clipboard } = await import("@wailsio/runtime");
            await Clipboard.SetText(copyText(visible, selected));
        } catch (cause) {
            error = String(cause);
        }
    }
</script>

<div class="flex h-full min-h-0 flex-col">
    <div class="flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-1">
        <select
            aria-label={$t("output.level")}
            bind:value={level}
            class="border-input bg-background h-7 rounded border px-1.5 text-xs"
        >
            <option value="">{$t("output.allLevels")}</option>
            {#each levels as item (item)}
                <option value={item}>{$t("settings.option." + item)}</option>
            {/each}
        </select>
        <select
            aria-label={$t("output.owner")}
            bind:value={owner}
            class="border-input bg-background h-7 max-w-36 rounded border px-1.5 text-xs"
        >
            <option value="">{$t("output.allOwners")}</option>
            {#if owner && !owners.includes(owner)}<option value={owner}>{owner}</option>{/if}
            {#each owners as item (item)}<option value={item}>{item}</option>{/each}
        </select>
        <Input
            bind:value={query}
            type="search"
            class="h-7 min-w-32 flex-1 text-xs"
            aria-label={$t("output.filter")}
            placeholder={$t("output.filter")}
        />
        <label class="flex items-center gap-1 text-xs">
            <input type="checkbox" bind:checked={autoScroll} />
            {$t("output.autoScroll")}
        </label>
    </div>
    {#if error}<p class="text-destructive px-2 py-1 text-xs" role="alert">{error}</p>{/if}
    <div bind:this={list} class="min-h-0 flex-1 overflow-auto">
        {#if $output.status === "loading"}
            <p class="text-muted-foreground px-3 py-2 text-xs" role="status">{$t("system.loading")}</p>
        {:else if $output.status === "error"}
            <p class="text-destructive px-3 py-2 text-xs" role="alert">{$t($output.error)}</p>
        {:else}
            <ol class="divide-border/50 divide-y font-mono text-xs">
                {#each visible as record (record.id)}
                    <li class="flex items-baseline gap-2 px-2 py-1">
                        <input
                            type="checkbox"
                            checked={selected.has(record.id)}
                            aria-label={$t("output.select", record.id)}
                            onchange={(event) =>
                                event.currentTarget.checked ? selected.add(record.id) : selected.delete(record.id)}
                        />
                        <time datetime={record.time} class="text-muted-foreground shrink-0">{logTime(record)}</time>
                        <span class="w-12 shrink-0 font-semibold uppercase {severityClass(record.level)}">
                            {record.level}
                        </span>
                        <span class="text-muted-foreground shrink-0">{record.owner}</span>
                        <span class="min-w-0 break-all whitespace-pre-wrap">
                            {record.message}
                            {#if fieldsText(record)}<span class="text-muted-foreground">{fieldsText(record)}</span>{/if}
                        </span>
                    </li>
                {:else}
                    <li class="text-muted-foreground px-3 py-2">{$t("output.empty")}</li>
                {/each}
            </ol>
        {/if}
    </div>
</div>

{#if actions}
    <Portal to={actions}>
        <Button
            size="icon-xs"
            variant="ghost"
            disabled={!visible.length}
            onclick={copy}
            title={$t("output.copy")}
            aria-label={$t("output.copy")}
        >
            <Copy />
        </Button>
        <Button
            size="icon-xs"
            variant="ghost"
            disabled={!records.length}
            onclick={clear}
            title={$t("output.clear")}
            aria-label={$t("output.clear")}
        >
            <Trash2 />
        </Button>
    </Portal>
{/if}
