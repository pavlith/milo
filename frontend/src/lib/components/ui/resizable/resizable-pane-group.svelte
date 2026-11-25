<script lang="ts">
    import * as ResizablePrimitive from "paneforge";
    import { cn } from "$lib/components/utils.js";

    let { ref = $bindable(null), class: className, ...restProps }: ResizablePrimitive.PaneGroupProps = $props();
</script>

<ResizablePrimitive.PaneGroup
    bind:ref
    data-slot="resizable-pane-group"
    class={cn("flex h-full w-full data-[direction=vertical]:flex-col", className)}
    {...restProps}
/>
