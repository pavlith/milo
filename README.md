# slicer

Slicer is a domain-neutral workbench foundation built with Svelte 5, TypeScript, Vite, Tailwind CSS and shadcn-svelte. The current stage runs in a browser.

## Run locally

Use the Node.js version in `.node-version` and the pnpm version pinned in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

Open the localhost URL printed by Vite. Use the primary sidebar, the **Open tab** button, or the command palette (**Ctrl+Shift+P**) to open Welcome, Sample, or Appearance. The tab context menu (**Shift+F10** on a focused tab) offers pin, reorder, and close actions. Tabs can also be reordered by dragging. The layout buttons show or hide the sidebars and bottom panel. Drag a divider to resize an open pane.

The browser stores tab order, pinning, the active tab, pane visibility and sizes, and the chosen light, dark, or system mode. The browser may reserve **Ctrl+W** for closing its own tab. Use the tab close button or palette when the browser reserves the shortcut.

## Verify

```sh
pnpm test
pnpm check
pnpm build
```

For the architecture and stage status, see the [workbench documentation](./docs/README.md) and [implementation roadmap](./docs/ROADMAP.md).

## License

Slicer is licensed under the [MIT License](./LICENSE). The retained editor theme credits `@uiw/codemirror-theme-github` in its source. [Editor theme source](./src/lib/components/editor/theme.ts)

The donor credited Vineflower and Procyon under Apache License 2.0, and its retired illustrations to horeyearth, with all rights reserved to the artist. [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) · [Original artwork](https://www.pixiv.net/en/artworks/93602463)
