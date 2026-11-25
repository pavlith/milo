# Workbench UI contract

## App Shell

The shell renders seven regions with one or two side-by-side editor groups. The Primary Sidebar, Open Tab menu and local command palette open trusted editors. Each editor group owns its tab bar, active renderer and preview. The Status Bar shows the focused editor and its dirty state.

```text
App Shell
├── App Header
├── App Body
│   ├── Left Sidebar
│   └── Horizontal group
│       ├── Primary Sidebar
│       ├── Resizer
│       └── Workspace
│           └── Horizontal group
│               ├── Center column
│               │   └── Vertical group
│               │       ├── Editor Area (optional horizontal editor split)
│               │       ├── Resizer
│               │       └── Bottom Panel
│               ├── Resizer
│               └── Secondary Sidebar
└── Status Bar

Settings Dialog
├── Settings Sidebar
└── Settings Content
```

| Region | Role | Behavior |
| --- | --- | --- |
| Header | Milo mark, application menu, Command Center, pane and window controls | Fixed at 36 CSS pixels. Wails owns window operations and system decorations. |
| Left Sidebar | Activity selection, mock User Space and Settings | Fixed at 48 CSS pixels. Visible and icon-only at every window size. |
| Primary Sidebar | Context navigation from the selected activity | Starts at 20% of the body group. Open range 12–36%. |
| Secondary Sidebar | Contextual views | Starts collapsed. First opening uses 22% of the workspace width. Open range 12–36%. |
| Editor Area | Editor tabs, editors and optional split | Always available. The split starts at 50/50 and gives each group at least 25%. |
| Bottom Panel | Output and Tasks beneath the editor and between the sidebars | Starts collapsed. First opening uses 26% of the workspace. Open range 16–60%. |
| Status Bar | Editor status, notifications and task progress | Fixed footer. |

### PaneForge integration

The Workbench body owns the fixed Activity Bar and the nested PaneForge groups. Each group, pane and divider has a stable ID. PaneForge owns geometry, keyboard step size and the last expanded size. The Header, View menu and palette read the pane's expanded state through PaneForge. These controls and activity selection use the same imperative API to change visibility. The PaneForge 1.0.2 patch records sizes when a divider collapses a pane and sends Enter through the same collapse and expand methods as the Header.

Each group saves its layout and remembered expanded sizes using `autoSaveId` in the WebKit profile. The Sidebar Provider supplies CSS tokens and zero-delay tooltips. Primary width follows its PaneForge parent. [PaneForge persistence](https://paneforge.com/docs/examples/persistent-layouts)

When both sidebars are open, each can use up to half the width left after reserving 360 pixels for the editor and room for the dividers. Widening the window restores the preferred pane widths. Pointer and keyboard resizing start from the displayed width.

### Sidebar responsibilities

The Activity Bar follows the fixed icon sidebar from `sidebar-09` and the content and footer structure in `sidebar-16`. The active Activity uses the neutral sidebar accent. An activity selection displays that activity's navigation and reopens the Primary Sidebar when it has items. Hiding the Primary Sidebar keeps the Activity Bar available. User Space is a mock guest popover. Settings opens the application dialog from the next button. [Official sidebar blocks](https://www.shadcn-svelte.com/blocks/sidebar)

## Unified Header

Milo uses Wails 3.1 frameless mode on Linux. Empty Header space uses Wails drag regions, and the menu, Command Center and buttons opt out of dragging. A double-click on empty Header space toggles maximize/restore. The window buttons call the Wails runtime for minimize, maximize/restore and close. The maximize button reads the initial native state and follows Wails window events, including changes from the window manager. Wails handles edge resize and the host sets a minimum window size of 720 × 480. Launch with `MILO_NATIVE_TITLEBAR=1` to use system decorations on Linux. Other platforms use system decorations by default. The Workbench Header stays available with system decorations and in browser previews. [Wails frameless windows](https://v3.wails.io/features/windows/frameless/)

The Command Center opens the existing local palette and displays its shortcut. Stage 06 adds the Action and Search modules and connects them to the palette. File opens the palette and can quit the native app. Edit opens Settings. View controls the three panes and exposes editor operations, including split, navigation, focus and close. It also opens Output, Tasks and the Notification Center. Help opens Welcome. Menubar supports keyboard navigation and View exposes each pane's open state as a checkmark.

The Command Center, pane controls and window controls share a zero-delay tooltip. Button hover states and menu opening use immediate visual feedback.

## Menu Registry

The trusted Workbench builds the application menu from a local typed registry. A section is a top-level menu. Items, groups, separators and submenus use a parent ID to join an existing section, group or submenu. Siblings sort by order with registration order breaking ties. Contributions support visibility and enabled predicates. An item references an action ID and may supply a checked predicate and a shortcut label. The label displays a shortcut and actual key bindings remain with the shortcut handler.

Each registration has an owner and a globally unique menu ID under that owner's namespace. Registering returns a disposer. The registry also supports unregistering by ID and removing all entries owned by one owner. Removing a parent makes its descendants unreachable. Surviving registrations from other owners can reappear when a compatible parent returns. Selection rechecks that the item and its ancestors are still available and resolves the action using its ID and the item's owner.

Stage 06 replaces the Workbench's local action resolver with the Action module. Stage 07 connects menu declarations and cleanup to the shared Contribution Registry. The future extension host will derive owner identity from the session, validate attachment targets and authorize action invocation against that identity and the session's capabilities. [Module contracts](MODULES.md#action) · [Extension contributions](EXTENSIONS.md#menu-contributions)

## UI standards

Use Svelte 5 runes for new reactive state where appropriate, TypeScript strictness, current shadcn-svelte primitives and Tailwind semantic colors. Neutral Zinc, light/dark/system via Mode Watcher. Prefer Lucide icons, accessible names, keyboard focus indicators, compact spacing and restrained transitions. No IBM Carbon dependency or theme. Avoid duplicating components or creating a second design system. Reuse existing primitives and svelte-dnd-action where appropriate. Add dependencies when the implementation has a concrete consumer.

## Tab and editor model

An editor type declares its namespaced ID, owner, title, optional Lucide icon, lazy Svelte loader and singleton or resource behavior. A resource is a stable opaque string interpreted by its editor type. Resource registrations describe the reference and can opt in to restoring supported references. Singleton registrations can opt in to restoration. Registrations can disable preview.

An editor tab has its own instance ID, owner ID, editor type ID, optional resource reference, title and icon metadata, group ID, and pinned, preview and dirty flags. Each editor group keeps an ordered list of instances and its own active tab. The Workbench also tracks the focused group. The manager deduplicates resource opens by type and reference within the target group. **Open New Instance** opens an independent instance of a resource. Singleton editors focus their existing instance across groups.

The registry rejects duplicate IDs and validates owner namespaces. Registration returns a disposer and the registry supports removing all registrations for an owner. Renderer loads are shared by a live registration. The group mounts only its active renderer and shows loading, unavailable and retry states as appropriate. Editor sessions are keyed by tab instance and remain available across renderer unmounts, focus changes and group moves.

### Tab operations and previews

The primary sidebar opens each sample in preview. The Open tab menu and palette open permanent tabs. Each group has at most one preview. Opening another preview replaces that eligible tab in place. The preview label is italicized. Double-click, **Keep Open**, editing, pinning or opening the resource permanently promotes it. Dirty and pinned tabs stay open when a new preview replaces an eligible clean preview.

Closing an active tab prefers the previous remaining tab and then the next at the start. Close Others, Close to the Right and Close All protect pinned tabs. Explicitly closing a pinned tab is supported. Pinned tabs stay at the front when reordered. Reopen keeps up to 20 recently closed entries in memory, skips unavailable editors and restores the tab in the focused group. Automatic preview replacements do not enter the history.

### Dirty state and close

An editor type can create a per-instance session with a state change callback and optional `save`, `discard` and `dispose` operations. Renderers receive the session and the manager-backed save and discard operations. The session reports dirty state on edits. A provider returning `true` completes save or discard. A failed operation, cancellation or a new edit that arrives during an asynchronous operation keeps the editor open. Disposal releases the session after closing or replacing a clean preview.

One shadcn-svelte Alert Dialog handles individual, bulk, group, owner and application close decisions. Cancel leaves the requested tabs open. For bulk closes the manager collects decisions before performing them, then runs saves before discards and removes tabs once operations succeed. Group close preserves pinned tabs by moving them with their sessions to the remaining group. Quit checks all groups, including inactive and pinned tabs. The Go host uses Wails 3.1 `RegisterHook` on `WindowClosing` and `ShouldQuit` to relay the request to the same manager. The browser preview uses the browser's reload and close confirmation while dirty. [Wails window events](https://v3.wails.io/features/windows/events/)

### Groups and keyboard

**Split Editor Right** creates or focuses a right group and opens the current resource there as a separate instance when possible. Singleton tabs can be moved to the right group. Drag tabs along or between the tab bars, or use the context menu for keyboard-accessible reorder and move actions. Moving preserves identity, pins and drafts. A moved preview becomes permanent if the destination already has a preview. The split resizer supports pointer and keyboard input. **Close Editor Group** returns to a single group. The first PaneForge pane stays mounted when the second pane and its divider appear or disappear. With one group, closing its last tab leaves a usable empty editor area.

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

The `milo.workbench` key stores version 3 and an `editor` object with `focusedGroupId` and ordered `groups`. Groups store IDs, active tab IDs and ordered tabs. Persisted tab fields are `id`, `ownerId`, `editorTypeId`, optional `resource`, `pinned` and `preview`. The registry supplies presentation metadata on restore. Validation skips duplicate IDs, missing editor registrations and unavailable resources. Version 1 tabs migrate from view IDs to instance IDs while preserving pins, order and focus. Initial PaneForge layouts import compatible versions 1 and 2 pane sizes and visibility. A legacy split size remains available if the split has yet to mount.

The snapshot contains metadata only. Dirty state, draft text, saved demo text, renderer data and close history stay in memory. Sample and Sample B exercise the same resource type with two stable references. Save updates the in-session resource and new instances read that saved text. Restart restores the tab metadata and loads the built-in sample text. Legacy Appearance and Settings tab entries are dropped. Preferences remain available in the Settings dialog. A compatible `milo.state.mode` theme transfers to Settings once, preserving any existing Go override.

## System modules

- **Settings** opens as a modal from the Activity Bar, Edit menu or palette. The `sidebar-13` layout uses a fixed category sidebar and independently scrollable settings content. Categories come from the existing Settings projection. Search matches across categories. Each preference can be reset individually, and resetting a category asks for confirmation. Theme, notification toasts, editor status and the minimum capture level take effect across the Workbench. [Official settings block](https://www.shadcn-svelte.com/view/sidebar-13)
- **Output** filters retained logs by minimum visible severity, owner and text. Select rows to copy specific records or copy all matching rows. Auto-scroll and clear controls operate on the Output view.
- **Tasks** shows active progress, supported cancellations and recent outcomes. If any active operation has indeterminate progress, the footer shows an indeterminate aggregate. Otherwise it shows the average across active tasks. Clicking the indicator opens Tasks. The Cancel control signals Go and shows Cancelling until execution finishes.
- **Notifications** opens from the footer bell or View. The footer count tracks unread entries. The center marks one or all as read, dismisses individual entries, and clears the in-app history. Toasts and the center use the same Go projection.

Output and Tasks use shadcn-svelte Tabs. The header has the tab list on the left. In Output, the level and owner selectors and text filter precede the Copy button. At narrow widths the Output controls can wrap below the tabs. The active content fills the width below the header and scrolls within the pane. The tab views mount on the first expansion and stay mounted when the panel closes. The collapsed panel skips layout and Output auto-scroll, and keeps the selected tab and filters. Go tasks continue running. System menu entries use the owner-scoped Menu Registry and local command adapter. [Module APIs](MODULES.md#implemented-services)

## Activity contributions

Trusted Workbench code can use `activityRegistry.register` to supply an Activity Bar entry and its Primary Sidebar navigation. A registration includes an owner, a namespaced ID, title, optional icon and navigation items with actions. The registry publishes live changes and supports disposal and owner cleanup. The built-ins register Views with their editor choices and Tasks with its existing panel action. The Menu Registry and Editor Registry retain their existing contracts. [Extension contributions](EXTENSIONS.md)

## Planned contributions

Stage 07 generalizes owner-scoped registration for menu entries, activity entries, views, editor types, header actions, panel views, footer status items and command/search registrations. Stable namespaced IDs, order, region, title and icon are metadata. Every registration returns a disposer, rejects duplicates and is removed when the owner stops. Use one shared registry contract for modules and extensions; trusted module components can lazy-import local Svelte files, extension UI goes through the isolated rendering mechanism described in [EXTENSIONS.md](EXTENSIONS.md).

The extension host will route external declarations through the shared registry. The shell reads the resulting registrations and keeps the editor area available when there are no contributions.
