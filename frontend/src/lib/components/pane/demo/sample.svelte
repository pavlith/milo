<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea";
    import type { EditorRendererProps } from "$lib/editors/registry";
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import { SampleSession } from "./sample-session";

    let { tab, context }: EditorRendererProps = $props();
    const session = untrack(() => context.session);
    if (!(session instanceof SampleSession)) throw new Error("Sample session is unavailable");
    const { draft } = session;
    let field = $state<HTMLTextAreaElement | null>(null);

    $effect(() => {
        if (!field) return;
        field.setSelectionRange(session.selection.start, session.selection.end);
        field.scrollTop = session.scrollTop;
    });

    const rememberSelection = (event: Event) => {
        const node = event.currentTarget as HTMLTextAreaElement;
        session.selection = { start: node.selectionStart, end: node.selectionEnd };
    };
</script>

<div class="mx-auto w-full max-w-2xl space-y-3 p-3 @sm/editor:p-6">
    <h1 class="text-lg font-semibold">{$t(tab.title)}</h1>
    <Textarea
        bind:ref={field}
        aria-label={$t("workbench.sample.text")}
        class="min-h-32 font-mono"
        value={$draft}
        oninput={(event) => {
            rememberSelection(event);
            session.edit(event.currentTarget.value);
        }}
        onselect={rememberSelection}
        onblur={rememberSelection}
        onscroll={(event) => (session.scrollTop = event.currentTarget.scrollTop)}
    />
    <div class="flex flex-wrap gap-2">
        <Button size="sm" disabled={!tab.dirty} onclick={() => void context.save()}>
            {$t("workbench.editor.save")}
        </Button>
        <Button size="sm" variant="outline" disabled={!tab.dirty} onclick={() => void context.discard()}>
            {$t("workbench.editor.discard")}
        </Button>
    </div>
    <p class="text-muted-foreground text-xs">{$t("workbench.sample.session")}</p>
</div>
