<script lang="ts">
    import { Menubar as MenubarPrimitive } from "bits-ui";
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import { cn, type WithoutChild } from "$lib/components/utils.js";

    let {
        ref = $bindable(null),
        class: className,
        inset = undefined,
        children,
        ...restProps
    }: WithoutChild<MenubarPrimitive.SubTriggerProps> & {
        inset?: boolean;
    } = $props();
</script>

<MenubarPrimitive.SubTrigger
    bind:ref
    data-slot="menubar-sub-trigger"
    data-inset={inset}
    class={cn(
        "focus:bg-accent focus:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none data-inset:pl-8 [&_svg:not([class*='size-'])]:size-4",
        className
    )}
    {...restProps}
>
    {@render children?.()}
    <ChevronRightIcon class="cn-rtl-flip ml-auto size-4" />
</MenubarPrimitive.SubTrigger>
