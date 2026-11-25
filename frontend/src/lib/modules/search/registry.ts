import { writable } from "svelte/store";
import { validArguments, validID, type ActionIcon, type Reference } from "../action/registry.ts";

type ResultItem = {
    id: string;
    title: string;
    description?: string;
    icon?: ActionIcon;
    resource?: string;
    action?: Reference;
};

export interface Result extends ResultItem {
    owner: string;
    provider: string;
}

export interface Provider {
    id: string;
    owner: string;
    label: string;
    scope?: string;
    limit: number;
    timeoutMS: number;
    debounceMS?: number;
    query: (
        query: string,
        limit: number,
        signal: AbortSignal
    ) => readonly ResultItem[] | PromiseLike<readonly ResultItem[]>;
}

export class SearchRegistry {
    #entries = new Map<string, { provider: Readonly<Provider>; lifetime: AbortController }>();
    #catalog = writable<readonly Provider[]>([]);
    readonly subscribe = this.#catalog.subscribe;

    register(definition: Provider) {
        const { id, owner, limit, timeoutMS, debounceMS = 0 } = definition;
        if (
            !validID(id) ||
            !validID(owner) ||
            !id.startsWith(owner + ".") ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 25 ||
            !Number.isFinite(timeoutMS) ||
            timeoutMS <= 0 ||
            timeoutMS > 5000 ||
            !Number.isFinite(debounceMS) ||
            debounceMS < 0 ||
            debounceMS > 1000
        ) {
            throw new Error(`Invalid search provider: ${id}`);
        }
        if (this.#entries.has(id)) throw new Error(`Duplicate search provider ID: ${id}`);
        const entry = { provider: Object.freeze({ ...definition }), lifetime: new AbortController() };
        this.#entries.set(id, entry);
        this.#publish();
        return () => {
            if (this.#entries.get(id) === entry) this.unregister(id);
        };
    }

    lookup(id: string) {
        return this.#entries.get(id)?.provider;
    }

    unregister(id: string) {
        const entry = this.#entries.get(id);
        if (!entry) return;
        this.#entries.delete(id);
        entry.lifetime.abort();
        this.#publish();
    }

    removeOwner(owner: string) {
        for (const [id, { provider }] of this.#entries) {
            if (provider.owner === owner) this.unregister(id);
        }
    }

    #publish() {
        this.#catalog.set([...this.#entries.values()].map(({ provider }) => provider));
    }

    #run(provider: Provider, query: string, request: AbortSignal): Promise<readonly Result[]> {
        const entry = this.#entries.get(provider.id);
        if (!entry || entry.provider !== provider) return Promise.reject(new DOMException("Unavailable", "AbortError"));
        const deadline = new AbortController();
        const signal = AbortSignal.any([request, entry.lifetime.signal, deadline.signal]);

        return new Promise((resolve, reject) => {
            let timeout: ReturnType<typeof setTimeout>;
            let debounce: ReturnType<typeof setTimeout>;
            const cleanup = () => {
                clearTimeout(timeout);
                clearTimeout(debounce);
                signal.removeEventListener("abort", abort);
            };
            const abort = () => {
                cleanup();
                reject(signal.reason);
            };
            if (signal.aborted) return abort();
            signal.addEventListener("abort", abort, { once: true });

            const run = async () => {
                timeout = setTimeout(
                    () => deadline.abort(new DOMException("Timed out", "TimeoutError")),
                    provider.timeoutMS
                );
                try {
                    const items = await provider.query(query, provider.limit, signal);
                    signal.throwIfAborted();
                    const seen = new Set<string>();
                    const results = [];
                    for (const item of items.slice(0, provider.limit)) {
                        if (
                            !validID(item.id) ||
                            seen.has(item.id) ||
                            !item.title ||
                            item.title.length > 512 ||
                            (item.description?.length ?? 0) > 1024 ||
                            (item.resource?.length ?? 0) > 512 ||
                            (item.action &&
                                (!validID(item.action.id) ||
                                    (item.action.args !== undefined && !validArguments(item.action.args))))
                        )
                            continue;
                        seen.add(item.id);
                        results.push({ ...item, owner: provider.owner, provider: provider.id });
                    }
                    resolve(results);
                } catch (error) {
                    reject(error);
                } finally {
                    cleanup();
                }
            };
            if (provider.debounceMS && query) debounce = setTimeout(() => void run(), provider.debounceMS);
            else void run();
        });
    }

    session(publish: (groups: readonly SearchGroup[]) => void) {
        let current: AbortController | undefined;
        return {
            query: (input: string, providers: readonly Provider[], scope?: string) => {
                current?.abort();
                const request = new AbortController();
                current = request;
                const query = input.trim();
                const ordered = providers
                    .filter((provider) => !scope || scope === provider.scope)
                    .toSorted((a, b) => (a.id < b.id ? -1 : a.id === b.id ? 0 : 1));
                const groups = ordered.map((provider): SearchGroup => ({ provider, pending: true, results: [] }));
                const update = () => {
                    let remaining = 80;
                    publish(
                        groups.map((group) => {
                            const results = group.results.slice(0, remaining);
                            remaining -= results.length;
                            return { ...group, results };
                        })
                    );
                };
                update();
                for (const [index, provider] of ordered.entries()) {
                    const finish = (results: readonly Result[], error?: SearchGroup["error"]) => {
                        if (current !== request || request.signal.aborted) return;
                        groups[index] = { provider, results, error, pending: false };
                        update();
                    };
                    void this.#run(provider, query, request.signal).then(
                        (results) => finish(results),
                        (error: unknown) => {
                            const removed = this.lookup(provider.id) !== provider;
                            finish(
                                [],
                                removed
                                    ? undefined
                                    : error instanceof DOMException && error.name === "TimeoutError"
                                      ? "timeout"
                                      : "failed"
                            );
                        }
                    );
                }
            },
            cancel: () => {
                current?.abort();
                current = undefined;
            },
        };
    }
}

export interface SearchGroup {
    provider: Provider;
    pending: boolean;
    results: readonly Result[];
    error?: "timeout" | "failed";
}

export function matches(query: string, ...fields: (string | undefined)[]) {
    const text = fields.join(" ").toLocaleLowerCase();
    return query
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/)
        .every((word) => text.includes(word));
}
