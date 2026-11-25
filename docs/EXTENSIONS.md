# Extension SDK and host

This document defines the planned SDK and extension host. Core MVP targets an explicitly trusted local developer extension. Public untrusted execution and marketplace distribution are later stages.

Stage 04 provides one Go resource scope per trusted built-in module. Stage 05 uses it to bind Settings schemas and Task owners to the corresponding activation. Go also supplies owner-labelled logging and in-app notifications. Future SDK calls will derive their owner from the authenticated session and route through these services. [System module APIs](MODULES.md#implemented-services)

In Stage 08, the extension host will associate a separate resource lifetime with each authenticated activation. On deactivation it must first resolve dirty editors through the Workbench, then release that owner’s subscriptions, tasks, actions and contributions. Failed activation also requires disposal of partial registrations. Independently installed extensions have their own host lifecycle. [Built-in module cleanup](MODULES.md#owner-scoped-cleanup)

## Package and manifest

Extensions are separate installable packages, never compiled into the host. First support an unpacked directory installed by an explicit development action. Later the proposed `.miloext` archive can wrap the same layout. Archive installation is future work.

    hello-world/
      manifest.json
      backend/linux-amd64/hello-world   # optional, executable
      frontend/index.html               # optional, prebuilt isolated UI
      frontend/assets/
      README.md
      LICENSE

Illustrative manifest (versioned schema to implement with tests):

    {
      "id": "example.hello",
      "name": "Hello World",
      "version": "0.0.1",
      "apiVersion": "1",
      "entrypoints": {
        "backend": {"linux-amd64": "backend/linux-amd64/hello-world"},
        "frontend": "frontend/index.html"
      },
      "permissions": ["notify.publish", "logger.write", "action.register"],
      "contributes": {
        "activities": [{"id": "example.hello.activity", "title": "Hello", "icon": "box"}],
        "views": [{"id": "example.hello.navigation", "region": "primary", "activity": "example.hello.activity"}],
        "editors": [{"id": "example.hello.editor", "title": "Hello"}],
        "actions": [{"id": "example.hello.open", "title": "Open Hello"}],
        "statusItems": [{"id": "example.hello.status", "region": "footer"}]
      }
    }

IDs are namespaced, unique and owned by the manifest identity. Validate API/platform compatibility, allowed regions, entrypoints, manifest size and permissions before starting anything. Reject absolute/traversal paths, escaping symlinks, duplicates and unsupported entrypoints. Treat package metadata as data, not executable HTML. Use immutable installed versions and preserve data on disable/update; removal of data is separate explicit user intent.

## Lifecycle and protocol

discover -> validate -> installed/disabled -> activate -> active -> deactivate -> disabled. Incompatible/failed states expose a diagnostic. MVP activation may be explicit; lazy triggers later. A package can provide frontend-only or backend-only contributions. Activation failure rolls back registrations and terminates any started process. Deactivation removes menu entries, views, actions, search providers, status items and event subscriptions, handles dirty editor state, cancels owned work through the Task module and stops owned processes. Use bounded graceful shutdown and then termination. Never let one failure take down the host.

Prefer a supervised subprocess for Go extensions, not plugin.Open, shared Go ABI, or host-side imports. Proposed IPC: JSON-RPC 2.0 over dedicated stdio (or local transport if justified by Wails/platform constraints); no exposed TCP server by default. Frame messages explicitly, negotiate API version and session identity, separate protocol output from diagnostic output, enforce max message size, timeouts and cancellation. The host derives owner identity from the connection; do not trust owner IDs passed by callers. Define explicit stable error codes: incompatible, permission denied, invalid arguments, unavailable, cancelled, internal. Test malformed messages and process exit.

SDK Go and TypeScript clients expose only supported services and contribution registration. The host validates capability grants per call. The SDK must be usable without importing internal host packages. Keep schema examples versioned; do not promise backwards compatibility beyond the documented API version.

## Menu contributions

The trusted Workbench Menu Registry uses Action references for menu items. Stage 07 will let the Contribution Registry manage menu declarations and owner cleanup. A future extension can contribute an independent top-level section (for example, Mail), add an item to a built-in section such as File, or add a group with items, separators and submenus. A registration carries an owner-scoped ID, placement, order, label when applicable and an action reference for each item. [Menu Registry](WORKBENCH.md#menu-registry)

The extension host must derive ownership from the authenticated session, validate menu metadata and allowed targets, and remove all owner registrations on deactivation or failed activation. The host must authorize action references at registration and recheck action availability, ownership or allowed delegation, permissions and arguments at dispatch. Visibility, enablement and a menu click provide UI context. Authorization comes from the session's grants and the action policy. The SDK will submit declarative contributions through the host bridge. Privileged action handlers and arbitrary UI callbacks stay in trusted code.

## Activity and settings contributions

The trusted Workbench exposes a local activity registry for owner-scoped icon entries and contextual navigation actions. The activity rail and Primary Sidebar render from this registry. The planned shared Contribution Registry will adapt external activity and view declarations to the trusted shell. Settings renders categories supplied by the existing authorized Go Settings projection. The scope of that projection is controlled by the native host. [Workbench activity contributions](WORKBENCH.md#activity-contributions) · [Settings service](MODULES.md#settings)

## Editor contributions

Stage 03 has a typed Editor Registry for trusted local Svelte registrations. A type declares its owner-scoped ID, default title and optional icon, lazy loader and singleton or resource behavior. Resource providers describe their opaque references and explicitly enable restoration where supported. Optional editor sessions retain per-instance state and supply save, discard and disposal operations. The Workbench owns grouping, tabs and close confirmation. [Workbench editor contracts](WORKBENCH.md#tab-and-editor-model)

Stage 07 will adapt the shared Contribution Registry to register these types and dispose owner-scoped contributions. During future deactivation, the host can call the manager's protected owner close before removing the owner's registrations. Cancelled close keeps the owner active. Stage 08 will connect separately built UI through the isolated bridge and derive owner identity from the authenticated session.

## Action and search contributions

Stage 06 provides owner-scoped Action and Search registries for trusted Go and Svelte code. Stage 07 can map contribution declarations to these registration APIs and collect their disposers alongside menu, view and editor disposers. Action and provider IDs are stable and namespaced. Removing an owner invalidates references and cancels its active invocations or searches. Search results and notifications carry action IDs and optional arguments. The Action dispatcher checks ownership or explicit delegation and then validates context and arguments.

The future host must derive the owner from its authenticated activation when adapting external declarations. The Stage 06 Wails facades are for the trusted Workbench. They expose catalog reads and dispatch/query calls. Registration happens inside trusted code. Future SDK calls will need capability checks and identity binding at the extension boundary. [Action and Search contracts](MODULES.md#action)

## UI and security boundary

Trusted modules may mount local Svelte components. External extension UI is separately built and rendered in an isolated context, initially a sandboxed frame or separate webview as supported by the pinned Wails implementation. Verify origin/sandbox behavior in a native spike before committing to a transport. No privileged Wails bindings, shared host DOM, arbitrary remote imports, or direct access to host secrets from extension UI. A narrow validated message bridge should authorize calls against the installed extension/session and use explicit message types. Do not use wildcard origins when origin authentication is required; opaque origins need a dedicated authenticated channel and source checks. The host retains control of chrome, prompts, permissions and navigation. Pass theme tokens via a constrained bridge; extension frontend may use shadcn-svelte but is not entitled to import host-private components.

Important: an independent native subprocess running as the same OS user is NOT an OS sandbox; it may still access files/network outside SDK controls. MVP must label such packages trusted developer code, require explicit user installation/activation and not claim strong isolation. Before public third-party distribution, implement and test an actual OS capability sandbox or a constrained runtime and address supply chain trust, signatures, update rollback and revocation. Avoid loading arbitrary remote JS into the Wails WebView. Use the capability-scoped SDK bridge for extension UI.

## Local installation and future marketplace

For MVP, choose a local package directory, validate, stage in an owner/version-specific directory, atomically register, and activate only with explicit consent. For uninstall, stop first and remove package artifacts; retain extension-owned data unless separately requested. Use no hidden network fetches. Failed install must leave no active partial state. Maintain version/API compatibility metadata and allow reinstall.

Later, use a registry of signed/versioned artifacts, possibly hosted on GitHub Releases initially. Download to staging, check integrity and publisher policy, inspect archive limits/path traversal, prompt for changed permissions, and atomically update with rollback. A checksum alone is not publisher authentication. Marketplace UI and automatic updates are separate stages, gated on the security requirements above.

## Future domain extensions

The original Milo mail client is the donor for Mail. Mail owns IMAP, SMTP, OAuth provider details, accounts, mail sync, message/thread storage and UI. The host has no Mail-specific methods or imports. Mail contributes folder navigation in primary, message/inbox/compose editor types, connection status in footer, sync output in panel and search/actions. Use opaque resource IDs; preserve message/draft data and security boundaries. Contacts and Calendar remain separate extensions. Do not migrate mail until the independent Hello World proof passes.
