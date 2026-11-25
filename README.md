# Milo

Milo is a universal, extensible Linux-first desktop platform built with Go, Wails 3, Svelte 5 and shadcn-svelte. The native Workbench includes up to two editor groups and four built-in modules. The Settings dialog manages durable preferences, Output shows structured logs, Notifications keeps an in-app inbox, and Tasks tracks cancellable Go operations. See the [documentation](./docs/README.md) and [roadmap](./docs/ROADMAP.md).

## Prerequisites

Install Go 1.26 or newer, Node.js from `.node-version`, and pnpm 10.19.0 as pinned in `frontend/package.json`. Linux builds use a C compiler, `pkg-config`, GTK4 and WebKitGTK 6.0. On Debian and Ubuntu releases that provide this stack, install `build-essential pkg-config libgtk-4-dev libwebkitgtk-6.0-dev`.

Install [Go Task](https://taskfile.dev/docs/installation) and the matching Wails CLI. Add the Go installation directory for binaries (normally `$(go env GOPATH)/bin`) to `PATH`.

```sh
go install github.com/go-task/task/v3/cmd/task@latest
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.2.0-nightly.20261123
```

## Develop and build

Run from the repository root. `Taskfile.yml` is the development entry point; Wails continues to use Wake and the declarative build in `wails.yaml`. The Taskfile sets `WAILS_EXP_USE_WAKE=1` for build and development tasks.

```sh
task --list
task doctor
task deps
task dev
task build
task run
```

Use `task start` to build and run in one command. Linux defaults to the system-selected graphics backend. To compare native Wayland with X11/XWayland on the same binary, close each instance before starting the next:

```sh
task run:x11
task run:wayland
```

Use `task start:x11` or `task start:wayland` to rebuild first, and `task dev:x11` or `task dev:wayland` for development with a specific backend. X11 can be useful on NVIDIA systems where WebKitGTK is less responsive under Wayland. These tasks do not change system settings or force a backend for all users.

Dev mode serves frontend updates via Vite on loopback. End a dev session with **Ctrl+C** in the terminal. The production binary embeds `frontend/dist/` and runs from any working directory. Closing the last native window stops the host and runs the Wails service shutdown hook. The Linux desktop entry expects `milo` on `PATH`.

Select **Views** in the Activity Bar to show Welcome, Sample and Sample B in the Primary Sidebar. They are also available from **Open tab** and **Ctrl+Shift+P**. The sidebar opens samples in preview. Double-click the tab to keep it open, or use **Shift+F10** on its label for pinning, reordering, opening a new instance, moving between groups and closing. Editing a sample creates a draft. Save and discard operate on the draft during the current session. Closing with unsaved changes prompts for a decision, including when quitting Milo.

Use **View → Split Editor Right** or **Ctrl+\** to split. Drag tabs between groups and move the divider to resize them. **Ctrl+Tab** and **Ctrl+Shift+Tab** switch tabs. **Ctrl+W** closes the active tab and **Ctrl+Shift+T** reopens a closed one. Pane visibility and tab layout are restored from the WebKit profile. Go stores the theme and other durable preferences in `${XDG_CONFIG_HOME:-$HOME/.config}/milo-platform/settings.json`. Sample text is kept in memory.

Open **Settings** from the Activity Bar, **Edit → Settings** or the command palette to search preferences, reset a category or switch between Light, Dark and System. **View → Output** and **View → Tasks** open the bottom Panel. The footer opens the Notification Center and shows active task progress. Launch with `task run:native` to use Linux system window decorations. [Workbench behavior](./docs/WORKBENCH.md)

## Generate and verify

```sh
task bindings
task check
task test
task frontend:build
task test:race
task verify
```

The generated bindings are checked in for frontend-only checks. Regenerate them when Go service methods or Wails events change. The Wails build also generates bindings before compiling the frontend.

Run `task test:race` for lifecycle and concurrency coverage. Focused scenarios exercise persistence and recovery, notification publication and dismissal, structured logs, task progress, success, failure and cancellation. [Module contract](./docs/MODULES.md#common-lifecycle)

Use `task fmt` to format sources, `task version` to inspect the toolchain and `task version:binary` to inspect the built binary. `task clean` removes generated build outputs only. `task verify` installs locked dependencies, regenerates bindings, runs checks and tests, and builds the production binary.

## Repository and license

Milo is hosted at `github.com/pavlith/milo`. Its Git history starts with the Stage 00 Workbench extraction from Slicer, whose earlier history remains at `github.com/pavlith/slicer`. The platform uses the provisional checkout-local Go module path `milo.local/platform`. A public Go namespace remains to be chosen before publishing Go modules or SDK packages.

Milo is licensed under the [MIT License](./LICENSE). The retained editor theme credits `@uiw/codemirror-theme-github`. [Editor theme source](./frontend/src/lib/components/editor/theme.ts)

The Slicer donor credited Vineflower and Procyon under Apache License 2.0, and its retired illustrations to horeyearth, with all rights reserved to the artist. [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) · [Original artwork](https://www.pixiv.net/en/artworks/93602463)
