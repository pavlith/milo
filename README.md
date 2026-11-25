# Milo

Milo is a universal, extensible Linux-first desktop platform built with Go, Wails 3, Svelte 5 and shadcn-svelte. The current build includes a native window, the Workbench, and a lazy editor registry with up to two editor groups. System modules, the public SDK and independent extensions are planned, including future Mail, Contacts and Calendar extensions. See the [documentation](./docs/README.md) and [roadmap](./docs/ROADMAP.md).

## Prerequisites

Install Go 1.26 or newer, Node.js from `.node-version`, and pnpm 10.19.0 as pinned in `frontend/package.json`. Linux builds use a C compiler, `pkg-config`, GTK4 and WebKitGTK 6.0. On Debian and Ubuntu releases that provide this stack, install `build-essential pkg-config libgtk-4-dev libwebkitgtk-6.0-dev`.

Install the matching Wails CLI and add its installation directory to `PATH`.

```sh
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.1.0
```

## Develop and build

Run from the repository root. Wails 3.1 uses the Wake opt-in to load the declarative build in `wails.yaml`.

```sh
WAILS_EXP_USE_WAKE=1 wails3 dev
WAILS_EXP_USE_WAKE=1 wails3 build
./bin/milo
```

Dev mode serves frontend updates via Vite on loopback. End a dev session with **Ctrl+C** in the terminal. The production binary embeds `frontend/dist/` and runs from any working directory. Closing the last native window stops the host and runs the Wails service shutdown hook. The Linux desktop entry expects `milo` on `PATH`.

The primary sidebar, **Open tab** and **Ctrl+Shift+P** open Welcome, Appearance, Sample and Sample B. The sidebar opens samples in preview. Double-click the tab to keep it open, or use **Shift+F10** on its label for pinning, reordering, opening a new instance, moving between groups and closing. Editing a sample creates a draft. Save and discard operate on the draft during the current session. Closing with unsaved changes prompts for a decision, including when quitting Milo.

Use **View → Split Editor Right** or **Ctrl+\** to split. Drag tabs between groups and move the divider to resize them. **Ctrl+Tab** and **Ctrl+Shift+Tab** switch tabs. **Ctrl+W** closes the active tab and **Ctrl+Shift+T** reopens a closed one. Pane visibility, tab layout and theme are restored from the WebKit profile. Sample text is kept in memory.

Use the Header or View menu to toggle panes. Appearance switches between light, dark and system modes. Launch with `MILO_NATIVE_TITLEBAR=1 ./bin/milo` to use Linux system window decorations. [Workbench behavior](./docs/WORKBENCH.md)

## Generate and verify

```sh
wails3 generate bindings -ts -i -d frontend/bindings
pnpm -C frontend install --frozen-lockfile
pnpm -C frontend check
pnpm -C frontend test
pnpm -C frontend build
go test ./...
go vet ./...
```

The generated bindings are checked in for frontend-only checks. Regenerate them when Go service methods or Wails events change. The Wails build also generates bindings before compiling the frontend.

## Repository and license

Milo is hosted at `github.com/pavlith/milo`. Its Git history starts with the Stage 00 Workbench extraction from Slicer, whose earlier history remains at `github.com/pavlith/slicer`. The platform uses the provisional checkout-local Go module path `milo.local/platform`. A public Go namespace remains to be chosen before publishing Go modules or SDK packages.

Milo is licensed under the [MIT License](./LICENSE). The retained editor theme credits `@uiw/codemirror-theme-github`. [Editor theme source](./frontend/src/lib/components/editor/theme.ts)

The Slicer donor credited Vineflower and Procyon under Apache License 2.0, and its retired illustrations to horeyearth, with all rights reserved to the artist. [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) · [Original artwork](https://www.pixiv.net/en/artworks/93602463)
