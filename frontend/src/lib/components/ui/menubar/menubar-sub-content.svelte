<script lang="ts">
    import { Menubar as MenubarPrimitive } from "bits-ui";
    import { cn, type WithoutChildrenOrChild } from "$lib/components/utils.js";
    import MenubarPortal from "./menubar-portal.svelte";
    import type { ComponentProps } from "svelte";

    let {
        ref = $bindable(null),
        class: className,
        align = "start",
        alignOffset = -3,
        portalProps,
        ...restProps
    }: MenubarPrimitive.SubContentProps & {
        portalProps?: WithoutChildrenOrChild<ComponentProps<typeof MenubarPortal>>;
    } = $props();
</script>

<MenubarPortal {...portalProps}>
    <MenubarPrimitive.SubContent
        bind:ref
        data-slot="menubar-sub-content"
        {align}
        {alignOffset}
        class={cn(
            "bg-popover text-popover-foreground ring-foreground/10 z-50 min-w-32 overflow-hidden rounded-md p-1 shadow-lg ring-1",
            className
        )}
        {...restProps}
    />
</MenubarPortal>
