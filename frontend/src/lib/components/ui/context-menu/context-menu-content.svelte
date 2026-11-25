<script lang="ts">
    import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
    import { cn } from "$lib/components/utils.js";
    import type { WithoutChildrenOrChild } from "$lib/components/utils.js";
    import ContextMenuPortal from "./context-menu-portal.svelte";
    import type { ComponentProps } from "svelte";

    let {
        ref = $bindable(null),
        portalProps,
        class: className,
        ...restProps
    }: ContextMenuPrimitive.ContentProps & {
        portalProps?: WithoutChildrenOrChild<ComponentProps<typeof ContextMenuPortal>>;
    } = $props();
</script>

<ContextMenuPortal {...portalProps}>
    <ContextMenuPrimitive.Content
        bind:ref
        data-slot="context-menu-content"
        class={cn(
            "ring-foreground/10 bg-popover text-popover-foreground z-50 max-h-(--bits-context-menu-content-available-height) min-w-36 overflow-x-hidden overflow-y-auto rounded-md p-1 shadow-md ring-1",
            className
        )}
        {...restProps}
    />
</ContextMenuPortal>
