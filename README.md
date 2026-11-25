# Milo

Milo is a universal, extensible Linux-first desktop platform built with Go, Wails 3, Svelte 5 and shadcn-svelte. The current build includes a native window and a domain-neutral workbench. System modules, the public SDK and independent extensions are planned, including future Mail, Contacts and Calendar extensions. See the [documentation](./docs/README.md) and [roadmap](./docs/ROADMAP.md).

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

The primary sidebar, **Open tab** and **Ctrl+Shift+P** open Welcome, Sample or Appearance. The tab context menu (**Shift+F10** on a focused tab) offers pin, reorder and close actions. Use the Header buttons or the View menu to toggle panes, and drag the dividers to resize them. Appearance switches between light, dark and system modes. The new Milo WebKit profile starts with defaults. Layout, tabs and appearance changes persist in that profile. Launch with `MILO_NATIVE_TITLEBAR=1 ./bin/milo` to use Linux system window decorations.

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

This checkout continues the Slicer source project at `github.com/pavlith/slicer`. The separate `github.com/pavlith/milo` mail client is the future Mail extension donor. This platform uses the provisional checkout-local Go module path `milo.local/platform`. Choosing a public Go namespace and canonical repository URL is a separate decision before publishing Go modules or SDK packages.

Milo is licensed under the [MIT License](./LICENSE). The retained editor theme credits `@uiw/codemirror-theme-github`. [Editor theme source](./frontend/src/lib/components/editor/theme.ts)

The Slicer donor credited Vineflower and Procyon under Apache License 2.0, and its retired illustrations to horeyearth, with all rights reserved to the artist. [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) · [Original artwork](https://www.pixiv.net/en/artworks/93602463)
