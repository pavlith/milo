import { BookOpen, LayoutTemplate, Settings, type LucideProps } from "@lucide/svelte";
import type { Component } from "svelte";

export interface ViewDefinition {
    id: string;
    title: string;
    icon: Component<LucideProps>;
    load: () => Promise<{ default: Component }>;
}

export const views: ViewDefinition[] = [
    { id: "welcome", title: "tab.welcome", icon: LayoutTemplate, load: () => import("./demo/welcome.svelte") },
    { id: "sample", title: "tab.sample", icon: BookOpen, load: () => import("./demo/sample.svelte") },
    { id: "appearance", title: "tab.appearance", icon: Settings, load: () => import("./demo/appearance.svelte") },
];

export const viewById = new Map(views.map((view) => [view.id, view]));
