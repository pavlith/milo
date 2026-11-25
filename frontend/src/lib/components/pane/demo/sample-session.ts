import type { EditorSession } from "$lib/editors/lifecycle";
import { get, writable } from "svelte/store";

export interface SampleResource {
    title: string;
    text: string;
}

export class SampleSession implements EditorSession {
    readonly draft;
    selection = { start: 0, end: 0 };
    scrollTop = 0;
    private saved: string;

    constructor(
        private resource: SampleResource,
        private onChange: (dirty: boolean) => void
    ) {
        this.saved = resource.text;
        this.draft = writable(this.saved);
    }

    edit(text: string): void {
        this.draft.set(text);
        this.onChange(text !== this.saved);
    }

    save(): boolean {
        this.saved = get(this.draft);
        this.resource.text = this.saved;
        return true;
    }

    discard(): boolean {
        this.draft.set(this.saved);
        return true;
    }
}
