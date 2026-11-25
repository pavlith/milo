<script lang="ts">
    import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
    import { cn, type WithoutChildrenOrChild } from "$lib/components/utils.js";
    import DropdownMenuPortal from "./dropdown-menu-portal.svelte";
    import type { ComponentProps } from "svelte";

    let {
        ref = $bindable(null),
        class: className,
        align = "start",
        alignOffset = -3,
        portalProps,
        ...restProps
    }: DropdownMenuPrimitive.SubContentProps & {
        portalProps?: WithoutChildrenOrChild<ComponentProps<typeof DropdownMenuPortal>>;
    } = $props();
</script>

<DropdownMenuPortal {...portalProps}>
    <DropdownMenuPrimitive.SubContent
        bind:ref
        data-slot="dropdown-menu-sub-content"
        {align}
        {alignOffset}
        class={cn(
            "ring-foreground/10 bg-popover text-popover-foreground z-50 min-w-[96px] overflow-hidden rounded-md p-1 shadow-lg ring-1",
            className
        )}
        {...restProps}
    />
</DropdownMenuPortal>
