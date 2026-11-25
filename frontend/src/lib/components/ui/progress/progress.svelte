<script lang="ts">
    import { Progress as ProgressPrimitive } from "bits-ui";
    import { cn, type WithoutChildrenOrChild } from "$lib/components/utils.js";

    let {
        ref = $bindable(null),
        class: className,
        max = 100,
        value,
        indeterminate = false,
        ...restProps
    }: WithoutChildrenOrChild<ProgressPrimitive.RootProps> & { indeterminate?: boolean } = $props();
</script>

<ProgressPrimitive.Root
    bind:ref
    data-slot="progress"
    class={cn("bg-muted relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full", className)}
    value={indeterminate ? null : value}
    {max}
    {...restProps}
>
    <div
        data-slot="progress-indicator"
        class={cn("bg-primary size-full flex-1 transition-all", indeterminate && "animate-progress origin-left")}
        style="transform: translateX(-{100 - (100 * (value ?? 0)) / (max ?? 1)}%)"
    ></div>
</ProgressPrimitive.Root>
