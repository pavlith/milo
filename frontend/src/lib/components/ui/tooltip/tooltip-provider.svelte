<script lang="ts">
    import { Tooltip as TooltipPrimitive } from "bits-ui";

    let { delayDuration = 500, skipDelayDuration = 0, ignoreNonKeyboardFocus = true, ...restProps }: TooltipPrimitive.ProviderProps = $props();
</script>

<TooltipPrimitive.Provider {delayDuration} {skipDelayDuration} {ignoreNonKeyboardFocus} {...restProps} />
