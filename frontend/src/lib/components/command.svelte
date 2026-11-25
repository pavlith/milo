<script lang="ts" module>
    import type { ShortcutBinding } from "$lib/shortcut";
    import type { LucideProps } from "@lucide/svelte";
    import type { Component } from "svelte";

    export interface WorkbenchCommand {
        id: string;
        label: string;
        icon?: Component<LucideProps>;
        binding?: ShortcutBinding;
        run: () => void;
    }
</script>

<script lang="ts">
    import {
        CommandDialog,
        CommandEmpty,
        CommandInput,
        CommandItem,
        CommandList,
        CommandShortcut,
    } from "$lib/components/ui/command";
    import { t } from "$lib/i18n";
    import { formatShortcut } from "$lib/shortcut";

    let { open = $bindable(false), commands }: { open: boolean; commands: WorkbenchCommand[] } = $props();
</script>

<CommandDialog
    showCloseButton
    bind:open
    title={$t("workbench.command")}
    description={$t("workbench.command.description")}
    class={[
        "top-[min(12vh,6rem)]! sm:max-w-[32rem]",
        "[&_[data-slot=command]]:h-auto! [&_[data-slot=command]]:min-h-0 [&_[data-slot=command]]:p-0!",
        "[&_[data-slot=command-input-wrapper]]:border-b [&_[data-slot=command-input-wrapper]]:py-3! [&_[data-slot=command-input-wrapper]]:pl-3! [&_[data-slot=command-input-wrapper]]:pr-14!",
        "[&_[data-slot=input-group]]:h-9! [&_[data-slot=input-group]]:rounded-md!",
        "[&>[data-slot=dialog-close]]:top-3! [&>[data-slot=dialog-close]]:right-3! [&>[data-slot=dialog-close]]:size-9!",
    ].join(" ")}
>
    <CommandInput placeholder={$t("workbench.command.placeholder")} />
    <CommandList class="scrollbar-thin max-h-[min(22rem,calc(88dvh_-_5rem))] min-h-0 scroll-py-2 p-2">
        <CommandEmpty class="text-muted-foreground px-3 py-8">{$t("workbench.command.empty")}</CommandEmpty>
        {#each commands as command (command.id)}
            <CommandItem
                class="min-h-9 gap-3 px-3 py-1.5 in-data-[slot=dialog-content]:rounded-md! [&>svg:last-child]:hidden"
                value={command.id}
                keywords={[command.label]}
                onSelect={() => {
                    open = false;
                    command.run();
                }}
            >
                <span class="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                    {#if command.icon}<command.icon />{/if}
                </span>
                <span class="min-w-0 flex-1 truncate">{command.label}</span>
                {#if command.binding}
                    <CommandShortcut
                        class="border-border shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none tracking-normal whitespace-nowrap"
                    >
                        {formatShortcut(command.binding)}
                    </CommandShortcut>
                {/if}
            </CommandItem>
        {/each}
    </CommandList>
</CommandDialog>
