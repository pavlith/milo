# Built-in Modules

These seven trusted host services are mandatory for Core MVP. Their contracts and Workbench contributions are planned. Each module may register UI contributions and actions using the same owner-scoped semantics as extensions. Keep contracts small and introduce shared infrastructure with its consumers.

| Module | Responsibilities | Workbench contributions |
| --- | --- | --- |
| settings | Typed schemas, defaults, validation, global/owner-scoped values, persistence, change events | Settings editor; header/left action |
| notify | Toasts, persistent/limited notification inbox, severity, action references, read/dismiss | Footer badge, notification center |
| logger | Structured records with timestamp, level, owner, message, bounded buffer, redaction | Output panel, filter and clear |
| task | Go-owned registration, progress, cancellation, outcomes and bounded history | Footer progress indicator and Tasks view in the bottom Panel |
| search | Provider registration, cancellation, bounded result sets, result activation | Header quick search, primary Search view |
| action | Namespaced command registry, invoke, availability, shortcut binding and conflict handling | Command Palette, menu and toolbar integration |
| extensions | Installed package inventory, validation, activation state, enable/disable, local install/uninstall | Left activity item, Extensions editor |

Storage, secrets and events are platform facilities with module facades only if needed; avoid duplicate lifecycle or redundant abstractions. Minimal persistence and events are needed early. Secrets may be deferred until a real consumer; never fake a secure store. Theme is a settings/workbench concern initially. Update, network and clipboard modules are outside Core MVP.

## Common lifecycle

Stage 04 implements the Go lifecycle in `core/module`. The production inventory is empty. In Stage 05, construct Settings, Notify, Logger and Task in `app.Run`, inject typed collaborators through their constructors, and call `Manager.Register` for each service before handing the host to Wails. Return registration errors from the composition root.

| `module.Definition` field | Contract |
| --- | --- |
| `ID string` | Stable, unique, nonempty name without whitespace or control characters. |
| `Dependencies []string` | IDs that must be running before Start. Repeated dependency IDs are rejected. |
| `Start func(context.Context, *module.Scope) error` | Acquire resources and record disposers as each acquisition succeeds. The context spans the module's running lifetime. |
| `Stop func(context.Context) error` | Stop work within the shared shutdown deadline. Must tolerate partial startup. |

Bind concrete Go methods to these fields at registration. Dependency IDs describe ordering. Constructors receive the actual typed service interfaces. The manager copies dependency lists. `Lookup(id)` and `Inventory()` return independent lifecycle snapshots containing ID, dependencies, state and the latest error text. Inventory is sorted by ID.

The first start or shutdown closes registration permanently. Start checks the whole graph for missing dependencies and cycles before invoking any callback. It traverses module IDs and each dependency list in lexical order, starting each dependency before its consumer. States progress from registered to starting and running. Stop and rollback visit attempted modules in reverse order, moving through stopping to stopped or failed. Modules that were never attempted stay registered.

All registered modules are essential in Stage 04. On error or cancellation during startup, the manager cancels the lifetime context, stops the partially initialized module and rolls back earlier starts with a fresh five-second cleanup budget. Start returns joined initialization and teardown errors. Shutdown cancels the running context, waits for any active start and shares one teardown result across calls. A caller with a shorter deadline can stop waiting. Ordinary teardown uses the first shutdown caller's context with a five-second cap. Stop functions and disposers must cooperate with cancellation, including when earlier callbacks have consumed the budget. A blocked in-process goroutine can outlive a deadline. Lifecycle transitions and errors are recorded through `slog`.

### Owner-scoped cleanup

Each attempted start receives its own scope. Use `scope.Add(func(context.Context) error)` for event unsubscription, action removal, or cancelling and joining a worker. Successful registration transfers responsibility to the scope. If registration is rejected, the caller still owns the resource. Before calling Stop the manager closes that scope to new registrations. It then runs all accepted disposers once in reverse registration order, including after Stop errors. Dependencies retain their resources until their own turn.

Workbench menu and editor registrations already carry an owner. Future adapters can associate their disposers with the same lifecycle, using the editor manager's protected owner-close operation before removing editor types. Svelte owns renderer instances. The shared Contribution Registry is planned for Stage 07.

## Menu contributions

The Stage 02 Workbench Menu Registry supports trusted local registration of independent top-level sections and individual groups, separators, submenus and items in existing sections. A module can contribute layout items to View. Each item names an action ID. Its owner, visibility and enabled state travel with the registration. The registry can remove contributions by owner, and the future module lifecycle will call that cleanup at stop or after failed activation. Stage 07 brings menu contributions under the shared Contribution Registry. [Menu Registry](WORKBENCH.md#menu-registry)

## Contract expectations

### settings
Register a namespaced schema including type, default and validation. Get/set/reset/list and watch changes. Reject invalid/unknown writes unless a documented extension migration path applies. Persist atomically; return immutable or copied values. Extension settings are scoped to the authenticated owner, not a caller-supplied spoofable ID. Sensitive values belong in secrets, not settings.

### notify
Publish a notification with severity, title, optional plain text, owner, timestamp and optional action IDs. List unread/read, dismiss and clear. Bound retained history; avoid leaking private text in desktop notifications by default. Only invoke registered permitted actions; never execute raw strings.

### logger
Accept structured levels and fields. Bound payloads, redact secrets, provide owner/level filters, and use rotation if writing files. Output panel receives incremental records; do not mount all history. Extension logs cannot impersonate other owners.

### task

Stage 05 introduces the Task service. Go owns task execution and lifecycle, including background operations registered by trusted services. An operation has an authenticated owner, a unique namespaced ID, a display label, timestamps and a status. Use running tasks and terminal outcomes of succeeded, failed or cancelled. Task snapshots carry determinate progress with a validated current value and total, or indeterminate progress when the total is unknown.

Go runs background work in goroutines scoped to a cancellable `context.Context`. Cancellation requests signal the context, and cooperative worker exit determines when execution has finished. Use channels for signalling or updates where suitable and standard synchronization for concurrent registration, snapshots, progress and finalization. Cancellation and finalization are safe under concurrent requests. Reject late progress updates after completion. Store a bounded in-memory history of completed tasks and expose a completion event for each terminal outcome with a user-safe error summary on failure. Record structured, redacted diagnostics through `logger`. Use `notify` for actionable outcomes, with routine progress shown in the Workbench.

Use owner-scoped cleanup on extension deactivation and host shutdown. Close registration for stopping owners, cancel their active tasks, wait within the shutdown budget and release live task registrations and subscriptions. The host supervises and terminates an unresponsive extension process when its grace period expires. In-process Go workers must cooperate with context cancellation. Other owners stay active when one extension deactivates. Retained history remains bounded and contains no live callbacks or private payloads.

The trusted Svelte Workbench reads snapshots and subscribes to state updates through Wails. The footer shows aggregate progress and opens the Tasks view in the bottom Panel. The Tasks view shows active tasks, progress, status, errors and recent outcomes, and calls supported operations such as cancellation through generated bindings. Future extension access goes through capability-scoped SDK contracts.

### action

Stage 06 will replace the local menu action resolver and connect the Command Center and palette to the Action and Search modules. The Menubar can keep rendering and selecting registered items through the same action adapter. The Action module checks the requesting owner, permissions, context and arguments at dispatch.

Register namespaced ID, title, optional icon/shortcut, context predicate and handler. Invoke by ID with validated arguments, report unavailable and missing actions. Registry handles duplicate IDs, shortcut conflicts, owner cleanup and cancellation. Native/UI/extension action dispatch share the same semantics; frontend handlers and backend handlers need not share one implementation language. Commands from untrusted UI pass capability checks.

### search
Register providers with ID, label, optional scope and a cancellable query handler. Aggregate results progressively, bound per-provider count and use timeouts. Result includes owner, stable result ID, title, optional description and a registered action or resource reference. Provider error must not kill global search. No domain indexing or arbitrary query execution in Core. Do not send search queries to remote providers without explicit configured permission.

### extensions
Manage package metadata and lifecycle via host facade. Local trusted development install is MVP; network marketplace later. UI reflects installed, disabled, starting, active, failed and incompatible states. It must not imply third-party sandboxing unless implemented and verified.

## Verification

Use focused unit tests for duplicate/cleanup behavior, persistence validation, search cancellation, action conflicts and error paths. Add a simple module UI smoke test and verify native output/notifications in the relevant stages. A module must work with zero installed extensions.
