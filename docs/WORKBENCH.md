# Workbench UI contract

## Implemented through Stage 03

The shell renders seven regions with one or two side-by-side editor groups. The primary sidebar, Open tab menu and local command palette open trusted editors. Each group has its own tab bar, active renderer and preview. The footer identifies the active editor in the focused group and shows its dirty state.

PaneForge resizes the primary and secondary sidebars, bottom Panel and editor split. Header buttons, the View menu and the palette update the same pane preferences. The activity rail can reopen the primary sidebar. Reopening a region restores its last size within the bounds in `frontend/src/lib/state.ts`. The secondary sidebar and bottom Panel render empty states. WebKit local storage holds layout and validated tab metadata, and Mode Watcher persists theme choice.

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

Use PaneForge for the primary sidebar, secondary sidebar, bottom Panel and editor split. Editor area must not disappear if every extension is disabled. Persist visibility and dimensions with safe minimum/maximum bounds, restore invalid state to defaults. Header/footer may offer visibility settings later; MVP keeps essential window controls accessible. Do not force all zones to contain something. Left rail active state uses a neutral accent or indicator, not large colored icon backgrounds.

## Unified Header

Milo uses Wails 3.1 frameless mode on Linux. Empty Header space uses Wails drag regions, and the menu, Command Center and buttons opt out of dragging. A double-click on empty Header space toggles maximize/restore. The window buttons call the Wails runtime for minimize, maximize/restore and close. The maximize button reads the initial native state and follows Wails window events, including changes from the window manager. Wails handles edge resize and the host sets a minimum window size of 720 × 480. Launch with `MILO_NATIVE_TITLEBAR=1` to use system decorations on Linux. Other platforms use system decorations by default. The Workbench Header stays available with system decorations and in browser previews. [Wails frameless windows](https://v3.wails.io/features/windows/frameless/)

The Command Center opens the existing local palette and displays its shortcut. Stage 06 adds the Action and Search modules and connects them to the palette. File opens the palette and can quit the native app. Edit opens Appearance. View controls the three panes and exposes editor operations, including split, navigation, focus and close. Help opens Welcome. Menubar supports keyboard navigation and View exposes each pane's open state as a checkmark.

## Menu Registry

The trusted Workbench builds the application menu from a local typed registry. A section is a top-level menu. Items, groups, separators and submenus use a parent ID to join an existing section, group or submenu. Siblings sort by order with registration order breaking ties. Contributions support visibility and enabled predicates. An item references an action ID and may supply a checked predicate and a shortcut label. The label displays a shortcut and actual key bindings remain with the shortcut handler.

Each registration has an owner and a globally unique menu ID under that owner's namespace. Registering returns a disposer. The registry also supports unregistering by ID and removing all entries owned by one owner. Removing a parent makes its descendants unreachable. Surviving registrations from other owners can reappear when a compatible parent returns. Selection rechecks that the item and its ancestors are still available and resolves the action using its ID and the item's owner.

Stage 06 replaces the Workbench's local action resolver with the Action module. Stage 07 connects menu declarations and cleanup to the shared Contribution Registry. The future extension host will derive owner identity from the session, validate attachment targets and authorize action invocation against that identity and the session's capabilities. [Module contracts](MODULES.md#action) · [Extension contributions](EXTENSIONS.md#menu-contributions)

## UI standards

Use Svelte 5 runes for new reactive state where appropriate, TypeScript strictness, current shadcn-svelte primitives and Tailwind semantic colors. Neutral Zinc, light/dark/system via Mode Watcher. Prefer Lucide icons, accessible names, keyboard focus indicators, compact spacing and restrained transitions. No IBM Carbon dependency or theme. Avoid duplicating components or creating a second design system. Reuse existing primitives and svelte-dnd-action where appropriate. Add dependencies when the implementation has a concrete consumer.

## Tab and editor model

An editor type declares its namespaced ID, owner, title, optional Lucide icon, lazy Svelte loader and singleton or resource behavior. A resource is a stable opaque string interpreted by its editor type. Resource registrations describe the reference and can opt in to restoring supported references. Singleton registrations can opt in to restoration. Registrations can disable preview.

An editor tab has its own instance ID, owner ID, editor type ID, optional resource reference, title and icon metadata, group ID, and pinned, preview and dirty flags. Each editor group keeps an ordered list of instances and its own active tab. The Workbench also tracks the focused group. The manager deduplicates resource opens by type and reference within the target group. **Open New Instance** opens an independent instance of a resource. Singleton editors such as Appearance focus their existing instance across groups.

The registry rejects duplicate IDs and validates owner namespaces. Registration returns a disposer and the registry supports removing all registrations for an owner. Renderer loads are shared by a live registration. The group mounts only its active renderer and shows loading, unavailable and retry states as appropriate. Editor sessions are keyed by tab instance and remain available across renderer unmounts, focus changes and group moves.

### Tab operations and previews

The primary sidebar opens each sample in preview. The Open tab menu and palette open permanent tabs. Each group has at most one preview. Opening another preview replaces that eligible tab in place. The preview label is italicized. Double-click, **Keep Open**, editing, pinning or opening the resource permanently promotes it. Dirty and pinned tabs stay open when a new preview replaces an eligible clean preview.

Closing an active tab prefers the previous remaining tab and then the next at the start. Close Others, Close to the Right and Close All protect pinned tabs. Explicitly closing a pinned tab is supported. Pinned tabs stay at the front when reordered. Reopen keeps up to 20 recently closed entries in memory, skips unavailable editors and restores the tab in the focused group. Automatic preview replacements do not enter the history.

### Dirty state and close

An editor type can create a per-instance session with a state change callback and optional `save`, `discard` and `dispose` operations. Renderers receive the session and the manager-backed save and discard operations. The session reports dirty state on edits. A provider returning `true` completes save or discard. A failed operation, cancellation or a new edit that arrives during an asynchronous operation keeps the editor open. Disposal releases the session after closing or replacing a clean preview.

One shadcn-svelte Alert Dialog handles individual, bulk, group, owner and application close decisions. Cancel leaves the requested tabs open. For bulk closes the manager collects decisions before performing them, then runs saves before discards and removes tabs once operations succeed. Group close preserves pinned tabs by moving them with their sessions to the remaining group. Quit checks all groups, including inactive and pinned tabs. The Go host uses Wails 3.1 `RegisterHook` on `WindowClosing` and `ShouldQuit` to relay the request to the same manager. The browser preview uses the browser's reload and close confirmation while dirty. [Wails window events](https://v3.wails.io/features/windows/events/)

### Groups and keyboard

**Split Editor Right** creates or focuses a right group and opens the current resource there as a separate instance when possible. Singleton tabs can be moved to the right group. Drag tabs along or between the tab bars, or use the context menu for keyboard-accessible reorder and move actions. Moving preserves identity, pins and drafts. A moved preview becomes permanent if the destination already has a preview. The split resizer supports pointer and keyboard input. **Close Editor Group** returns to a single group. With one group, closing its last tab leaves a usable empty editor area.

| Shortcut | Operation |
| --- | --- |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous tab in the focused group |
| Ctrl+W | Close the focused group's active tab |
| Ctrl+Shift+T | Reopen the most recently closed tab |
| Ctrl+Backslash | Split Editor Right |
| Ctrl+Shift+P | Open the local command palette |
| Shift+F10 on a tab | Open its context menu |

The shortcut handler respects events already handled by the focused control. Browsers may reserve tab and window shortcuts. **Focus Other Editor Group**, **Move to Other Editor Group** and **Close Editor Group** are also available in the menus and palette.

### Workspace storage

The `milo.workbench` key stores version 2, pane preferences, and an `editor` object with `focusedGroupId`, `leftSize` and ordered `groups`. Groups store IDs, active tab IDs and ordered tabs. Persisted tab fields are `id`, `ownerId`, `editorTypeId`, optional `resource`, `pinned` and `preview`. The registry supplies presentation metadata on restore. Corruption, duplicate IDs, missing registrations and unavailable or unsupported resources are handled during validation. Version 1 tabs migrate from legacy view IDs to new instance IDs while preserving pins, ordering, focus and pane preferences.

The snapshot contains metadata only. Dirty state, draft text, saved demo text, renderer data and close history stay in memory. Sample and Sample B exercise the same resource type with two stable references. Save updates the in-session resource and new instances read that saved text. Restart restores the tab metadata and loads the built-in sample text. Mode Watcher stores the theme separately under `milo.state.mode`.

## Planned contributions

Stage 07 generalizes owner-scoped registration for menu entries, activity entries, views, editor types, header actions, panel views, footer status items and command/search registrations. Stable namespaced IDs, order, region, title and icon are metadata. Every registration returns a disposer, rejects duplicates and is removed when the owner stops. Use one shared registry contract for modules and extensions; trusted module components can lazy-import local Svelte files, extension UI goes through the isolated rendering mechanism described in [EXTENSIONS.md](EXTENSIONS.md).

No direct import from extensions into `frontend/src/app.svelte` or layout components. Empty regions collapse gracefully. A test contribution should prove the shell can accept unknown types without editing the shell.

## Task UI planned for Stage 05

The footer progress indicator shows running work and opens the Tasks view in the bottom Panel. The view renders determinate and indeterminate progress, recent terminal outcomes and user-safe error messages. It offers cancellation for supported tasks. Svelte reads snapshots and reacts to events through the trusted Wails bridge. Go owns scheduling, cancellation, errors and history. [Task contract](MODULES.md#task)
