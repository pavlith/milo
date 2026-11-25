import { writable } from "svelte/store";

interface MenuEntry {
    readonly id: string;
    readonly owner: string;
    order?: number;
    visible?: () => boolean;
    enabled?: () => boolean;
}

export interface MenuItem extends MenuEntry {
    kind: "item";
    parent: string;
    label: string;
    action: string;
    checked?: () => boolean;
    shortcut?: string;
}

export type MenuRegistration = Readonly<
    | (MenuEntry & { kind: "section"; parent?: never; label: string })
    | (MenuEntry & { kind: "group"; parent: string; label?: string })
    | (MenuEntry & { kind: "submenu"; parent: string; label: string })
    | (MenuEntry & { kind: "separator"; parent: string })
    | MenuItem
>;

export type ResolveMenuAction = (id: string, owner: string) => (() => void) | undefined;

export class MenuRegistry {
    #entries = new Map<string, MenuRegistration>();
    #children = writable<ReadonlyMap<string | undefined, readonly MenuRegistration[]>>(new Map());
    readonly subscribe = this.#children.subscribe;

    register(entry: MenuRegistration): () => void {
        const prefix = entry.owner + ".";
        if (!entry.owner || !entry.id.startsWith(prefix) || entry.id.length === prefix.length) {
            throw new Error(`Menu ID must be namespaced by its owner: ${entry.id}`);
        }
        if (this.#entries.has(entry.id)) throw new Error(`Duplicate menu ID: ${entry.id}`);

        if (entry.kind !== "section") {
            const parent = this.#entries.get(entry.parent);
            if (!parent || parent.kind === "item" || parent.kind === "separator" || !this.#isAttached(parent)) {
                throw new Error(`Invalid menu parent: ${entry.parent}`);
            }
        }

        const registration = Object.freeze({ ...entry });
        this.#entries.set(registration.id, registration);
        this.#publish();
        return () => {
            if (this.#entries.get(registration.id) === registration) this.unregister(registration.id);
        };
    }

    unregister(id: string): void {
        if (this.#entries.delete(id)) this.#publish();
    }

    removeOwner(owner: string): void {
        let changed = false;
        for (const entry of this.#entries.values()) {
            if (entry.owner !== owner) continue;
            this.#entries.delete(entry.id);
            changed = true;
        }
        if (changed) this.#publish();
    }

    isEnabled(entry: MenuRegistration): boolean {
        return this.#isAttached(entry, (current) => current.visible?.() !== false && current.enabled?.() !== false);
    }

    invoke(item: MenuItem, resolve: ResolveMenuAction): void {
        if (this.isEnabled(item)) resolve(item.action, item.owner)?.();
    }

    #isAttached(entry: MenuRegistration, available = (_entry: MenuRegistration) => true): boolean {
        if (this.#entries.get(entry.id) !== entry || !available(entry)) return false;
        if (entry.kind === "section") return true;
        const parent = this.#entries.get(entry.parent);
        return !!parent && parent.kind !== "item" && parent.kind !== "separator" && this.#isAttached(parent, available);
    }

    #publish(): void {
        const children = new Map<string | undefined, MenuRegistration[]>();
        for (const entry of this.#entries.values()) {
            const siblings = children.get(entry.parent) ?? [];
            siblings.push(entry);
            children.set(entry.parent, siblings);
        }
        for (const siblings of children.values()) siblings.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        this.#children.set(children);
    }
}
