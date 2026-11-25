<script lang="ts">
    import type { Snippet } from "svelte";

    let { children }: { children: Snippet } = $props();
</script>

<div class="bg-muted/50 flex h-9 min-h-9 w-full items-stretch border-b">
    {@render children()}
</div>
