# Workbench UI contract

## Implemented through Stage 02

The native shell renders all seven regions with one editor group and three lazy-loaded local views. The primary sidebar lists those views, and a local command palette and tab menus open, focus, close, pin and reorder tabs. PaneForge resizes the primary and secondary sidebars and the bottom Panel. Header buttons, the View menu and the local palette read and update the same pane preferences. The activity rail stays accessible when primary is hidden and can reopen it. Reopening a region restores its last size within the bounds in `frontend/src/lib/state.ts`. The editor keeps a minimum width and height. The secondary sidebar and bottom Panel render empty states, and the footer shows the active view. WebKit local storage holds versioned layout and tab metadata, and Mode Watcher persists theme choice. The remaining editor and contribution contracts appear below.

## Regions

The stable layout roles are `header`, `left`, `primary`, `secondary`, `editor`, `panel` and `footer`.

    +--------------------------- header --------------------------+
    | left | primary |              editor          | secondary |
    |      |         |        tabs / editor groups  |           |
    |      |         +-------------- panel ---------+           |
    +--------------------------- footer --------------------------+

| Region | Role | Behavior |
| --- | --- | --- |
| header | Milo mark, application menu, Command Center, layout and window controls | 36 CSS pixels. Wails owns window operations and system decorations in fallback mode. |
| left | Activity Bar, navigation entries contributed by owners | Icon rail; selection controls primary views; keyboard accessible |
| primary | Main navigation/views | Hide, collapse and resize |
| secondary | Context, properties, assistant views | Hide, collapse, resize; optional by default |
| editor | Main tab bar and content, editor groups | Always available; empty state; independent group focus |
| panel | Bottom tabbed output/diagnostics/tasks | Hide, collapse, resize; no terminal emulator in MVP |
| footer | Status bar, notification entry, status contributions | Left/right aligned, compact |

Use PaneForge for primary/secondary/panel. Editor area must not disappear if every extension is disabled. Persist visibility and dimensions with safe minimum/maximum bounds, restore invalid state to defaults. Header/footer may offer visibility settings later; MVP keeps essential window controls accessible. Do not force all zones to contain something. Left rail active state uses a neutral accent or indicator, not large colored icon backgrounds.

## Unified Header

Milo uses Wails 3.1 frameless mode on Linux. Empty Header space uses Wails drag regions, and the menu, Command Center and buttons opt out of dragging. A double-click on empty Header space toggles maximize/restore. The window buttons call the Wails runtime for minimize, maximize/restore and close. The maximize button reads the initial native state and follows Wails window events, including changes from the window manager. Wails handles edge resize and the host sets a minimum window size of 720 × 480. Launch with `MILO_NATIVE_TITLEBAR=1` to use system decorations on Linux. Other platforms use system decorations by default. The Workbench Header stays available with system decorations and in browser previews. [Wails frameless windows](https://v3.wails.io/features/windows/frameless/)

The Command Center opens the existing local palette and displays its shortcut. Stage 06 adds the Action and Search modules and connects them to the palette. The current File menu opens the palette or quits in the native app. Edit opens Appearance, View controls the three panes and Help opens Welcome. Menubar supports keyboard navigation and View exposes each pane's open state as a checkmark.

## Menu Registry

The trusted Workbench builds the application menu from a local typed registry. A section is a top-level menu. Items, groups, separators and submenus use a parent ID to join an existing section, group or submenu. Siblings sort by order with registration order breaking ties. Contributions support visibility and enabled predicates. An item references an action ID and may supply a checked predicate and a shortcut label. The label displays a shortcut and actual key bindings remain with the shortcut handler.

Each registration has an owner and a globally unique menu ID under that owner's namespace. Registering returns a disposer. The registry also supports unregistering by ID and removing all entries owned by one owner. Removing a parent makes its descendants unreachable. Surviving registrations from other owners can reappear when a compatible parent returns. Selection rechecks that the item and its ancestors are still available and resolves the action using its ID and the item's owner.

Stage 06 replaces the Workbench's local action resolver with the Action module. Stage 07 connects menu declarations and cleanup to the shared Contribution Registry. The future extension host will derive owner identity from the session, validate attachment targets and authorize action invocation against that identity and the session's capabilities. [Module contracts](MODULES.md#action) · [Extension contributions](EXTENSIONS.md#menu-contributions)

## UI standards

Use Svelte 5 runes for new reactive state where appropriate, TypeScript strictness, current shadcn-svelte primitives and Tailwind semantic colors. Neutral Zinc, light/dark/system via Mode Watcher. Prefer Lucide icons, accessible names, keyboard focus indicators, compact spacing and restrained transitions. No IBM Carbon dependency or theme. Avoid duplicating components or creating a second design system. Reuse existing primitives and svelte-dnd-action where appropriate. Add dependencies when the implementation has a concrete consumer.

## Tab and editor model

Proposed contract (illustrative TypeScript, refine at Stage 03):

    interface EditorTab {
      id: string;          // unique instance
      ownerId: string;     // module/extension
      editorType: string;  // registered contribution ID
      resource?: string;   // opaque stable owner-scoped reference
      title: string;
      groupId: string;
      pinned: boolean;
      preview: boolean;
      dirty: boolean;
    }

    interface EditorGroup {
      id: string;
      tabIds: string[];
      activeTabId: string | null;
    }

Registry resolves editor types to renderers; no switch statement on extension identities in the shell. Core knows opaque resource references, not mail IDs. Stable resource identity plus type and group support open-or-focus deduplication; an explicit new instance may be requested. Dirty state is supplied by the owner. Never close dirty content silently, including close-all, disable/uninstall or shutdown. Pinned tabs are protected from bulk close but can be explicitly closed.

MVP tab operations: open/focus, close, close others/right/all, pin/unpin, reorder, preview replacement, promote preview on double click or edit, next/previous, reopen closed where resolvable. One preview per group, never replace a pinned or dirty tab. On close select a predictable adjacent tab. Handle unavailable owner/renderer with a safe placeholder and close/retry actions. Preserve scroll/form state explicitly where needed; mount active view lazily. Do not persist rendered HTML or sensitive resource data.

Start with one group; add a bounded horizontal split with per-group focus and move tab across groups at Stage 03. Arbitrary recursive docking is later. Serialize layout and restorable tabs by ID/resource/version; skip missing providers or show a placeholder rather than crashing. Restore only after registry is ready. Persist non-secret metadata and validate all restored references.

Keyboard defaults: Ctrl+Tab/Shift+Ctrl+Tab next/previous; Ctrl+W closes focused tab (not window); Ctrl+Shift+T reopens; Ctrl+Shift+P opens command palette; Ctrl+P opens quick search. Input/editor shortcuts take precedence where appropriate. Accessible drag-and-drop alternatives and context menus are required. Do not globally suppress browser/native context menus or override text editing shortcuts without a concrete need.

## Planned contributions

Stage 07 generalizes owner-scoped registration for menu entries, activity entries, views, editor types, header actions, panel views, footer status items and command/search registrations. Stable namespaced IDs, order, region, title and icon are metadata. Every registration returns a disposer, rejects duplicates and is removed when the owner stops. Use one shared registry contract for modules and extensions; trusted module components can lazy-import local Svelte files, extension UI goes through the isolated rendering mechanism described in [EXTENSIONS.md](EXTENSIONS.md).

No direct import from extensions into `frontend/src/app.svelte` or layout components. An unloaded renderer shows a loading/error state. Empty regions collapse gracefully. A test contribution should prove the shell can accept unknown types without editing the shell.

## Task UI planned for Stage 05

The footer progress indicator shows running work and opens the Tasks view in the bottom Panel. The view renders determinate and indeterminate progress, recent terminal outcomes and user-safe error messages. It offers cancellation for supported tasks. Svelte reads snapshots and reacts to events through the trusted Wails bridge. Go owns scheduling, cancellation, errors and history. [Task contract](MODULES.md#task)
