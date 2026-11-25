# Milo architecture

## Implemented through Stage 03

- `main.go` starts the native application. `app/` composes the window and the `Host` Wails service. Wails runs startup and shutdown hooks, serves embedded production assets, and uses the loopback Vite dev server during development.
- The mounted Workbench invokes the generated `WorkbenchReady` binding. The host sends the typed, window-scoped `milo:host-ready` event with the product name. Generated TypeScript lives in `frontend/bindings/`. The host uses Go `slog` for lifecycle messages.
- `core/` resolves Linux application paths under the XDG config, data and cache roots with the `milo-platform` suffix. It resolves paths without creating directories. GTK uses `io.github.pavlith.milo.platform` for desktop integration, and WebKit uses that identifier for its Linux data and cache profile.
- `frontend/` contains the Svelte Workbench and the pnpm workspace. It renders seven regions and one or two editor groups. The unified Header hosts the application menu, Command Center and layout and window controls. Workbench storage version 2 contains pane preferences and validated editor group and tab metadata. [Workbench behavior](WORKBENCH.md#implemented-through-stage-03)
- On Linux the host configures Wails frameless mode and exposes its choice through Wails flags. The Header calls window operations through the official runtime and observes native maximize/restore events. System decorations are available as a launch option. [Unified Header](WORKBENCH.md#unified-header)
- The local typed Menu Registry owns application menu composition. Its local action adapter routes editor actions also used by the command palette and keyboard shortcuts. [Menu Registry](WORKBENCH.md#menu-registry)
- The typed Editor Registry resolves owner-scoped editor types and lazily imports Svelte renderers. The Editor Manager owns tab instances, independent group state and editor sessions. Svelte mounts the active renderer in each group. A single Workbench dialog handles dirty close decisions and lifecycle failures. [Editor contracts](WORKBENCH.md#tab-and-editor-model)
- Wails intercepts native close and application quit. The host sends a scoped close request to the live Workbench and resumes close after the editor manager approves it. The editor layout stays available for workspace restoration. [Dirty-state lifecycle](WORKBENCH.md#dirty-state-and-close)

## Platform boundaries

| Layer | Responsibility |
| --- | --- |
| Core | Bootstrap, platform paths, service lifecycle, registration infrastructure, IPC and extension supervision |
| Modules | Trusted system services and their Workbench contributions |
| Extensions | Independently installed domain logic, domain storage and UI |
| Workbench | Svelte rendering, layout, tabs, reactive UI state, keyboard interaction, themes and translations |
| SDK | Versioned public schemas, protocol and clients for capability-scoped extension access |

Go owns system services, background operations, persistent application data and extension supervision. Use standard Go facilities and official Wails services where they fit. Wails 3 owns native desktop integration, lifecycle hooks, service registration, generated bindings and frontend event delivery. Reuse Wails facilities before adding infrastructure, and use one authoritative implementation for each system module.

The trusted Workbench calls a small typed Wails bridge and receives scoped events. A module may expose Go operations through that bridge and contribute a Svelte view. Untrusted extension UI must never receive privileged Wails bindings. The extension host mediates SDK calls and UI messages using session identity and capabilities. SDK clients depend on public contracts without importing host internals or generated Wails bindings. [Extension boundary](EXTENSIONS.md)

Future module code belongs in `modules/`, public contracts and clients in `sdk/`, and independently buildable examples in `extensions/examples/`. Add these directories with their first consumers. Keep the host in one Go module until independent SDK packaging requires a boundary.

## Planned lifecycle and persistence

The composition root starts modules in dependency order and stops them in reverse order. Validate duplicate IDs, missing dependencies and cycles before activation. Roll back partial initialization. All registrations have owners and are disposed when the owner stops. Discovery and activation of extensions follow host readiness. Supervision contains extension failures and completes owner-scoped cleanup even if an extension exits unexpectedly.

Use contexts and bounded work in Go. The Task module tracks and cancels background work, and feeds trusted Workbench projections via Wails. Other modules use Task for operations that need user-visible lifecycle and progress. [Task contract](MODULES.md#task)

Use versioned storage for settings and workspace layout. Store application data under XDG paths and scope extension data to validated owner directories. Use atomic writes for settings and SQLite where structured persistence warrants it. Store secrets via the OS keyring or another documented secure mechanism when a real consumer requires it. Keep secrets out of settings, browser storage, events and logs. Bound event payloads, use typed namespaced topics, and release subscriptions with their owners.

## Current frontend mechanisms and planned transitions

| Current mechanism | Planned transition |
| --- | --- |
| Version 2 `milo.workbench` local storage and Mode Watcher via `milo.state.mode` | Stage 05 moves durable settings such as theme to Go. Move durable workspace layout and restorable tab metadata to host persistence as their contracts mature. Keep Mode Watcher for theme rendering. |
| Owner-scoped Editor Registry, Editor Manager and two-group layout | Stage 07 connects editor registrations and disposers to the shared Contribution Registry. Stage 08 supplies an isolated renderer through the extension host and uses protected owner cleanup before deactivation. |
| Local palette command list and shortcut handlers | Stage 06 adds action and search contracts. Svelte retains keyboard routing, context handling and presentation. |
| Owner-scoped Menu Registry and local action resolver | Stage 06 connects menu invocation to Action. Stage 07 moves contribution registration and lifecycle cleanup under the shared registry. The host authorizes extension contributions and action references using authenticated identity and capabilities. |
| Host lifecycle logs and one readiness event | Keep `slog` and Wails events. Stage 05 adds bounded Output, notifications and Task state using the trusted bridge. |
