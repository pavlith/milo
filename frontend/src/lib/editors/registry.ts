import type { Component } from "svelte";
import type { EditorInput, EditorMetadata, EditorTab, ResourceRef } from "./model.ts";

export interface EditorRendererProps {
    tab: EditorTab;
}

export type EditorRenderer = Component<EditorRendererProps>;

interface EditorRegistrationBase extends EditorMetadata {
    id: string;
    ownerId: string;
    load: () => Promise<{ default: EditorRenderer }>;
    preview?: boolean;
}

export type EditorRegistration = EditorRegistrationBase &
    (
        | { kind: "singleton"; restore?: boolean }
        | {
              kind: "resource";
              describe: (resource: ResourceRef) => EditorMetadata | undefined;
              canRestore?: (resource: ResourceRef) => boolean;
          }
    );

export interface ResolvedEditor {
    registration: EditorRegistration;
    metadata: EditorMetadata;
}

const namespaced = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

export class EditorRegistry {
    private entries = new Map<string, EditorRegistration>();
    private renderers = new Map<EditorRegistration, Promise<EditorRenderer>>();
    private listeners = new Set<() => void>();

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    register(registration: EditorRegistration): () => void {
        const { id, ownerId } = registration;
        if (!namespaced.test(id) || !id.startsWith(ownerId + ".") || !ownerId) {
            throw new Error(`Editor type ${id} must be namespaced under its owner ${ownerId}`);
        }
        if (this.entries.has(id)) throw new Error(`Editor type ${id} is already registered`);

        const entry = Object.freeze({ ...registration });
        this.entries.set(id, entry);
        this.notify();
        return () => {
            if (this.entries.get(id) !== entry) return;
            this.entries.delete(id);
            this.renderers.delete(entry);
            this.notify();
        };
    }

    get(id: string): EditorRegistration | undefined {
        return this.entries.get(id);
    }

    removeOwner(ownerId: string): void {
        let removed = false;
        for (const [id, entry] of this.entries) {
            if (entry.ownerId !== ownerId) continue;
            this.entries.delete(id);
            this.renderers.delete(entry);
            removed = true;
        }
        if (removed) this.notify();
    }

    resolve(input: EditorInput, restoring = false): ResolvedEditor | undefined {
        const entry = this.get(input.editorTypeId);
        if (!entry) return;

        if (entry.kind === "singleton") {
            if (input.resource !== undefined || (restoring && !entry.restore)) return;
            return { registration: entry, metadata: { title: entry.title, icon: entry.icon } };
        }

        const { resource } = input;
        if (typeof resource !== "string" || !resource) return;
        try {
            if (restoring && !entry.canRestore?.(resource)) return;
            const metadata = entry.describe(resource);
            if (metadata) {
                return { registration: entry, metadata: { title: metadata.title, icon: metadata.icon ?? entry.icon } };
            }
        } catch {
            // The provider can become unavailable between persistence and restoration.
        }
    }

    resolveRenderer(entry: EditorRegistration): Promise<EditorRenderer> {
        const cached = this.renderers.get(entry);
        if (cached) return cached;
        const renderer = Promise.resolve()
            .then(() => entry.load())
            .then(({ default: component }) => {
                if (typeof component !== "function" || this.get(entry.id) !== entry) {
                    throw new Error(`Renderer for ${entry.id} is unavailable`);
                }
                return component;
            })
            .catch((error: unknown) => {
                if (this.renderers.get(entry) === renderer) this.renderers.delete(entry);
                throw error;
            });
        this.renderers.set(entry, renderer);
        return renderer;
    }

    private notify(): void {
        for (const listener of this.listeners) listener();
    }
}
