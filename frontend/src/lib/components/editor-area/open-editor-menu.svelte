<script lang="ts">
    import { buttonVariants } from "$lib/components/ui/button";
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuSeparator,
        DropdownMenuTrigger,
    } from "$lib/components/ui/dropdown-menu";
    import type { EditorChoice } from "$lib/editors/model";
    import { t } from "$lib/i18n";
    import { Columns2, MoveHorizontal, Plus, X } from "@lucide/svelte";

    interface Props {
        choices: readonly EditorChoice[];
        onopen: (choice: EditorChoice) => void;
        onsplit?: () => void;
        onfocusother?: () => void;
        onclosegroup?: () => void;
    }

    let { choices, onopen, onsplit, onfocusother, onclosegroup }: Props = $props();
</script>

<DropdownMenu>
    <DropdownMenuTrigger
        class={buttonVariants({ variant: "ghost", size: "icon-sm", class: "m-0.5 shrink-0 transition-none" })}
        aria-label={$t("workbench.tab.open")}
        title={$t("workbench.tab.open")}
        data-open-tab
    >
        <Plus />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
        {#each choices as choice (choice.id)}
            <DropdownMenuItem onSelect={() => onopen(choice)}>
                {#if choice.icon}<choice.icon />{/if}
                {$t(choice.title)}
            </DropdownMenuItem>
        {/each}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!onsplit} onSelect={onsplit}>
            <Columns2 />{$t("workbench.editor.split")}
        </DropdownMenuItem>
        {#if onfocusother && onclosegroup}
            <DropdownMenuItem onSelect={onfocusother}>
                <MoveHorizontal />{$t("workbench.editor.focusOther")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onclosegroup}>
                <X />{$t("workbench.editor.closeGroup")}
            </DropdownMenuItem>
        {/if}
    </DropdownMenuContent>
</DropdownMenu>
