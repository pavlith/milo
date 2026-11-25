# Implementation roadmap

Execute stages sequentially. Record status, commit reference, and verification evidence here after each stage. See [CODEX.md](CODEX.md).

| Stage | Scope | Status | Required acceptance |
| --- | --- | --- | --- |
| 00 | Slicer workbench extraction | Completed | Domain-neutral web shell builds; no active Java/reverse-engineering/script loader code; reusable panes/tabs retained |
| 01 | Go + Wails 3 host | Planned | Linux native dev/build; embedded frontend; clean start/stop; paths and minimal typed host bridge |
| 02 | Seven-region workbench | Planned | All named regions; hide/resize; safe persisted layout; neutral shadcn theme |
| 03 | Tabs/editor groups | Planned | Preview, pin, close, reopen, reorder, dirty protection, bounded split, restore and lazy registry resolution |
| 04 | Module lifecycle and registry | Planned | Explicit dependencies/start/stop/cleanup, duplicate/cycle handling, no domain coupling |
| 05 | settings, notify, logger | Planned | Validated settings persistence; notifications and output panel; zero extensions required |
| 06 | action, search, palette | Planned | Commands/shortcuts, context conflicts, provider cancellation and empty/error states |
| 07 | Contribution registry | Planned | Owner-scoped views/editors/status/actions; test module can register new types without shell changes |
| 08 | SDK and extension host | Planned | Versioned manifest/protocol, local discovery/activation, lifecycle/permissions, isolated UI spike |
| 09 | Independent Hello World extension | Planned | Separate packaging/install, view and editor tab, action/search/log/notify, disable/re-enable/uninstall, failure isolation |
| 10 | Core 0.0.1 | Planned | Linux build + native smoke; empty and installed profiles; docs, license notices, known limitations |
| 11 | Mail extension migration | Planned | Separate extension using Milo donor; no mail imports in Core; mail data/security migration plan |
| 12 | Marketplace and public distribution | Planned | Actual isolation/trust policy, package integrity, publisher validation, update rollback and registry UI |

Stages 00–10 are Core MVP. Stages 11–12 are follow-up work; marketplace may be sequenced after a private/trusted Mail prototype, but public third-party packages are gated on security. Contacts/Calendar are subsequent independent extensions. Windows validation is a separate future milestone.

## Stage 00 detail — web workbench extraction

1. Inspect source tree and current package scripts. Record baseline pnpm install --frozen-lockfile, pnpm check, pnpm build results (or environment blocker). Preserve MIT and third-party notices.
2. Trace domain coupling using tab.ts, state.ts, app.svelte, content.svelte, pane/pane.svelte, pane/root.svelte, command.svelte and shortcut.ts. Extract generic tab state and view resolution first; introduce simple neutral placeholder views only.
3. Remove the app's Java-specific menus, workspace/decompilers, JDK, bytecode graph/search, remote-file/share and dynamic script execution from the live entry and dependency graph. Remove unused domain source/assets/deps after confirming no imports. Keep shared UI and localization patterns; remove obsolete domain translation keys if safe.
4. Keep pane/layout and basic tab interactions working. Do not add Wails, native IPC, marketplace, real modules or extension execution yet. Root frontend paths and pnpm remain for this stage. Keep name slicer until owner decides.
5. Verify build/check, relevant tab tests (choose a lightweight existing-compatible runner if needed) and a browser smoke when possible. Update README only to describe current behavior and docs navigation; do not advertise future features as shipped.

### Stage 00 verification

Implementation commit subject is `feat: extract domain-neutral slicer workbench`. The root frontend now mounts the seven named regions and one editor group. Three lazy local views exercise tab and palette behavior. PaneForge handles resizing, and versioned browser storage holds pane visibility, dimensions, and tab metadata. Mode Watcher retains light, dark, and system preferences. The shadcn-svelte primitives and reusable CodeMirror editor components remain in the source tree.

Java analysis, decompilers, JDK and workspace search, remote imports and sharing, and the script runtime and its SDK were removed from the source and dependency graph.

Baseline on `8e08277` used Node.js 26.13.0 and pnpm 10.19.0. The final test, type-check, and build used the pinned Node.js 22.19.0 with pnpm 10.19.0.

| Check | Baseline | Stage 00 result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Passed. pnpm reported skipped build scripts for `sharp`. | Passed in a clean temporary directory with the final manifests and lockfile. |
| `pnpm test` | No test script. | Eight tests passed for tab operations, pinned protection, ordering, and validated state restore. |
| `pnpm check` | Passed with two CSS warnings for `app-region`. | Passed with zero errors and zero warnings. |
| `pnpm build` | Passed with warnings for browser-externalized decompiler imports, direct `eval`, ineffective dynamic imports, and plugin timings. | Passed without warnings. |
| `pnpm preview --host 127.0.0.1 --port 4173 --strictPort` and Chrome 157 headless smoke | — | Verified all seven regions, opening and focusing tabs, keyboard palette search, pinning, pointer and keyboard reorder, bulk and explicit close, horizontal and vertical resize, collapse, reload, corrupt-state recovery, and light/dark/system modes. No client warnings or exceptions. |
| Production artifact and request audit | — | Source, lockfile and `dist/` contained no removed domain or loader markers. The production build emitted no WASM assets. The browser ignored the old script and remote-file query parameters and made no corresponding requests. |

The current editor uses one tab instance per local view. The secondary sidebar and bottom panel contain neutral empty states. New strings use English fallback in locales where a translation is unavailable. Browsers may reserve Ctrl+W for the browser tab. Stage 01 remains planned and covers the Linux Go/Wails host.

## Cross-stage acceptance

No unused compatibility layers solely to keep the old domain alive. No unrelated dependency upgrades. New contracts get focused tests, especially lifecycle, persistence and error cases. Preserve working build at each stage, or document a reproducible pre-existing/environment issue. Test Linux runtime only when native host is available; do not claim Windows support without evidence. Record actual commands, results, important trade-offs and next stage. Keep commit boundaries meaningful and avoid force pushes.
