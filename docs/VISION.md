# Product vision

Milo is a universal, extensible Linux-first desktop platform. A Core MVP installation provides a native Workbench for settings, notifications, logs, background tasks, commands, search and extension management. An independently installed Hello World extension proves the extension model. Mail, Contacts and Calendar are future independent extensions.

| Term | Meaning |
| --- | --- |
| Core | Platform infrastructure for bootstrap, lifecycle, registries, paths, IPC and extension supervision |
| Module | Trusted, built-in system service that may contribute UI |
| Extension | Independently installed functionality with its own domain logic, data and UI |
| Workbench | Universal Svelte shell for layout, tabs, navigation and contributions |
| SDK | Versioned public extension-facing contracts, schemas and clients |
| Contribution | Owner-scoped registration of a view, editor type, action, search provider or status item |
| View | UI surface registered for a Workbench region |
| Tab | Stateful instance of a view or editor |
| Action | Named operation callable through a command, menu, shortcut or API |

The mandatory Core MVP modules are `settings`, `notify`, `logger`, `task`, `search`, `action` and `extensions`. Go owns system services and persistent application data. The Svelte Workbench handles presentation and interaction. Wails 3 connects the two in a native application. [Architecture](ARCHITECTURE.md) · [Modules](MODULES.md)

Core MVP targets Linux and an explicitly trusted local development extension. Public untrusted extensions, marketplace distribution, automatic updates, advanced docking, terminal emulation and validation on other operating systems are later work. Provider credentials, mail protocols and domain data models belong to extensions.

The Workbench retains the reusable Slicer frontend foundations and existing MIT and third-party notices. The separate Milo mail-client project will supply code for the future Mail extension after the Hello World proof. [Repository identity and attribution](../README.md#repository-and-license)
