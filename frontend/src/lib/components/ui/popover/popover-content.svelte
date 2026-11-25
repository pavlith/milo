<script lang="ts">
    import { Popover as PopoverPrimitive } from "bits-ui";
    import { cn, type WithoutChildrenOrChild } from "$lib/components/utils.js";
    import PopoverPortal from "./popover-portal.svelte";
    import type { ComponentProps } from "svelte";

    let {
        ref = $bindable(null),
        class: className,
        sideOffset = 4,
        align = "center",
        portalProps,
        ...restProps
    }: PopoverPrimitive.ContentProps & {
        portalProps?: WithoutChildrenOrChild<ComponentProps<typeof PopoverPortal>>;
    } = $props();
</script>

<PopoverPortal {...portalProps}>
    <PopoverPrimitive.Content
        bind:ref
        data-slot="popover-content"
        {sideOffset}
        {align}
        class={cn(
            "bg-popover text-popover-foreground ring-foreground/10 z-50 flex w-72 flex-col gap-4 rounded-md p-4 text-sm shadow-md ring-1 outline-hidden",
            className
        )}
        {...restProps}
    />
</PopoverPortal>
