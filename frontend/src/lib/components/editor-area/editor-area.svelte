<script lang="ts">
    import { ResizableHandle, ResizablePane, ResizablePaneGroup } from "$lib/components/ui/resizable";
    import type { EditorManager } from "$lib/editors/manager";
    import { splitMinSize, type EditorChoice, type EditorGroup, type EditorWorkspace } from "$lib/editors/model";
    import { t } from "$lib/i18n";
    import EditorGroupPane from "./editor-group.svelte";

    interface Props {
        manager: EditorManager;
        workspace: EditorWorkspace;
        choices: readonly EditorChoice[];
    }

    let { manager, workspace, choices }: Props = $props();
    let dragging = $state<string>();
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
    <ResizablePaneGroup direction="horizontal" onLayoutChange={([left]) => manager.resizeGroups(left)}>
        {#each workspace.groups as group, index (group.id)}
            {#if index > 0}
                <ResizableHandle
                    class="hover:bg-ring"
                    aria-label={$t("workbench.editor.resizeGroups")}
                    data-editor-resizer
                />
            {/if}
            <ResizablePane
                id={"editor-split-" + group.id}
                order={index}
                defaultSize={index === 0 ? workspace.leftSize : 100 - workspace.leftSize}
                minSize={splitMinSize}
            >
                {@render editorGroup(group, index)}
            </ResizablePane>
        {/each}
    </ResizablePaneGroup>
{:else}
    {@render editorGroup(workspace.groups[0], 0)}
{/if}
