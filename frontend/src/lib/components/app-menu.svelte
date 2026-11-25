<script lang="ts">
    import * as Menubar from "$lib/components/ui/menubar";
    import { t } from "$lib/i18n";
    import type { MenuRegistry } from "$lib/menu";
    import { useActions } from "$lib/modules/action/context";
    import { titleOf } from "$lib/modules/action/registry";
    import { formatShortcut } from "$lib/modules/action/shortcuts";

    let { menu }: { menu: MenuRegistry } = $props();
    const actions = useActions();
    const select = (item: import("$lib/menu").MenuItem) => {
        if (menu.isEnabled(item)) void actions.invoke({ id: item.action }, item.owner);
    };
</script>

{#snippet entries(parent: string)}
    {#each $menu.get(parent) ?? [] as entry (entry.id)}
        {#if entry.visible?.() !== false}
            {#if entry.kind === "item"}
                {@const action = $actions.find(({ id }) => id === entry.action)}
                {@const disabled =
                    !menu.isEnabled(entry) ||
                    !action ||
                    actions.status({ id: entry.action }, entry.owner) !== "enabled"}
                {#snippet label()}
                    {entry.label ? $t(entry.label) : action ? titleOf(action.title, $t) : entry.action}
                    {#if action?.binding}<Menubar.Shortcut>{formatShortcut(action.binding)}</Menubar.Shortcut>{/if}
                {/snippet}
                {#if entry.checked}
                    <Menubar.CheckboxItem
                        checked={entry.checked()}
                        {disabled}
                        onSelect={(event) => {
                            // Keep the checkmark controlled by the action's state.
                            event.preventDefault();
                            select(entry);
                        }}
                    >
                        {@render label()}
                    </Menubar.CheckboxItem>
                {:else}
                    <Menubar.Item {disabled} onSelect={() => select(entry)}>
                        {@render label()}
                    </Menubar.Item>
                {/if}
            {:else if entry.kind === "separator"}
                <Menubar.Separator />
            {:else if entry.kind === "group"}
                <Menubar.Group>
                    {#if entry.label}<Menubar.GroupHeading>{$t(entry.label)}</Menubar.GroupHeading>{/if}
                    {@render entries(entry.id)}
                </Menubar.Group>
            {:else if entry.kind === "submenu"}
                <Menubar.Sub>
                    <Menubar.SubTrigger disabled={!menu.isEnabled(entry)}>{$t(entry.label)}</Menubar.SubTrigger>
                    <Menubar.SubContent class="rounded-sm">
                        {@render entries(entry.id)}
                    </Menubar.SubContent>
                </Menubar.Sub>
            {/if}
        {/if}
    {/each}
{/snippet}

<Menubar.Root aria-label={$t("workbench.menu")} class="h-7 gap-0 rounded-none border-0 p-0 shadow-none">
    {#each $menu.get(undefined) ?? [] as section (section.id)}
        {#if section.kind === "section" && section.visible?.() !== false}
            <Menubar.Menu value={section.id}>
                <Menubar.Trigger
                    disabled={!menu.isEnabled(section)}
                    class="hover:bg-accent aria-expanded:bg-accent focus-visible:ring-ring px-1.5 text-xs font-normal focus-visible:ring-1"
                >
                    {$t(section.label)}
                </Menubar.Trigger>
                <Menubar.Content class="rounded-sm" sideOffset={4} alignOffset={0}>
                    {@render entries(section.id)}
                </Menubar.Content>
            </Menubar.Menu>
        {/if}
    {/each}
</Menubar.Root>
