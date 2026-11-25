# Codex implementation guide

Start with the current stage in the roadmap and read its linked contracts. Inspect the source and Git status before editing. Follow applicable `AGENTS.md` instructions when present, and preserve unrelated changes and repository history. [Documentation index](README.md) · [Roadmap](ROADMAP.md)

- Work within the requested stage and existing branch instructions. Commit or push only when authorized. See the root README for the current repository identity and temporary Go namespace.
- Follow the language, dependency, formatting and binding conventions in the contributing guide. Keep Go services and Svelte presentation aligned with the architecture. [Contributing](../CONTRIBUTING.md) · [Architecture](ARCHITECTURE.md)
- Prefer narrow changes with concrete consumers. Preserve working entry points and add focused regression coverage around changed behavior where needed.
- Verify changed behavior using the root Taskfile (`task check`, `task test`, `task build`, or `task verify`) and a native smoke test when available. Use `task run:x11` and `task run:wayland` to compare Linux graphics backends without rebuilding. For documentation-only changes, review references, terminology and stage status.
- Record the stage status, checks actually run, results, limitations and decisions in the roadmap. Keep future contracts distinct from shipped behavior.
