# Contributing to Milo

Read the [architecture](./docs/ARCHITECTURE.md) and the acceptance criteria for the stage you are working on. Discuss major features in an issue or discussion before implementing them. Keep domain features in independent extensions and keep the Workbench reusable. [Roadmap](./docs/ROADMAP.md)

- Use the checked-in pnpm lockfile and the tool versions in the [README](./README.md). Run the relevant checks listed there. Format Go changes with `gofmt` and use the frontend's Prettier configuration for changed frontend files.
- Use the semantic CSS variables in `frontend/src/main.css` for colors and styles. Keep Workbench state operations independent of UI effects and show feedback in the calling component.
- Add translation keys to the English dictionary in `frontend/src/locale/`. Other locales fall back to English for missing keys.
- Regenerate and review the checked-in Wails bindings when the host API or event types change. Keep those bindings inside the trusted Workbench.
- Update the affected documentation with contract and behavior changes. Record the checks actually run and any limitations in the roadmap at stage completion. Preserve license notices and upstream credits.
