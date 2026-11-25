import type { LucideProps } from "@lucide/svelte";
import type { Component } from "svelte";
import { writable } from "svelte/store";

export type ActionLayer = "workbench" | "command" | "search" | "modal";
export type ContextFlag = ActionLayer | "editor" | "group" | "multiple-groups" | "editable";
export interface ActionContext {
    layer: ActionLayer;
    flags: readonly ContextFlag[];
}

export interface Binding {
    key: string;
    code?: string;
    shift?: boolean;
    context?: ContextFlag;
    editable?: boolean;
}

export type Arguments = Readonly<Record<string, string>>;
export interface Reference {
    id: string;
    args?: Arguments;
}

export type Translate = (key: string, ...args: (string | number)[]) => string;
export type ActionIcon = Component<LucideProps>;
export type ActionTitle = string | ((translate: Translate) => string);
export interface Action {
    id: string;
    owner: string;
    title: ActionTitle;
    description?: string;
    icon?: ActionIcon;
    category?: string;
    binding?: Binding;
    requires?: readonly ContextFlag[];
    delegates?: readonly string[];
    listed?: boolean;
    available?: (context: ActionContext) => boolean;
    enabled?: (context: ActionContext, args: Arguments) => boolean;
    validate?: (args: Arguments) => boolean;
    run: (args: Arguments, signal: AbortSignal, context: ActionContext, owner: string) => unknown;
}

type Failure = "missing" | "unavailable" | "arguments" | "failed";
export type ActionStatus = "enabled" | Exclude<Failure, "failed">;
export class ActionRejection extends Error {
    readonly failure: Failure;

    constructor(failure: Failure) {
        super(failure);
        this.failure = failure;
    }
}

const emptyArgs: Arguments = Object.freeze(Object.create(null));
const encoder = new TextEncoder();

export const titleOf = (title: ActionTitle, t: Translate) => (typeof title === "string" ? t(title) : title(t));
export const validID = (id: string) => /^[\w-]+(?:\.[\w-]+)*$/.test(id) && id.length <= 128;
export const validArguments = (args: Arguments) =>
    !!args &&
    (Object.getPrototypeOf(args) === Object.prototype || Object.getPrototypeOf(args) === null) &&
    Object.entries(args).length <= 16 &&
    Object.entries(args).every(
        ([key, value]) => validID(key) && typeof value === "string" && encoder.encode(value).length <= 512
    );

export class ActionRegistry {
    #entries = new Map<string, { action: Readonly<Action>; lifetime: AbortController }>();
    #catalog = writable<readonly Action[]>([]);
    readonly subscribe = this.#catalog.subscribe;

    readonly context: () => ActionContext;
    #report: (failure: Failure, id: string, title?: ActionTitle) => void;

    constructor(context: () => ActionContext, report: (failure: Failure, id: string, title?: ActionTitle) => void) {
        this.context = context;
        this.#report = report;
    }

    register(definition: Action) {
        if (
            !validID(definition.owner) ||
            !validID(definition.id) ||
            !definition.id.startsWith(definition.owner + ".")
        ) {
            throw new Error(`Invalid action ID: ${definition.id}`);
        }
        if (this.#entries.has(definition.id)) throw new Error(`Duplicate action ID: ${definition.id}`);
        const action = Object.freeze({
            ...definition,
            binding: definition.binding && Object.freeze({ ...definition.binding }),
            requires: definition.requires && Object.freeze([...definition.requires]),
            delegates: definition.delegates && Object.freeze([...definition.delegates]),
        });
        const entry = { action, lifetime: new AbortController() };
        this.#entries.set(action.id, entry);
        this.#publish();
        return () => {
            if (this.#entries.get(action.id) === entry) this.unregister(action.id);
        };
    }

    lookup(id: string) {
        return this.#entries.get(id)?.action;
    }

    list(): readonly Action[] {
        return [...this.#entries.values()].map(({ action }) => action);
    }

    unregister(id: string) {
        const entry = this.#entries.get(id);
        if (!entry) return;
        this.#entries.delete(id);
        entry.lifetime.abort();
        this.#publish();
    }

    removeOwner(owner: string) {
        const removed = [];
        for (const [id, entry] of this.#entries) {
            if (entry.action.owner !== owner) continue;
            this.#entries.delete(id);
            removed.push(entry);
        }
        for (const entry of removed) entry.lifetime.abort();
        if (removed.length) this.#publish();
    }

    status(ref: Reference, owner = "", context = this.context()): ActionStatus {
        const action = this.lookup(ref.id);
        if (!action) return "missing";
        const args = ref.args === undefined ? emptyArgs : ref.args;
        if (
            (owner &&
                owner !== action.owner &&
                !action.delegates?.includes(owner) &&
                !action.delegates?.includes("*")) ||
            action.requires?.some((flag) => !context.flags.includes(flag)) ||
            action.available?.(context) === false
        )
            return "unavailable";
        if (!validArguments(args) || (action.validate ? !action.validate(args) : Object.keys(args).length !== 0)) {
            return "arguments";
        }
        return action.enabled?.(context, args) === false ? "unavailable" : "enabled";
    }

    async invoke(
        ref: Reference,
        owner = "",
        { signal, beforeRun }: { signal?: AbortSignal; beforeRun?: () => Promise<void> } = {}
    ): Promise<boolean> {
        const entry = this.#entries.get(ref.id);
        try {
            const context = this.context();
            const status = this.status(ref, owner, context);
            if (signal?.aborted) return false;
            if (status !== "enabled" || !entry) {
                this.#report(status === "enabled" ? "missing" : status, ref.id, entry?.action.title);
                return false;
            }
            const lifetime = signal ? AbortSignal.any([signal, entry.lifetime.signal]) : entry.lifetime.signal;
            if (lifetime.aborted) return false;
            const args = ref.args === undefined ? emptyArgs : Object.freeze({ ...ref.args });
            if (beforeRun) {
                await beforeRun();
                if (lifetime.aborted) return false;
                const current = this.status({ id: ref.id, args }, owner, context);
                if (current !== "enabled") throw new ActionRejection(current);
            }
            await entry.action.run(args, lifetime, context, owner);
            return !lifetime.aborted;
        } catch (error) {
            if (!signal?.aborted && !entry?.lifetime.signal.aborted) {
                this.#report(error instanceof ActionRejection ? error.failure : "failed", ref.id, entry?.action.title);
            }
            return false;
        }
    }

    #publish() {
        this.#catalog.set(this.list());
    }
}
