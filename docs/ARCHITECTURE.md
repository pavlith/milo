# Milo architecture

## Implemented through Stage 06

- `main.go` starts the native application. `app/` composes the window and the `Host` Wails service. Wails runs startup and shutdown hooks, serves embedded production assets, and uses the loopback Vite dev server during development.
- The mounted Workbench invokes the generated `WorkbenchReady` binding. The host sends the typed, window-scoped `milo:host-ready` event with the product name. Generated TypeScript lives in `frontend/bindings/`. The host uses Go `slog` for lifecycle messages.
- `core/` resolves Linux application paths under the XDG config, data and cache roots with the `milo-platform` suffix. It resolves paths without creating directories. GTK uses `io.github.pavlith.milo.platform` for desktop integration, and WebKit uses that identifier for its Linux data and cache profile.
- `frontend/` contains the Svelte Workbench and the pnpm workspace. It renders seven regions and one or two editor groups. The unified Header hosts the application menu, Command Center and layout and window controls. Nested PaneForge groups store layout in the WebKit profile. Workbench storage version 3 retains validated editor group and tab metadata. [App Shell](WORKBENCH.md#app-shell)
- On Linux the host configures Wails frameless mode and exposes its choice through Wails flags. The Header calls window operations through the official runtime and observes native maximize/restore events. System decorations are available as a launch option. [Unified Header](WORKBENCH.md#unified-header)
- The local typed Menu Registry owns application menu composition. Items reference the same actions as the palette, keyboard shortcuts and Workbench controls. [Menu Registry](WORKBENCH.md#menu-registry)
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

Built-in service code lives in `modules/`. Future public contracts and clients belong in `sdk/`, with independently buildable examples in `extensions/examples/`. Add these directories with their first consumers. Keep the host in one Go module until independent SDK packaging requires a boundary.

## Built-in module lifecycle

`app.Run` creates one `core/module.Manager` per desktop host. The pinned Wails 3 nightly orders services by registration and supplies an application-lifetime context. Milo uses the existing Host service as the single entry point for module startup and shutdown. The manager adds graph validation, deterministic dependency traversal, partial-start rollback and per-module resource disposal. Its inventory is a Go API within the trusted host. Workbench readiness continues to use the existing generated call and window-scoped event. [Module contract](MODULES.md#common-lifecycle)

The native close and quit gates still wait for the Workbench's dirty-editor decision. Approved shutdown reaches `Host.ServiceShutdown` with a fresh deadline because Wails cancels the application context before shutdown hooks run. Cancelled close leaves the modules running.

## System module data and events

The composition root registers Settings, Logger, Notify, Task, Action and Search in one Module Manager. Logger depends on Settings and Action. Task depends on Logger, Notify and Search. Action and Search own their registries and have independent lifecycles. Only the Host has Wails lifecycle hooks. Each module provides a small Workbench facade for generated bindings, while producer methods such as task execution, notification publication and logging stay in Go. [Module APIs](MODULES.md#implemented-services)

Settings stores versioned JSON under the XDG config root. Logger, Notify and Task keep bounded in-memory histories. The Workbench maintains one projection per service. It listens for revisioned deltas before requesting the snapshot, discards covered updates, and refreshes the snapshot when it detects a revision gap. The host dispatches module events through the Workbench window's bounded Wails queue. Svelte components share projections and release subscriptions when the last view unmounts. PaneForge and the editor workspace persist to the WebKit profile. Settings opens in a modal backed by the same Go projection. [Workspace storage](WORKBENCH.md#workspace-storage)

## Action and Search boundary

A Workbench action is either a local handler or a projection of registered Go metadata. Local layout, tab and dialog changes run in Svelte through the same dispatcher used by menu items and keyboard shortcuts. Go handlers run via generated Wails methods with cancellable contexts. Each side validates data and checks the context and ownership rules available at its boundary. Go receives action IDs, arguments and Workbench context flags. Trusted host services independently enforce their own state and data constraints.

Search providers run independently. The Workbench merges results as each local provider or Go call completes. It preserves provider ordering and discards responses from superseded requests. Provider lookup, deadlines and limits are enforced in Go for native providers. The Workbench cancels their generated Wails calls when queries change, a provider is removed or the dialog closes. Native catalog changes use typed window-scoped invalidation events. Frontend-only handlers, icons and provider code stay in Svelte. [Action and Search contracts](MODULES.md#action)

## Planned extension runtime

Extension discovery, activation and supervision belong to Stage 08. The host will derive owner identity from authenticated sessions and bind resource cleanup to activation. Structured domain data can use SQLite where warranted. Credentials will use an OS keyring or another documented secure mechanism when a real consumer requires it. [Extension boundary](EXTENSIONS.md)

## Current frontend mechanisms and planned transitions

| Current mechanism | Planned transition |
| --- | --- |
| PaneForge layout keys, version 3 `milo.workbench` storage and Go-owned durable settings | Move restorable workspace metadata to host persistence as its contract matures. |
| Owner-scoped Editor Registry, Editor Manager and two-group layout | Stage 07 connects editor registrations and disposers to the shared Contribution Registry. Stage 08 supplies an isolated renderer through the extension host and uses protected owner cleanup before deactivation. |
| Owner-scoped action and provider registration | Stage 07 can route contributions through the existing registration APIs and bind their disposers to an activation. Svelte retains keyboard routing and presentation. |
| Owner-scoped Activity Registry | Stage 07 connects activity and navigation declarations to the shared Contribution Registry. |
| Owner-scoped Menu Registry with Action references | Stage 07 moves contribution registration and lifecycle cleanup under the shared registry. The host authorizes extension contributions and action references using authenticated identity and capabilities. |
| Revisioned Go system module projections and owner-scoped local Workbench registrations | Stage 07 registers panel and footer contributions through the shared registry. |
