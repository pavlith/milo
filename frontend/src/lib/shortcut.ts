export interface ShortcutBinding {
    key: string;
    code?: string;
    shift?: boolean;
}

interface Shortcut {
    binding: ShortcutBinding;
    run: () => void;
    enabled?: () => boolean;
}

const isMac = () => /Macintosh|Mac OS/.test(navigator.userAgent);

export const formatShortcut = ({ key, shift }: ShortcutBinding): string => {
    const label = key === "tab" ? "Tab" : key.toUpperCase();
    return isMac() ? `⌘${shift ? "⇧" : ""}${label}` : `Ctrl+${shift ? "Shift+" : ""}${label}`;
};

export const bindShortcuts = (shortcuts: Shortcut[]) => {
    const handleKeydown = (event: KeyboardEvent) => {
        if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey) return;
        if (isMac() ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return;

        const shortcut = shortcuts.find(
            ({ binding }) =>
                (event.key.toLowerCase() === binding.key ||
                    (binding.code !== undefined && event.code === binding.code)) &&
                event.shiftKey === Boolean(binding.shift)
        );
        if (!shortcut || shortcut.enabled?.() === false) return;

        event.preventDefault();
        shortcut.run();
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
};
