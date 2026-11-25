# Implementation roadmap

The table records shipped stages and the acceptance criteria for planned work. See [CODEX.md](CODEX.md).

| Stage | Scope | Status | Required acceptance |
| --- | --- | --- | --- |
| 00 | Slicer workbench extraction | Completed | Domain-neutral web shell builds; no active Java/reverse-engineering/script loader code; reusable panes/tabs retained |
| 01 | Go + Wails 3 host | Completed | Linux native dev/build; embedded frontend; clean start/stop; paths and minimal typed host bridge |
| 01.1 | Milo rebrand and architecture consolidation | Completed | Milo Linux build and native smoke; aligned architecture, documentation and Stage 05 Task contract |
| 02 | Seven-region Workbench and unified Header | Completed | Seven regions, native Linux window controls with system fallback, independent persisted panes, owner-scoped menu contributions and neutral shadcn theme |
| 03 | Tabs/editor groups | Completed | Preview, pin, close, reopen, reorder, dirty protection, bounded split, restore and lazy registry resolution |
| 04 | Module lifecycle and registry | Completed | Explicit dependencies/start/stop/cleanup, duplicate/cycle handling, no domain coupling |
| 05 | Settings, Notify, Logger & Task | Completed | Settings persistence, notifications, Output, cancellable Go tasks, bounded history and Task UI with zero extensions required |
| 06 | action, search, palette | Planned | Commands/shortcuts, context conflicts, provider cancellation and empty/error states |
| 07 | Contribution registry | Planned | Owner-scoped views/editors/status/actions; test module can register new types without shell changes |
| 08 | SDK and extension host | Planned | Versioned manifest/protocol, local discovery/activation, lifecycle/permissions, isolated UI spike |
| 09 | Independent Hello World extension | Planned | Separate packaging/install, view and editor tab, action/search/log/notify, disable/re-enable/uninstall, failure isolation |
| 10 | Core 0.0.1 | Planned | Linux build + native smoke; empty and installed profiles; docs, license notices, known limitations |
| 11 | Mail extension migration | Planned | Separate extension using the Milo mail-client donor; no mail imports in Core; mail data/security migration plan |
| 12 | Marketplace and public distribution | Planned | Actual isolation/trust policy, package integrity, publisher validation, update rollback and registry UI |

Stages 00–10, including 01.1, make up Core MVP. Its mandatory modules are `settings`, `notify`, `logger`, `task`, `search`, `action` and `extensions`. Mail, Contacts and Calendar are independent follow-up extensions. Public third-party distribution depends on the isolation and trust requirements in Stage 12.

## Stage 00 verification

Commit `013444b` extracted the domain-neutral shell from Slicer and is the first commit in Milo. It retained reusable pane resizing, one editor group with three lazy local views, tab metadata and theme persistence, shadcn-svelte primitives and reusable CodeMirror components. The extraction removed Java analysis, decompilers, JDK and workspace search, remote imports and sharing, and the script runtime and its SDK.

The baseline in the original Slicer repository used Node.js 26.13.0 and pnpm 10.19.0. The final test, type-check, and build used the pinned Node.js 22.19.0 with pnpm 10.19.0. [Slicer baseline `8e08277`](https://github.com/pavlith/slicer/commit/8e082774fddb293859c0f3ae7ccb6c07bb6bf5a5)

| Check | Baseline | Stage 00 result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Passed. pnpm reported skipped build scripts for `sharp`. | Passed in a clean temporary directory with the final manifests and lockfile. |
| `pnpm test` | No test script. | Eight tests passed for tab operations, pinned protection, ordering, and validated state restore. |
| `pnpm check` | Passed with two CSS warnings for `app-region`. | Passed with zero errors and zero warnings. |
| `pnpm build` | Passed with warnings for browser-externalized decompiler imports, direct `eval`, ineffective dynamic imports, and plugin timings. | Passed without warnings. |
| `pnpm preview --host 127.0.0.1 --port 4173 --strictPort` and Chrome 157 headless smoke | — | Verified all seven regions, opening and focusing tabs, keyboard palette search, pinning, pointer and keyboard reorder, bulk and explicit close, horizontal and vertical resize, collapse, reload, corrupt-state recovery, and light/dark/system modes. No client warnings or exceptions. |
| Production artifact and request audit | — | Source, lockfile and `dist/` contained no removed domain or loader markers. The production build emitted no WASM assets. The browser ignored the old script and remote-file query parameters and made no corresponding requests. |

The Stage 00 editor used one tab instance per local view. The secondary sidebar and bottom panel contain neutral empty states. New strings use English fallback in locales where a translation is unavailable. Browsers may reserve Ctrl+W for the browser tab.

## Stage 01 detail — native Linux host

Commit `5703287` added the native window under the historical Slicer name. The existing frontend and its updated pnpm dependencies moved to `frontend/`. Wails 3.1.0 uses GTK4 and WebKitGTK 6.0, the Wake build configuration, and an embedded production frontend. The backend resolves config and cache paths using Go's XDG-aware path functions. The workbench uses a generated TypeScript binding and a window-scoped typed event when it mounts.

Verification used Ubuntu 26.10 on Linux amd64, Go 1.27.3, GTK 4.24.1, WebKitGTK 2.52.6, Node.js 26.13.0 and pnpm 10.19.0.

| Check | Result |
| --- | --- |
| `wails3 generate bindings -ts -i -d frontend/bindings` | Generated the host service binding and typed event definitions. |
| `pnpm -C frontend check`, `pnpm -C frontend test`, `pnpm -C frontend build` | Zero type errors or warnings, eight passing workbench tests and a successful Vite production build. |
| `go test ./...`, `go vet ./...` | Passed. The Core test covers Linux default paths and XDG overrides. |
| `WAILS_EXP_USE_WAKE=1 wails3 build` | Built `bin/slicer`, an amd64 ELF linked against GTK4 and WebKitGTK 6.0. |
| `WAILS_EXP_USE_WAKE=1 wails3 dev` and WebKit smoke | Vite served on loopback and the native window rendered the workbench. Verified the generated Go call and typed event payload, opening and closing tabs, toggling all three panes, applying light and dark styles, and selecting system mode. Ctrl+C ran the shutdown hook and exited with code 0. |
| Production binary from a separate working directory | Embedded workbench opened with no dev server. Native accessibility actions verified tab activation and closing, visibility of all three panes, and persistence of light, dark and system preferences. Closing the window ran the service shutdown hook and exited with code 0. |

GTK 4.24 emits deprecation warnings for Wails' X11 calls when compiling the dependency, and JavaScriptCore reports that it overrides an existing signal handler at startup. Closing the dev window before stopping Wake runs the service shutdown hook, but the Wake supervisor reports a backend exit and returns code 1. Stop dev with Ctrl+C in the terminal. Linux was the verified platform. Workbench preferences used WebKit local storage.

## Stage 01.1 verification

**Completed.** Commit `2168136` rebrands the platform as Milo. The GTK ID and XDG paths keep the platform's profile separate from the mail-client donor. Milo starts with a fresh WebKit profile. Stage 01 stored only local Workbench preferences, so this stage did not add a profile migration. The public Go namespace remains open. [Repository identity](../README.md#repository-and-license)

Verified on Ubuntu 26.10 amd64 with Go 1.27.3, GTK 4.24.1, WebKitGTK 2.52.6, Wails 3.1.0, Node.js 26.13.0 and pnpm 10.19.0.

| Check | Result |
| --- | --- |
| `pnpm -C frontend install --frozen-lockfile --offline` | Passed. The lockfile's root importer contains dependencies and has no package name field. The dependency pins and lockfile stayed intact. |
| `wails3 generate bindings -ts -i -d frontend/bindings` | Passed. Generated the service under `milo.local/platform` and the typed `milo:host-ready` event. The native build regenerated the same files. |
| `pnpm -C frontend check`, `pnpm -C frontend test`, `pnpm -C frontend build` | Zero type errors or warnings, eight passing Workbench tests and a successful production build. |
| `go test ./...`, `go vet ./...` | Passed. The Linux path test covers defaults and overrides for config, data and cache. |
| `WAILS_EXP_USE_WAKE=1 wails3 build` | Produced `bin/milo` and the Wake artifact `milo`. The amd64 ELF links to GTK4 and WebKitGTK 6.0. |
| `desktop-file-validate build/linux/io.github.pavlith.milo.platform.desktop` | Passed. |
| Native production smoke with an isolated XDG profile and separate working directory | The embedded Workbench rendered in the Milo window and the readiness binding reached Go. Verified the GTK-scoped WebKit data and cache paths, opening and closing tabs, toggling three panes, and persistence of light, dark and system preferences. Closing the window ran the shutdown hook and exited with code 0. |
| Repository-wide case-insensitive identifier search | Remaining Slicer references are source attribution, the original Slicer repository URL and historical roadmap evidence. Application code, build configuration and generated bindings use Milo identifiers. |

Distribution packaging is outside this verification. JavaScriptCore still reports the pre-existing signal handler override during startup. The native smoke passed and exited cleanly.

## Stage 02 verification

The Workbench has a 36 px unified Header, the existing palette behind the Command Center, independent PaneForge sidebars and panel, and a shadcn-svelte Menubar backed by the local Menu Registry. The version 1 workspace format remains readable. Stages 06 and 07 will integrate Action and the shared Contribution Registry. [Workbench contract](WORKBENCH.md)

Verified on Ubuntu 26.10 amd64 with Go 1.27.3, GTK 4.24.1, WebKitGTK 2.52.6, Wails 3.1.0, Node.js 26.13.0 and pnpm 10.19.0.

| Check | Result |
| --- | --- |
| `pnpm -C frontend check`, `pnpm -C frontend build` | Passed with zero frontend errors or warnings. |
| `pnpm -C frontend test` | 12 tests passed. Coverage includes ownership, ordering, nested menu registration, removal and guarded dispatch, workspace size restoration and existing tab operations. |
| `go test ./...`, `go vet ./...` | Passed. |
| `WAILS_EXP_USE_WAKE=1 wails3 build` | Built `bin/milo` with embedded frontend assets on Linux amd64. |
| Chrome headless smoke on the production frontend | Verified the seven regions, 36 px Header, keyboard navigation and View checkmarks, independent pane controls, pointer resizing of all three panes, reopen and reload, invalid workspace recovery, Light, Dark and System themes, and tab open, pin, reorder and close. No client warnings or exceptions. |
| Native production smoke on GNOME Wayland | Started from a separate working directory with isolated XDG storage. Verified maximize and restore controls, all pane toggles, theme persistence, tab open and close, and clean shutdown through the custom Close button. |
| Native production smoke on X11 with Xvfb and Openbox | Verified drag from empty Header space, Command Center exclusion from drag, edge resize, double-click maximize and restore, reactive icons after window manager actions, and minimize. Verified system decorations and close with `MILO_NATIVE_TITLEBAR=1`. After restart with the prior XDG profile, verified the active tab and theme, then quit cleanly using File → Quit Milo from the keyboard. |

Pointer drag and resize were verified on X11. Wayland pointer behavior and other platforms were outside the smoke coverage. Wails 3.1 leaves the GTK frame title empty in frameless mode. Launch with `MILO_NATIVE_TITLEBAR=1` on Linux for system decorations. GTK's Wails X11 deprecation warnings and the JavaScriptCore signal handler message also appeared in the Stage 01 environment.

## Stage 03 verification

Stage 03 adds the typed Editor Registry, independent editor instances and up to two resizable groups. One dirty-close lifecycle covers tabs, groups, owner cleanup and native close or quit. Workbench storage version 2 migrates version 1, restores supported resources and keeps sample content in memory. [Workbench editor contracts](WORKBENCH.md#tab-and-editor-model)

Verified on Ubuntu 26.10 amd64 with Go 1.27.3, Wails 3.1.0, GTK 4.24.1, WebKitGTK 2.52.6, Node.js 26.13.0, pnpm 10.19.0 and Chrome 157.

| Check | Result |
| --- | --- |
| `pnpm -C frontend test` | 23 tests passed. Coverage includes tab identity, singleton and resource behavior, previews, dirty close, save failure and cancellation, pinned tabs, groups, moves, history, registry ownership, unavailable renderers and persistence. |
| `pnpm -C frontend check`, `pnpm -C frontend build` | Passed with zero frontend errors or warnings. Welcome, Appearance and Sample were emitted as lazy renderer chunks. |
| `go test ./...`, `go vet ./...` | Passed. Host tests cover startup close, pending request cancellation and rejection of stale decisions. |
| `WAILS_EXP_USE_WAKE=1 wails3 build` | Generated the typed close event and binding and built the Linux amd64 binary with the embedded frontend. |
| Chrome headless on the production frontend | Verified the seven regions, lazy renderer loading, preview replacement and promotion, resource duplicates, shortcuts and palette, dirty tab moves by drag and keyboard, direct Save and Discard, pointer and keyboard split resizing, group close confirmation, reload, v1 migration, corrupt storage recovery and all three theme modes. No client warnings or exceptions. |
| Native production smoke on X11 with Xvfb and Openbox | Launched from a separate working directory with an isolated XDG profile. Cancel preserved the sample draft when closing via the custom window control, File → Quit and the window manager's Alt+F4 with system decorations. Save and Discard each allowed a clean host shutdown. Restart restored the sample tab. |

Sample text and recent close history live in the current session. Layout and supported tab references survive restart. The split is horizontal and bounded to two groups. Browser-reserved shortcuts depend on the browser. Linux X11 was the native verification target for this stage. The isolated X11 smoke reported Mesa's DRI3 warning and the pre-existing JavaScriptCore signal handler message.

## Stage 04 verification

The desktop Host starts and shuts down a per-host module manager through the Wails service hooks. The manager validates the complete graph, reports lifecycle snapshots, rolls back partial startup and releases each owner's resources. All registered built-ins are essential. Stage 05 will supply the first production registrations. [Module contract](MODULES.md#common-lifecycle)

Verified on Ubuntu 26.10 linux/amd64 with Go 1.27.3 and Wails 3.1.0.

| Check | Result |
| --- | --- |
| `gofmt`, `go test ./...`, `go vet ./...` | Formatted the changed Go files. All packages passed. Module tests exercise invalid definitions, duplicate IDs, missing and cyclic dependencies, deterministic order, snapshot isolation, rollback after partial initialization, stop and cleanup errors, owner isolation, cancellation and repeated shutdown. |
| `go test -race ./core/module ./app` | Passed, including overlapping startup and shutdown, concurrent shutdown callers, timed waiting and snapshots during callbacks. |
| `pnpm -C frontend test`, `check`, `build` | All 23 tests passed. Svelte reported zero errors and warnings. Vite built the Workbench and lazy editor chunks. |
| `WAILS_EXP_USE_WAKE=1 wails3 build` | Built the embedded Linux binary at `bin/milo`. Regenerated bindings matched the checked-in files. |
| Native X11 smoke with Xvfb, Openbox and isolated XDG storage | The Workbench reported readiness on both launches. Cancel kept a sample draft intact through custom Close, File → Quit and Alt+F4 with system decorations. Save and Discard each ran host shutdown and exited with code 0. The sample tab was restored on restart. |

Shutdown is cooperative. Module callbacks must observe the shared deadline. Lifecycle failure scenarios use test modules, while the native smoke exercises the production host with an empty module inventory. The environment produced the existing GTK X11 deprecation warnings, Mesa DRI3 warning and JavaScriptCore signal-handler message.

## Stage 05 verification

Stage 05 ships Settings, Logger, Notify and Task through the existing module lifecycle. Settings writes versioned XDG preferences. The Workbench adds its singleton editor, Output and Tasks tabs, the Notification Center and footer indicators. All four work with an empty extension profile. [Module APIs and limits](MODULES.md#implemented-services) · [Workbench integration](WORKBENCH.md#system-modules)

Verified on Ubuntu 26.10 linux/amd64 with Go 1.27.3, Wails 3.1.0, GTK 4.24.1, WebKitGTK 2.52.6, Node.js 26.13.0 and pnpm 10.19.0.

| Check | Result |
| --- | --- |
| `gofmt`, `go test ./...`, `go vet ./...` | Passed. Coverage includes settings persistence, recovery and owner isolation, log retention and redaction, notification read and dismissal, and determinate, indeterminate, successful, failed and cancelled tasks. The host test covers the production registrations and lifecycle. |
| `go test -race ./core/module ./modules/... ./app` | Passed, including concurrent task progress and cancellation and owner-scoped cleanup. |
| `wails3 generate bindings -ts -i -d frontend/bindings` | Generated the Host and four Workbench facades with typed event definitions. The native build used the same generated bindings. |
| `pnpm -C frontend test`, `check`, `build` | 31 tests passed, Svelte reported zero errors and warnings, and Vite built the production bundle with the lazy Settings editor. |
| `WAILS_EXP_USE_WAKE=1 wails3 build` | Built the Linux binary with embedded Workbench assets at `bin/milo`. The install used the existing pnpm 10 store and frozen lockfile. |
| Native Linux smoke on GNOME Wayland with isolated XDG storage | The production binary loaded the embedded Workbench from a separate working directory. A temporary Go fixture using the same Workbench build verified determinate and indeterminate progress, cancellation through the generated binding, success, a user-safe failure, a live toast, inbox read/dismiss/clear, structured log redaction, Output filtering and clearing, Settings search and resets, and all three theme choices. |
| Native Workbench regression smoke | Verified the new menu entries alongside editor split, bottom Panel resize, maximize and restore, and dirty-window close. Cancel preserved the draft and Discard exited cleanly. The production binary later restored the resized Panel, both groups, sample tabs and the Dark setting from that profile. |

The task fixture is test-only. Logs, notifications and recent tasks retain a bounded history for the running host. Notifications use in-app delivery. A background operation must cooperate with context cancellation for cleanup to finish within the shutdown budget. Native verification covered Linux Wayland. The smoke environment reported the existing Wails GTK X11 build deprecations and JavaScriptCore signal-handler message.
