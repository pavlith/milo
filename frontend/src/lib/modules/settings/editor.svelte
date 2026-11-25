<script lang="ts">
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Switch } from "$lib/components/ui/switch";
    import type { EditorRendererProps } from "$lib/editors/registry";
    import { t } from "$lib/i18n";
    import { RotateCcw } from "@lucide/svelte";
    import { filterSettings, settings, settingsAPI } from "./state";

    let { tab }: EditorRendererProps = $props();
    const categories = ["general", "appearance", "workbench"];
    let query = $state("");
    let category = $state("general");
    let confirm = $state(false);
    let busy = $state(false);
    let error = $state("");
    let all = $derived($settings.status === "ready" ? ($settings.value.entries ?? []) : []);
    let results = $derived(
        filterSettings(query.trim() ? all : all.filter(({ schema }) => schema.category === category), query, $t)
    );

    async function change(run: (api: Awaited<ReturnType<typeof settingsAPI>>) => PromiseLike<void>) {
        busy = true;
        error = "";
        try {
            await run(await settingsAPI());
        } catch (cause) {
            error = String(cause);
        } finally {
            busy = false;
        }
    }
</script>

<div class="mx-auto flex h-full max-w-5xl flex-col gap-4 overflow-auto p-4 @sm/editor:p-8">
    <h1 class="text-2xl font-semibold">{$t(tab.title)}</h1>
    <Input bind:value={query} type="search" aria-label={$t("settings.search")} placeholder={$t("settings.search")} />
    {#if $settings.status === "loading"}
        <p role="status">{$t("system.loading")}</p>
    {:else if $settings.status === "error"}
        <p role="alert" class="text-destructive">{$t($settings.error)}</p>
    {:else}
        {#if $settings.migrationError}
            <p role="alert" class="text-destructive">{$t("settings.migrationError")} {$settings.migrationError}</p>
        {/if}
        {#if error}<p role="alert" class="text-destructive">{error}</p>{/if}
        <div class="flex flex-wrap items-start gap-x-6 gap-y-3">
            <nav aria-label={$t("settings.categories")} class="flex min-w-32 flex-wrap gap-1 @sm/editor:flex-col">
                {#each categories as item (item)}
                    <Button
                        size="sm"
                        variant={item === category && !query.trim() ? "secondary" : "ghost"}
                        class="justify-start"
                        aria-pressed={item === category && !query.trim()}
                        onclick={() => {
                            category = item;
                            query = "";
                        }}
                    >
                        {$t("settings.category." + item)}
                    </Button>
                {/each}
            </nav>
            <section class="min-w-48 flex-1">
                {#if !query.trim()}
                    <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                        <h2 class="font-semibold">{$t("settings.category." + category)}</h2>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || !results.some((entry) => entry.overridden)}
                            onclick={() => (confirm = true)}
                        >
                            {$t("settings.resetCategory")}
                        </Button>
                    </div>
                {/if}
                {#each results as { schema, value, overridden } (schema.id)}
                    <div class="flex items-start justify-between gap-2 border-b py-3">
                        <div class="min-w-0 space-y-1">
                            <label for={schema.id} class="text-sm font-medium">{$t(schema.label)}</label>
                            <p id={schema.id + "-description"} class="text-muted-foreground text-xs">
                                {$t(schema.description)}
                            </p>
                            {#if schema.kind === "choice"}
                                <select
                                    id={schema.id}
                                    aria-describedby={schema.id + "-description"}
                                    disabled={busy}
                                    class="border-input bg-background mt-1 h-8 rounded-md border px-2 text-sm"
                                    value={value.text}
                                    onchange={(event) => {
                                        const select = event.currentTarget;
                                        const text = select.value;
                                        select.value = value.text ?? "";
                                        void change((api) => api.Set(schema.id, { text }));
                                    }}
                                >
                                    {#each schema.options ?? [] as option (option)}
                                        <option value={option}>{$t("settings.option." + option)}</option>
                                    {/each}
                                </select>
                            {:else}
                                <div class="mt-1">
                                    <Switch
                                        id={schema.id}
                                        aria-describedby={schema.id + "-description"}
                                        checked={value.enabled ?? false}
                                        disabled={busy}
                                        onCheckedChange={(enabled) =>
                                            void change((api) => api.Set(schema.id, { enabled }))}
                                    />
                                </div>
                            {/if}
                        </div>
                        <Button
                            size="icon-sm"
                            variant="ghost"
                            disabled={!overridden || busy}
                            title={$t("settings.reset")}
                            aria-label={$t("settings.resetNamed", $t(schema.label))}
                            onclick={() => void change((api) => api.Reset(schema.id))}
                        >
                            <RotateCcw />
                        </Button>
                    </div>
                {:else}
                    <p class="text-muted-foreground py-4 text-sm">{$t("settings.empty")}</p>
                {/each}
            </section>
        </div>
    {/if}
</div>

<AlertDialog.Root bind:open={confirm}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>{$t("settings.resetCategory")}</AlertDialog.Title>
            <AlertDialog.Description>
                {$t("settings.confirm", $t("settings.category." + category))}
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>{$t("system.cancel")}</AlertDialog.Cancel>
            <AlertDialog.Action onclick={() => void change((api) => api.ResetCategory(category))}>
                {$t("settings.reset")}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
