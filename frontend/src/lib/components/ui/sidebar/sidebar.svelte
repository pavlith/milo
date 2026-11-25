<script lang="ts">
    import { cn, type WithElementRef } from "$lib/components/utils.js";
    import type { HTMLAttributes } from "svelte/elements";

    let {
        ref = $bindable(null),
        class: className,
        children,
        ...restProps
    }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
    bind:this={ref}
    data-slot="sidebar"
    data-sidebar="sidebar"
    class={cn("bg-sidebar text-sidebar-foreground flex h-full min-h-0 w-(--sidebar-width) flex-col", className)}
    {...restProps}
>
    {@render children?.()}
</div>
