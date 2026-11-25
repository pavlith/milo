<script lang="ts">
    import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "$lib/components/ui/resizable";
    import type { EditorManager } from "$lib/editors/manager";
    import { splitMinSize, type EditorChoice, type EditorGroup, type EditorWorkspace } from "$lib/editors/model";
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import { initialPaneLayout } from "../initial-pane-layout";
    import EditorGroupPane from "./editor-group.svelte";

    interface Props {
        manager: EditorManager;
        workspace: EditorWorkspace;
        choices: readonly EditorChoice[];
        legacySplitSize?: number;
    }

    let { manager, workspace, choices, legacySplitSize }: Props = $props();
    let dragging = $state<string>();
    let left: ReturnType<typeof ResizablePane> | undefined = $state();
    const groupId = "milo.workbench.editors";
    const initialize = untrack(() =>
        initialPaneLayout(groupId, () => left, { size: legacySplitSize ?? 50, open: true })
    );
</script>

{#snippet editorGroup(group: EditorGroup, index: number)}
    <EditorGroupPane
        {manager}
        {group}
        {index}
        {choices}
        {dragging}
        ondragtab={(id) => (dragging = id)}
        focused={group.id === workspace.focusedGroupId}
        split={workspace.groups.length === 2}
    />
{/snippet}

{#if workspace.groups.length === 2}
    <ResizablePaneGroup id={groupId} autoSaveId={groupId} direction="horizontal" onLayoutChange={initialize}>
        <ResizablePane bind:this={left} id="editor-left" order={1} defaultSize={50} minSize={splitMinSize}>
            {@render editorGroup(workspace.groups[0], 0)}
        </ResizablePane>
        <ResizableHandle class="hover:bg-ring" aria-label={$t("workbench.editor.resizeGroups")} data-editor-resizer />
        <ResizablePane id="editor-right" order={2} defaultSize={50} minSize={splitMinSize}>
            {@render editorGroup(workspace.groups[1], 1)}
        </ResizablePane>
    </ResizablePaneGroup>
{:else}
    {@render editorGroup(workspace.groups[0], 0)}
{/if}
