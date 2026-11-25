import type { EditorTab } from "./model.ts";

export type EditorOperation = "save" | "discard";
export type CloseDecision = EditorOperation | "cancel";

export interface EditorSession {
    save?(): boolean | Promise<boolean>;
    discard?(): boolean | Promise<boolean>;
    dispose?(): void;
}

export interface EditorContext {
    session?: EditorSession;
    save(): Promise<boolean>;
    discard(): Promise<boolean>;
}

export interface ClosePrompt {
    tab: EditorTab;
    canSave: boolean;
}

export interface EditorFeedback {
    confirm(prompt: ClosePrompt): Promise<CloseDecision>;
    failed(tab: EditorTab, operation: EditorOperation): void;
}
