<script lang="ts">
    import { Dialog as DialogPrimitive } from "bits-ui";
    import { cn } from "$lib/components/utils.js";

    let {
        ref = $bindable(null),
        class: className,
        animated = true,
        ...restProps
    }: DialogPrimitive.OverlayProps & { animated?: boolean } = $props();
</script>

<DialogPrimitive.Overlay
    bind:ref
    data-slot="dialog-overlay"
    class={cn(
        "fixed inset-0 isolate z-50",
        animated
            ? "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs"
            : "bg-black/30",
        className
    )}
    {...restProps}
/>
