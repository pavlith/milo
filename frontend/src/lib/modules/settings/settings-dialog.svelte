<script lang="ts">
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import { Button } from "$lib/components/ui/button";
    import * as Dialog from "$lib/components/ui/dialog";
    import * as Sidebar from "$lib/components/ui/sidebar";
    import { Input } from "$lib/components/ui/input";
    import { Switch } from "$lib/components/ui/switch";
    import { t } from "$lib/i18n";
    import { PanelsTopLeft, RotateCcw, Search, Settings, SunMoon } from "@lucide/svelte";
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
        animated={false}
        class="flex h-[min(32rem,calc(100dvh_-_2rem))] max-w-[min(48rem,calc(100vw_-_2rem))] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-[min(48rem,calc(100vw_-_2rem))] [&>[data-slot=dialog-close]]:top-2 [&>[data-slot=dialog-close]]:right-3"
    >
        <Dialog.Description class="sr-only">{$t("settings.description")}</Dialog.Description>
        <header class="flex h-12 shrink-0 items-center border-b px-4 pe-14">
            <Dialog.Title class="text-sm font-semibold">{$t("tab.settings")}</Dialog.Title>
        </header>
        <Sidebar.Provider class="min-h-0 flex-1" style="--sidebar-width: clamp(7rem, 25vw, 11rem)">
            <Sidebar.Root class="bg-muted/25 shrink-0 border-e">
                <Sidebar.Content>
                    <Sidebar.Group class="p-2" role="navigation" aria-label={$t("settings.categories")}>
                        <Sidebar.GroupContent>
                            <Sidebar.Menu class="gap-1">
                                {#each categories as item (item)}
                                    {@const Icon = categoryIcons[item] ?? Settings}
                                    {@const active = item === category && !query.trim()}
                                    <Sidebar.MenuItem>
                                        <Sidebar.MenuButton
                                            isActive={active}
                                            class="h-8 gap-2.5 px-2.5"
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
                <div class="shrink-0 border-b px-4 py-3">
                    <div class="relative">
                        <Search class="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                        <Input
                            bind:value={query}
                            type="search"
                            class="h-9 ps-9 shadow-none"
                            aria-label={$t("settings.search")}
                            placeholder={$t("settings.search")}
                        />
                    </div>
                </div>
                <div class="scrollbar-thin min-h-0 flex-1 overflow-auto px-4 py-3">
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
                            <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                                <h2 class="text-sm font-semibold">{categoryLabel(category)}</h2>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy || !results.some((entry) => entry.overridden)}
                                    onclick={() => (confirm = true)}
                                >
                                    {$t("settings.resetCategory")}
                                </Button>
                            </div>
                        {/if}
                        {#each results as { schema, value, overridden } (schema.id)}
                            <div class="flex flex-wrap items-center gap-x-4 gap-y-3 border-b py-4 last:border-b-0">
                                <div class="min-w-0 flex-[1_1_12rem] space-y-1">
                                    <label for={schema.id} class="text-sm font-medium">{$t(schema.label)}</label>
                                    <p id={schema.id + "-description"} class="text-muted-foreground text-xs leading-relaxed">
                                        {$t(schema.description)}
                                    </p>
                                </div>
                                <div class="ms-auto flex shrink-0 items-center gap-2">
                                    {#if schema.kind === "choice"}
                                        <select
                                            id={schema.id}
                                            aria-describedby={schema.id + "-description"}
                                            disabled={busy}
                                            class="border-input bg-background focus-visible:ring-ring h-8 w-32 max-w-full rounded-md border px-2 text-sm outline-none focus-visible:ring-2 disabled:opacity-50"
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
                                        <div class="flex w-32 items-center justify-end">
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
                                    <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        class="text-muted-foreground hover:text-foreground"
                                        disabled={!overridden || busy}
                                        title={$t("settings.reset")}
                                        aria-label={$t("settings.resetNamed", $t(schema.label))}
                                        onclick={() => void change((api) => api.Reset(schema.id))}
                                    >
                                        <RotateCcw />
                                    </Button>
                                </div>
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
