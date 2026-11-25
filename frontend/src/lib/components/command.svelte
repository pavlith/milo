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
>
    <CommandInput placeholder={$t("workbench.command.placeholder")} />
    <CommandList>
        <CommandEmpty>{$t("workbench.command.empty")}</CommandEmpty>
        {#each commands as command (command.id)}
            <CommandItem
                value={command.id}
                keywords={[command.label]}
                onSelect={() => {
                    open = false;
                    command.run();
                }}
            >
                {#if command.icon}<command.icon />{/if}
                {command.label}
                {#if command.binding}<CommandShortcut>{formatShortcut(command.binding)}</CommandShortcut>{/if}
            </CommandItem>
        {/each}
    </CommandList>
</CommandDialog>
