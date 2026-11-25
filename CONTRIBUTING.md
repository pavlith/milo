# Contributing to Milo

Read the [architecture](./docs/ARCHITECTURE.md) and the acceptance criteria for the stage you are working on. Discuss major features in an issue or discussion before implementing them. Keep domain features in independent extensions and keep the Workbench reusable. [Roadmap](./docs/ROADMAP.md)

- Use the checked-in pnpm lockfile and the tool versions in the [README](./README.md). Use the root Taskfile (`task --list`) for development, checks and builds. Run `task check`, `task test` and the relevant additional tasks listed in the README. Use `task fmt` for whole-project formatting or format changed files with the underlying tools for narrow changes.
- Use the semantic CSS variables in `frontend/src/main.css` for colors and styles. Keep Workbench state operations independent of UI effects and show feedback in the calling component.
- Add translation keys to the English dictionary in `frontend/src/locale/`. Other locales fall back to English for missing keys.
- Regenerate and review the checked-in Wails bindings when the host API or event types change. Keep those bindings inside the trusted Workbench.
- Update the affected documentation with contract and behavior changes. Record the checks actually run and any limitations in the roadmap at stage completion. Preserve license notices and upstream credits.
