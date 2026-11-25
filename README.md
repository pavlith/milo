# slicer

Slicer is a domain-neutral Linux desktop workbench built with Go, Wails 3, Svelte 5 and shadcn-svelte.

## Prerequisites

Install Go 1.26 or newer, Node.js from `.node-version`, and pnpm 10.19.0 as pinned in `frontend/package.json`. Linux builds use a C compiler, `pkg-config`, GTK4 and WebKitGTK 6.0. On Debian and Ubuntu releases that provide this stack, install `build-essential pkg-config libgtk-4-dev libwebkitgtk-6.0-dev`.

Install the matching Wails CLI and add its installation directory to `PATH`.

```sh
go install github.com/wailsapp/wails/v3/cmd/wails3@v3.1.0
```

## Develop and build

Run these commands from the repository root. Both Wails commands use the declarative build in `wails.yaml`, enabled with the Wake opt-in in Wails 3.1.

```sh
WAILS_EXP_USE_WAKE=1 wails3 dev
WAILS_EXP_USE_WAKE=1 wails3 build
./bin/slicer
```

Dev mode opens the native window and serves frontend updates via Vite on loopback. End a dev session with **Ctrl+C** in the terminal. The production binary embeds `frontend/dist/` and runs independently of the source tree and the dev server. Closing the last native window stops the Go host and runs the Wails service shutdown hook.

The primary sidebar, **Open tab** and **Ctrl+Shift+P** open Welcome, Sample or Appearance. The tab context menu (**Shift+F10** on a focused tab) offers pin, reorder and close actions. Use the layout buttons to show or hide panes and drag dividers to resize them. Appearance switches between light, dark and system modes. The WebKit profile stores layout, tabs and theme preferences locally.

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

The generated bindings are checked in so frontend-only checks can run directly. Regenerate them when Go service methods or Wails events change. The Wails build also generates bindings before compiling the frontend.

`main.go` starts the desktop app. `app/` composes the native window, Wails service and typed events. `core/` holds domain-neutral platform code independent of Wails. `frontend/` holds the workbench, shadcn-svelte components, pnpm lockfile and generated TypeScript bindings. See the [architecture](./docs/ARCHITECTURE.md) and [roadmap](./docs/ROADMAP.md).

## License

Slicer is licensed under the [MIT License](./LICENSE). The retained editor theme credits `@uiw/codemirror-theme-github` in its source. [Editor theme source](./frontend/src/lib/components/editor/theme.ts)

The donor credited Vineflower and Procyon under Apache License 2.0, and its retired illustrations to horeyearth, with all rights reserved to the artist. [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) · [Original artwork](https://www.pixiv.net/en/artworks/93602463)
