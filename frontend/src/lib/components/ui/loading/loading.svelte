<script lang="ts">
    import { Spinner } from "$lib/components/ui/spinner";
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { cn } from "$lib/components/utils";

    interface Props {
        value?: string | null;
        center?: boolean;
        timed?: boolean;
        class?: string;
    }

    let { value = null, center = false, timed = false, class: clazz }: Props = $props();

    let time = $state(0);
    let duration = $state(100);
    let start = $state<number>();
    onMount(() => {
        start = performance.now();
        const timeout = setTimeout(() => (duration = 300), 300);
        return () => clearTimeout(timeout);
    });

    $effect(() => {
        if (!timed || start === undefined) return;

        const startedAt = start;
        const updateTime = () => (time = Math.round(performance.now() - startedAt));
        updateTime();
        const timer = setInterval(updateTime, 20);
        return () => clearInterval(timer);
    });
</script>

<div
    out:fade={{ duration }}
    class="bg-background/80 absolute top-0 left-0 z-10 h-full w-full backdrop-blur-xs will-change-[opacity]"
>
    <div class={cn("flex w-full flex-col items-center", center ? "h-full justify-center" : "mt-16", clazz)}>
        <Spinner class="text-muted-foreground size-8 motion-reduce:animate-none" aria-hidden="true" />
        <span class={value ? "text-muted-foreground mt-2" : "sr-only"} role="status">
            {value || $t("pane.loading")}
        </span>
        {#if timed}
            <span class="text-muted-foreground mt-1 text-xs">{time}ms</span>
        {/if}
    </div>
</div>
