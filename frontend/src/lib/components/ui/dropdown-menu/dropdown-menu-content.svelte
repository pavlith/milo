<script lang="ts">
    import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
    import { cn, type WithoutChildrenOrChild } from "$lib/components/utils.js";
    import DropdownMenuPortal from "./dropdown-menu-portal.svelte";
    import type { ComponentProps } from "svelte";

    let {
        ref = $bindable(null),
        sideOffset = 4,
        align = "start",
        portalProps,
        class: className,
        ...restProps
    }: DropdownMenuPrimitive.ContentProps & {
        portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
    } = $props();
</script>

<DropdownMenuPortal {...portalProps}>
    <DropdownMenuPrimitive.Content
        bind:ref
        data-slot="dropdown-menu-content"
        {sideOffset}
        {align}
        class={cn(
            "ring-foreground/10 bg-popover text-popover-foreground z-50 max-h-(--bits-dropdown-menu-content-available-height) w-(--bits-dropdown-menu-anchor-width) min-w-32 overflow-x-hidden overflow-y-auto rounded-md p-1 shadow-md ring-1",
            className
        )}
        {...restProps}
    />
</DropdownMenuPortal>
