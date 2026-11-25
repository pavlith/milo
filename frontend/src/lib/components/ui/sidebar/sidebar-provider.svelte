<script lang="ts">
    import * as Tooltip from "$lib/components/ui/tooltip/index.js";
    import { cn, type WithElementRef } from "$lib/components/utils.js";
    import type { HTMLAttributes } from "svelte/elements";

    let {
        ref = $bindable(null),
        class: className,
        style,
        children,
        ...restProps
    }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<Tooltip.Provider delayDuration={0}>
    <div
        bind:this={ref}
        data-slot="sidebar-wrapper"
        style="--sidebar-width: 16rem; --sidebar-width-icon: 3rem; {style ?? ''}"
        class={cn("group/sidebar-wrapper flex h-full min-h-0 w-full min-w-0", className)}
        {...restProps}
    >
        {@render children?.()}
    </div>
</Tooltip.Provider>
