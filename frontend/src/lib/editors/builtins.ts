import { SampleSession, type SampleResource } from "$lib/components/pane/demo/sample-session";
import { FileText, LayoutTemplate } from "@lucide/svelte";
import type { EditorChoice } from "./model";
import type { EditorRegistry } from "./registry";

const ownerId = "milo.workbench";

export function registerBuiltinEditors(registry: EditorRegistry): readonly EditorChoice[] {
    const resources = new Map<string, SampleResource>([
        ["sample-a", { title: "tab.sample", text: "This is the first sample.\n" }],
        ["sample-b", { title: "tab.sampleAlternate", text: "This is the second sample.\n" }],
    ]);
    const welcome: EditorChoice = {
        id: "welcome",
        editorTypeId: ownerId + ".welcome",
        title: "tab.welcome",
        icon: LayoutTemplate,
    };
    const sampleType = ownerId + ".sample";

    registry.register({
        ...welcome,
        ownerId,
        id: welcome.editorTypeId,
        kind: "singleton",
        restore: true,
        preview: false,
        load: () => import("$lib/components/pane/demo/welcome.svelte"),
    });
    registry.register({
        ownerId,
        id: sampleType,
        title: "tab.sample",
        icon: FileText,
        kind: "resource",
        describe: (resource) => resources.get(resource),
        canRestore: (resource) => resources.has(resource),
        createSession: ({ resource }, onChange) => {
            const sample = resources.get(resource ?? "");
            if (!sample) throw new Error("Sample is unavailable");
            return new SampleSession(sample, onChange);
        },
        load: () => import("$lib/components/pane/demo/sample.svelte"),
    });

    return [
        welcome,
        ...Array.from(resources, ([resource, { title }], index) => ({
            id: index === 0 ? "sample" : "sample-alternate",
            editorTypeId: sampleType,
            resource,
            title,
            icon: FileText,
            preview: true,
        })),
    ];
}
