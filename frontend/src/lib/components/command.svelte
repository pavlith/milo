<script lang="ts">
    import {
        CommandDialog,
        CommandGroup,
        CommandInput,
        CommandItem,
        CommandList,
        CommandShortcut,
    } from "$lib/components/ui/command";
    import { t } from "$lib/i18n";
    import { useActions } from "$lib/modules/action/context";
    import { titleOf, type ActionIcon, type Binding, type Reference } from "$lib/modules/action/registry";
    import { formatShortcut } from "$lib/modules/action/shortcuts";
    import { matches, type SearchGroup, type SearchRegistry } from "$lib/modules/search/registry";
    import { tick, untrack } from "svelte";

    let {
        open = $bindable(false),
        query = $bindable(""),
        searches,
        origin,
    }: {
        open: boolean;
        query: string;
        searches: SearchRegistry;
        origin?: HTMLElement;
    } = $props();

    const actions = useActions();
    let groups = $state.raw<readonly SearchGroup[]>([]);
    let selected = $state("");
    let input = $state<HTMLInputElement | null>(null);
    let finishSelection: (() => void) | undefined;
    const session = untrack(() => searches.session((update) => (groups = update)));
    let commandMode = $derived(query.startsWith(">"));
    let commands = $derived.by(() => {
        if (!open || !commandMode) return [];
        return $actions
            .filter((action) => action.listed !== false && actions.status({ id: action.id }) === "enabled")
            .map(({ id, title, description, category, icon, binding }) => ({
                id,
                title: titleOf(title, $t),
                description: description && $t(description),
                category: category && $t(category),
                icon,
                binding,
            }))
            .filter(({ id, title, description, category }) =>
                matches(query.slice(1), title, description, category, id)
            );
    });
    let loading = $derived(!commandMode && groups.some(({ pending }) => pending));
    let hasResults = $derived(commandMode ? commands.length > 0 : groups.some(({ results }) => results.length));

    $effect(() => {
        const input = query;
        if (!open || input.startsWith(">")) return;
        session.query(input, $searches);
        return session.cancel;
    });

    $effect(() => {
        // Keep the user's selection during progressive delivery if it still exists.
        const ids = commandMode
            ? commands.map(({ id }) => id)
            : groups.flatMap(({ results }) =>
                  results
                      .filter((result) => result.action && actions.status(result.action, result.owner) === "enabled")
                      .map(resultKey)
              );
        if (!ids.includes(untrack(() => selected))) selected = ids[0] ?? "";
    });

    function resultKey(result: { id: string; provider: string }) {
        return result.provider + ":" + result.id;
    }

    function select(ref: Reference, owner = "") {
        if (!open || finishSelection) return;
        void actions.invoke(ref, owner, {
            beforeRun: () =>
                new Promise<void>((resolve) => {
                    finishSelection = resolve;
                    session.cancel();
                    open = false;
                }),
        });
    }

    function focusInput(event: Event) {
        event.preventDefault();
        void tick().then(() => {
            if (!open || !input?.isConnected) return;
            input.focus({ preventScroll: true });
            input.setSelectionRange(input.value.length, input.value.length);
        });
    }

    function restoreFocus(event: Event) {
        event.preventDefault();
        const finish = finishSelection;
        const trigger = origin;
        finishSelection = undefined;
        queueMicrotask(() => {
            if (!open) {
                (trigger?.isConnected && trigger !== document.body
                    ? trigger
                    : document.querySelector<HTMLElement>("[data-command-center]")
                )?.focus({ preventScroll: true });
            }
            finish?.();
        });
    }
</script>

{#snippet item(
    key: string,
    title: string,
    icon: ActionIcon | undefined,
    description: string | undefined,
    binding: Binding | undefined,
    ref: Reference | undefined,
    owner = ""
)}
    <CommandItem
        class="min-h-9 gap-3 px-3 py-1.5 in-data-[slot=dialog-content]:rounded-md! [&>svg:last-child]:hidden"
        value={key}
        disabled={!ref || actions.status(ref, owner) !== "enabled"}
        onSelect={() => {
            if (ref) select(ref, owner);
        }}
    >
        <span class="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
            {#if icon}{@const Icon = icon}<Icon />{/if}
        </span>
        <span class="min-w-0 flex-1 truncate">
            {title}
            {#if description}<span class="text-muted-foreground ms-2 text-xs">{description}</span>{/if}
        </span>
        {#if binding}
            <CommandShortcut
                class="border-border shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none tracking-normal whitespace-nowrap"
            >
                {formatShortcut(binding)}
            </CommandShortcut>
        {/if}
    </CommandItem>
{/snippet}

<CommandDialog
    showCloseButton
    bind:open
    bind:value={selected}
    shouldFilter={false}
    onOpenAutoFocus={focusInput}
    onCloseAutoFocus={restoreFocus}
    title={$t(commandMode ? "workbench.command" : "workbench.search")}
    description={$t(commandMode ? "workbench.command.description" : "workbench.search.description")}
    class={[
        "top-[min(12vh,6rem)]! sm:max-w-[32rem]",
        "[&_[data-slot=command]]:h-auto! [&_[data-slot=command]]:min-h-0 [&_[data-slot=command]]:p-0!",
        "[&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:py-3! [&_[data-slot=command-input-wrapper]]:pr-14! [&_[data-slot=command-input-wrapper]]:pl-3!",
        "[&_[data-slot=input-group]]:h-9! [&_[data-slot=input-group]]:rounded-md!",
        "[&>[data-slot=dialog-close]]:top-3! [&>[data-slot=dialog-close]]:right-3! [&>[data-slot=dialog-close]]:size-9!",
    ].join(" ")}
>
    <CommandInput
        bind:ref={input}
        bind:value={query}
        maxlength={256}
        aria-label={$t(commandMode ? "workbench.command.placeholder" : "workbench.search.placeholder")}
        placeholder={$t(commandMode ? "workbench.command.placeholder" : "workbench.search.placeholder")}
    />
    <CommandList class="max-h-[min(22rem,calc(88dvh_-_5rem))] min-h-0 scroll-py-2 scrollbar-thin p-2">
        {#if commandMode}
            {#each commands as command (command.id)}
                {@render item(command.id, command.title, command.icon, command.description, command.binding, {
                    id: command.id,
                })}
            {/each}
        {:else}
            {#each groups as group (group.provider.id)}
                {#if group.results.length}
                    <CommandGroup forceMount heading={$t(group.provider.label)}>
                        {#each group.results as result (result.id)}
                            {@const binding = $actions.find(({ id }) => id === result.action?.id)?.binding}
                            {@render item(
                                resultKey(result),
                                result.title,
                                result.icon,
                                result.description,
                                binding,
                                result.action,
                                result.owner
                            )}
                        {/each}
                    </CommandGroup>
                {/if}
                {#if group.error}
                    <p role="status" class="text-destructive px-3 py-1.5 text-xs">
                        {$t("workbench.search." + group.error, $t(group.provider.label))}
                    </p>
                {/if}
            {/each}
        {/if}
        {#if loading}
            <p role="status" class="text-muted-foreground px-3 py-2 text-xs">{$t("system.loading")}</p>
        {:else if !hasResults}
            <p role="status" class="text-muted-foreground px-3 py-8">
                {$t(commandMode ? "workbench.command.empty" : "workbench.search.empty")}
            </p>
        {/if}
    </CommandList>
</CommandDialog>
