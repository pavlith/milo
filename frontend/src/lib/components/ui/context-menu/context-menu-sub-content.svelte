<script lang="ts">
    import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
    import { cn, type WithoutChildrenOrChild } from "$lib/components/utils.js";
    import ContextMenuPortal from "./context-menu-portal.svelte";
    import type { ComponentProps } from "svelte";

    let {
        ref = $bindable(null),
        class: className,
        align = "start",
        alignOffset = -3,
        portalProps,
        ...restProps
    }: ContextMenuPrimitive.SubContentProps & {
        portalProps?: WithoutChildrenOrChild<ComponentProps<typeof ContextMenuPortal>>;
    } = $props();
</script>

<ContextMenuPortal {...portalProps}>
    <ContextMenuPrimitive.SubContent
        bind:ref
        data-slot="context-menu-sub-content"
        {align}
        {alignOffset}
        class={cn(
            "bg-popover text-popover-foreground z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-lg",
            className
        )}
        {...restProps}
    />
</ContextMenuPortal>
