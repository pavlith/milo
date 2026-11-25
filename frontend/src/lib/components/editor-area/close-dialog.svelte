<script lang="ts" module>
    import type { CloseDecision, ClosePrompt, EditorFeedback, EditorOperation } from "$lib/editors/lifecycle";
    import type { EditorTab } from "$lib/editors/model";
    import { tick } from "svelte";

    export class EditorCloseDialog implements EditorFeedback {
        prompt = $state.raw<ClosePrompt & { resolve: (decision: CloseDecision) => void }>();
        failure = $state.raw<{ tab: EditorTab; operation: EditorOperation }>();

        confirm(prompt: ClosePrompt): Promise<CloseDecision> {
            return new Promise((resolve) => (this.prompt = { ...prompt, resolve }));
        }

        failed(tab: EditorTab, operation: EditorOperation): void {
            this.failure = { tab, operation };
        }

        respond(decision: CloseDecision): void {
            const prompt = this.prompt;
            this.prompt = undefined;
            void tick().then(() => prompt?.resolve(decision));
        }

        dismiss(): void {
            if (this.prompt) this.respond("cancel");
            else this.failure = undefined;
        }
    }
</script>

<script lang="ts">
    import {
        AlertDialog,
        AlertDialogCancel,
        AlertDialogContent,
        AlertDialogDescription,
        AlertDialogFooter,
        AlertDialogHeader,
        AlertDialogTitle,
    } from "$lib/components/ui/alert-dialog";
    import { Button } from "$lib/components/ui/button";
    import { t } from "$lib/i18n";

    let { dialog }: { dialog: EditorCloseDialog } = $props();
</script>

<AlertDialog open={!!(dialog.prompt || dialog.failure)} onOpenChange={(open) => !open && dialog.dismiss()}>
    <AlertDialogContent>
        {#if dialog.prompt}
            {@const { tab, canSave } = dialog.prompt}
            <AlertDialogHeader>
                <AlertDialogTitle>{$t("workbench.editor.unsaved")}</AlertDialogTitle>
                <AlertDialogDescription>
                    {$t(canSave ? "workbench.editor.confirmSave" : "workbench.editor.confirmDiscard", $t(tab.title))}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{$t("workbench.editor.cancel")}</AlertDialogCancel>
                <Button variant="destructive" onclick={() => dialog.respond("discard")}>
                    {$t("workbench.editor.discard")}
                </Button>
                {#if canSave}
                    <Button onclick={() => dialog.respond("save")}>{$t("workbench.editor.save")}</Button>
                {/if}
            </AlertDialogFooter>
        {:else if dialog.failure}
            {@const { tab, operation } = dialog.failure}
            <AlertDialogHeader>
                <AlertDialogTitle>{$t("workbench.editor.operationFailed")}</AlertDialogTitle>
                <AlertDialogDescription>
                    {$t("workbench.editor.failed." + operation, $t(tab.title))}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{$t("workbench.editor.ok")}</AlertDialogCancel>
            </AlertDialogFooter>
        {/if}
    </AlertDialogContent>
</AlertDialog>
