export const workbenchOwner = "milo.workbench";

export const actionIDs = {
    commands: workbenchOwner + ".commands",
    search: workbenchOwner + ".search",
    quit: workbenchOwner + ".quit",
    settings: "milo.settings.open",
    output: "milo.logger.open",
    tasks: "milo.task.open",
    notifications: "milo.notify.open",
    clearOutput: "logger.clear",
    focusTab: workbenchOwner + ".focus-tab",
    split: workbenchOwner + ".split-editor",
    focusOther: workbenchOwner + ".focus-other-group",
    moveGroup: workbenchOwner + ".move-editor-group",
    nextTab: workbenchOwner + ".next-tab",
    previousTab: workbenchOwner + ".previous-tab",
    closeTab: workbenchOwner + ".close-active-tab",
    reopenTab: workbenchOwner + ".reopen-tab",
    closeGroup: workbenchOwner + ".close-editor-group",
} as const;

export const paneAction = (region: string) => workbenchOwner + ".toggle-" + region;
export const editorOpenAction = (id: string) => workbenchOwner + ".open-" + id;

export const editorMenuActions = [
    actionIDs.split,
    actionIDs.focusOther,
    actionIDs.moveGroup,
    actionIDs.nextTab,
    actionIDs.previousTab,
    actionIDs.closeTab,
    actionIDs.reopenTab,
    actionIDs.closeGroup,
];
