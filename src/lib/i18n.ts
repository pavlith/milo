import { readable } from "svelte/store";
import english from "../locale/en.json";

type Translation = (key: string, ...args: Array<string | number>) => string;
type Locale = Partial<Record<keyof typeof english, string>>;

const translate =
    (locale: Locale = {}): Translation =>
    (key, ...args) => {
        const id = key as keyof typeof english;
        return (locale[id] ?? english[id] ?? key).replace(/{(\d+)}/g, (match, index) => String(args[index] ?? match));
    };

const locales = import.meta.glob<Locale>(["../locale/*.json", "!../locale/en.json"], { import: "default" });

export const t = readable(translate(), (set) => {
    const language = navigator.language.split("-")[0];
    const load = locales[`../locale/${language}.json`];
    if (!load) return;

    let active = true;
    load()
        .then((locale) => {
            if (active) set(translate(locale));
        })
        .catch(() => {
            // The English dictionary is available even if a locale chunk fails to load.
        });
    return () => (active = false);
});
