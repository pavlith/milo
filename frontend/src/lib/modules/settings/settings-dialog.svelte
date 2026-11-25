<script lang="ts">
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Sidebar from "$lib/components/ui/sidebar";
    import { Input } from "$lib/components/ui/input";
    import { Switch } from "$lib/components/ui/switch";
    import { t } from "$lib/i18n";
    import { PanelsTopLeft, RotateCcw, Settings, SunMoon } from "@lucide/svelte";
    import { filterSettings } from "./entries";
    import { settings, settingsAPI } from "./state";

    let { open = $bindable(false) }: { open?: boolean } = $props();
    const categoryIcons: Record<string, typeof Settings> = {
        general: Settings,
        appearance: SunMoon,
        workbench: PanelsTopLeft,
    };
    let query = $state("");
    let selectedCategory = $state("general");
    let confirm = $state(false);
    let busy = $state(false);
    let error = $state("");
    let all = $derived($settings.status === "ready" ? ($settings.value.entries ?? []) : []);
    let categories = $derived(
        $settings.status === "ready"
            ? [...new Set(all.map(({ schema }) => schema.category))]
            : Object.keys(categoryIcons)
    );
    let category = $derived(categories.includes(selectedCategory) ? selectedCategory : (categories[0] ?? "general"));
    const categoryLabel = (category: string) => {
        const key = "settings.category." + category;
        const label = $t(key);
        return label === key ? category : label;
    };
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

<Dialog.Root bind:open>
    <Dialog.Content
        class="h-[min(34rem,calc(100dvh-2rem))] max-w-[min(48rem,calc(100vw-2rem))] overflow-hidden p-0 sm:max-w-[min(48rem,calc(100vw-2rem))]"
    >
        <Dialog.Description class="sr-only">{$t("settings.description")}</Dialog.Description>
        <Sidebar.Provider style="--sidebar-width: clamp(8rem, 24vw, 12rem)">
            <Sidebar.Root class="shrink-0 border-e">
                <Sidebar.Content>
                    <Sidebar.Group role="navigation" aria-label={$t("settings.categories")}>
                        <Sidebar.GroupContent>
                            <Sidebar.Menu>
                                {#each categories as item (item)}
                                    {@const Icon = categoryIcons[item] ?? Settings}
                                    {@const active = item === category && !query.trim()}
                                    <Sidebar.MenuItem>
                                        <Sidebar.MenuButton
                                            isActive={active}
                                            aria-current={active ? "page" : undefined}
                                            onclick={() => {
                                                selectedCategory = item;
                                                query = "";
                                            }}
                                        >
                                            <Icon />
                                            <span>{categoryLabel(item)}</span>
                                        </Sidebar.MenuButton>
                                    </Sidebar.MenuItem>
                                {/each}
                            </Sidebar.Menu>
                        </Sidebar.GroupContent>
                    </Sidebar.Group>
                </Sidebar.Content>
            </Sidebar.Root>
            <section class="flex min-h-0 min-w-0 flex-1 flex-col">
                <header class="shrink-0 space-y-3 border-b p-4">
                    <Dialog.Title class="pe-8">{$t("tab.settings")}</Dialog.Title>
                    <Input
                        bind:value={query}
                        type="search"
                        aria-label={$t("settings.search")}
                        placeholder={$t("settings.search")}
                    />
                </header>
                <div class="min-h-0 flex-1 overflow-auto p-4">
                    {#if $settings.status === "loading"}
                        <p role="status">{$t("system.loading")}</p>
                    {:else if $settings.status === "error"}
                        <p role="alert" class="text-destructive">{$t($settings.error)}</p>
                    {:else}
                        {#if $settings.migrationError}
                            <p role="alert" class="text-destructive">
                                {$t("settings.migrationError")}
                                {$settings.migrationError}
                            </p>
                        {/if}
                        {#if error}<p role="alert" class="text-destructive">{error}</p>{/if}
                        {#if !query.trim()}
                            <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                                <h2 class="font-semibold">{categoryLabel(category)}</h2>
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
                    {/if}
                </div>
            </section>
        </Sidebar.Provider>
        <AlertDialog.Root bind:open={confirm}>
            <AlertDialog.Content>
                <AlertDialog.Header>
                    <AlertDialog.Title>{$t("settings.resetCategory")}</AlertDialog.Title>
                    <AlertDialog.Description>
                        {$t("settings.confirm", categoryLabel(category))}
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
    </Dialog.Content>
</Dialog.Root>
