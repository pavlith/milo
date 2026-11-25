<script lang="ts">
    import { buttonVariants } from "$lib/components/ui/button";
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuTrigger,
    } from "$lib/components/ui/dropdown-menu";
    import { t } from "$lib/i18n";
    import { Plus } from "@lucide/svelte";
    import { views } from "./views";

    let { onopen }: { onopen: (id: string) => void } = $props();
</script>

<DropdownMenu>
    <DropdownMenuTrigger
        class={buttonVariants({ variant: "ghost", size: "icon-sm", class: "m-0.5 shrink-0" })}
        aria-label={$t("workbench.tab.open")}
        title={$t("workbench.tab.open")}
        data-open-tab
    >
        <Plus />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
        {#each views as view (view.id)}
            <DropdownMenuItem onSelect={() => onopen(view.id)}>
                <view.icon />
                {$t(view.title)}
            </DropdownMenuItem>
        {/each}
    </DropdownMenuContent>
</DropdownMenu>
