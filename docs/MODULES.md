# Built-in Modules

Core MVP has seven trusted host modules. Stage 05 ships four system modules with native Workbench views.

| Module | Status | Workbench contributions |
| --- | --- | --- |
| Settings | Available | Settings dialog |
| Logger | Available | Output tab in the bottom Panel |
| Notify | Available | Toasts, Footer badge and Notification Center |
| Task | Available | Tasks tab in the bottom Panel and Footer progress |
| Action | Planned, Stage 06 | Command Palette, menus and shortcuts |
| Search | Planned, Stage 06 | Provider search in the Workbench |
| Extensions | Planned, Stage 08 | Installed package inventory and activation |

## Common lifecycle

The Go Module Manager in `core/module` runs explicit registrations from the composition root. Logger depends on Settings for its minimum level. Task depends on Logger and Notify for diagnostics and outcomes. Settings and Notify have no declared dependencies. The built-ins start in the order Settings, Logger, Notify, Task and stop in reverse order.

| `module.Definition` field | Contract |
| --- | --- |
| `ID string` | Stable, unique, nonempty name without whitespace or control characters. |
| `Dependencies []string` | IDs that must be running before Start. Repeated dependency IDs are rejected. |
| `Start func(context.Context, *module.Scope) error` | Acquire resources and record disposers as each acquisition succeeds. The context spans the module's running lifetime. |
| `Stop func(context.Context) error` | Stop work within the shared shutdown deadline. Must tolerate partial startup. |

Bind concrete Go methods to these fields at registration. Dependency IDs describe ordering. Constructors receive the actual typed service interfaces. The manager copies dependency lists. `Lookup(id)` and `Inventory()` return independent lifecycle snapshots containing ID, dependencies, state and the latest error text. Inventory is sorted by ID.

The first start or shutdown closes registration permanently. Start checks the whole graph for missing dependencies and cycles before invoking any callback. It traverses module IDs and each dependency list in lexical order, starting each dependency before its consumer. States progress from registered to starting and running. Stop and rollback visit attempted modules in reverse order, moving through stopping to stopped or failed. Modules that were never attempted stay registered.

All registered built-ins are essential. On error or cancellation during startup, the manager cancels the lifetime context, stops the partially initialized module and rolls back earlier starts with a fresh five-second cleanup budget. Start returns joined initialization and teardown errors. Shutdown cancels the running context, waits for any active start and shares one teardown result across calls. A caller with a shorter deadline can stop waiting. Ordinary teardown uses the first shutdown caller's context with a five-second cap. Stop functions and disposers must cooperate with cancellation, including when earlier callbacks have consumed the budget. A blocked in-process goroutine can outlive a deadline. Lifecycle transitions and errors are recorded through `slog`.

### Owner-scoped cleanup

Each attempted start receives its own scope. Use `scope.Add(func(context.Context) error)` for event unsubscription, action removal, or cancelling and joining a worker. Successful registration transfers responsibility to the scope. If registration is rejected, the caller still owns the resource. Before calling Stop the manager closes that scope to new registrations. It then runs all accepted disposers once in reverse registration order, including after Stop errors. Dependencies retain their resources until their own turn.

Settings binds schemas and observers to scopes. Cleanup removes live registrations and preserves stored overrides for a later activation. Task binds each owner handle to a disposer. It stops accepting work from that handle, signals active tasks, and waits within the shared budget. Other owners continue running. The Workbench uses disposable owner-scoped Menu and Editor Registry entries. Stage 07 will link additional view registrations to the shared Contribution Registry. [Workbench integration](WORKBENCH.md#system-modules)

## Implemented services

### Settings

`Register(scope, owner, schemas...)` validates a batch of owner-namespaced schemas. Supported kinds are enumerated choices and booleans. A schema declares an ID, category, label, description, default and the allowed choices when applicable. `Get` and `List` return copies of effective values and override flags. `Set`, `Reset` and `ResetCategory` check ownership, validate values and commit before publishing changes. Trusted consumers can use `Observe(scope, id, fn)`. The observer receives the initial and subsequent values in order. It must return promptly and avoid reentering Settings. The trusted Settings dialog can write the Settings and Logger schemas.

Preferences live in `${XDG_CONFIG_HOME:-$HOME/.config}/milo-platform/settings.json`. The version 1 document holds overrides and the legacy theme migration marker.

```json
{
  "version": 1,
  "themeMigrated": true,
  "values": {
    "settings.appearance.theme": { "text": "dark" },
    "settings.general.notification-toasts": { "enabled": false }
  }
}
```

Writes sync a private temporary file in the same directory and rename it atomically. A missing file uses defaults. Milo renames a malformed file with an `.invalid-<UTC timestamp>` suffix and recovers defaults. Invalid entries in an otherwise usable document fall back to their schema defaults. A newer version remains intact and opens with read-only defaults. Each profile expects one writing Milo process. Store credentials outside Settings.

### Logger

`For(owner)` returns a standard `*slog.Logger` with an owner-scoped handler. The handler captures startup records, forwards sanitized records to the original console sink and retains the latest 300 records in memory. Each record contains a timestamp, severity, owner, message and bounded structured fields. Settings updates the capture threshold in place. The threshold starts at Info until the Logger module loads the persisted value.

The handler redacts recognized credential keys in attributes and nested values, plus common credential patterns in strings. Callers still keep secrets out of messages and fields. `List(Filter)` takes a minimum level, owner and case-insensitive message query. `Clear()` clears the retained records. Output handles live inserts, evictions and clears. It also searches rendered fields. Milo writes no log files.

### Notify

`Publish(owner, Message)` creates a stable ID and stores a timestamped Info, Success, Warning or Error notification with a title and an optional plain-text description. `List`, `MarkRead`, `MarkAllRead`, `Dismiss` and `Clear` operate on the last 100 in-app records. The Workbench shows new publish events as Sonner toasts when enabled. A snapshot restores the center without replaying earlier notifications as toasts. This stage delivers notifications inside the Workbench. The Wails OS notification service can supply an optional delivery route for a future consumer.

Producers can attach references to registered actions. The Stage 05 contract validates the shape and carries references as data. Stage 06 will resolve and authorize these IDs through Action before exposing invocation.

### Task

`AttachOwner(scope, id)` binds one trusted activation to a task owner. `Owner.Start(Options, Operation)` starts a Go goroutine with a cancellation context and a progress reporter. `Options.ID` is relative to the owner. Each execution also has a run number so a stale UI command cannot cancel a later run that reuses the ID. Duplicate active IDs, invalid progress and updates after the operation exits are rejected. Report a fraction between zero and one, or `nil` for indeterminate work. Frequent progress updates coalesce on a 50 ms interval.

`List()` returns active and completed snapshots. The module tracks up to 64 concurrent operations and 50 recent terminal outcomes. `Owner.Cancel(id, run)` scopes cancellation to the owning activation. The trusted Workbench can request cancellation of any active cancellable task. Cancellation signals the context and leaves the task Running until the operation returns. If cancellation wins before finalization, the task ends Cancelled. Otherwise it ends Succeeded or Failed exactly once. Failure reports a safe summary and logs the error type. Failures notify the user, successful runs can opt in, and routine progress stays in the Tasks view.

`Owner.Stop(ctx)` closes the owner immediately and joins its operations within the caller's budget. Owner activation can be reattached after its previous operations release their resources. Shutdown is cooperative. A Go operation that ignores cancellation can continue running after the deadline expires.

## Planned contracts

### action

Stage 06 will replace the local menu action resolver and connect the Command Center and palette to the Action and Search modules. The Menubar can keep rendering and selecting registered items through the same action adapter. The Action module checks the requesting owner, permissions, context and arguments at dispatch.

Register namespaced ID, title, optional icon/shortcut, context predicate and handler. Invoke by ID with validated arguments, report unavailable and missing actions. Registry handles duplicate IDs, shortcut conflicts, owner cleanup and cancellation. Native/UI/extension action dispatch share the same semantics; frontend handlers and backend handlers need not share one implementation language. Commands from untrusted UI pass capability checks.

### search
Register providers with ID, label, optional scope and a cancellable query handler. Aggregate results progressively, bound per-provider count and use timeouts. Result includes owner, stable result ID, title, optional description and a registered action or resource reference. Provider error must not kill global search. No domain indexing or arbitrary query execution in Core. Do not send search queries to remote providers without explicit configured permission.

### extensions
Manage package metadata and lifecycle via host facade. Local trusted development install is MVP; network marketplace later. UI reflects installed, disabled, starting, active, failed and incompatible states. It must not imply third-party sandboxing unless implemented and verified.

## Verification

The focused scenarios in `modules/*/*_test.go` cover settings persistence and recovery, notification publication and dismissal, structured logs, determinate and indeterminate progress, terminal outcomes, cancellation and owner cleanup. `app/modules_test.go` exercises the production registrations and lifecycle. Frontend tests cover snapshot reconciliation, filtering, copy selection, inbox and task updates, and menu ownership. [Stage 05 results](ROADMAP.md#stage-05-verification)
