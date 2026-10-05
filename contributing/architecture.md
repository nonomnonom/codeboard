# Implementation ownership

Codeboard v1 uses document schema 5 and container format 3. Source declarations
and generated API references define the implemented contract.

| Responsibility | Owner | Invariant |
| --- | --- | --- |
| Public API and project session | src/index.ts, core/project.ts, core/production.ts | Explicit exports; session owns transactions, undo, locks and identities |
| Persisted data | model/types, model/schema, model/validation | Validate fields and relationships; preserve migration safety |
| Board authoring | core/production, core/project | Reuse the existing mutation boundary |
| Shot, timing, editorial and rig algorithms | animation | Keep source-shot time separate from editorial placement; no storage/render I/O |
| Agent plans | core/edit-plan/schema and execute | Strict commands, isolated draft, version/hash conflict checks and durable retry |
| Storage | storage | Atomic writes, consistent snapshots, checksums, receipts and revisions |
| Rendering | render | Evaluate captured state; bounded surfaces/cache; no project/store dependency |
| Drawing and resources | drawing | Editable representations and validated input budgets |
| Audio | audio | Explicit sample clocks, source ranges, decoding and cancellation |
| Delivery | export | Own child processes, temporary artifacts, completion markers and cleanup |
| Interchange | interchange | Explicit supported subsets and loss/rejection policies |
| CLI | cli | Parse arguments and load operation backends on demand |
| Documentation and plugin | docs, plugin/scripts | Generate references from their owners; keep installed guidance consistent |

Run `npm run check:architecture` for import boundaries and cycles. Use existing
owners before introducing new abstractions. Refactor only when a concrete v1
change requires clearer ownership; file count and file size alone are not gates.
See [release acceptance](release/acceptance.md) for verification and publication.

## Distribution and runtime boundaries

| Concern | Owner | Decision |
| --- | --- | --- |
| Installation and updates | npm, root `package.json` | One package with library and CLI; no OS installers, bundled Node or custom updater |
| Release artifact | `.github/workflows/release.yml` | Build one npm tarball, test a fresh installation of that artifact, publish that same artifact |
| Runtime compatibility | Native dependencies and operation checks | Core CI uses Ubuntu; release installation checks cover Linux, Windows and macOS. Actual codecs and fonts can differ |
| Native rendering | `skia-canvas`, `sharp` | Keep dependency installation and rendering failures visible; no speculative OS feature switches |
| Media availability | `runtime/dependencies.ts`, `audio`, `export` | Reuse executable probes and operation-time errors; availability is not codec qualification |
| Fonts | `render/fonts.ts` | Inspect actual fonts; preserve explicit fallback/require-available policies |
| Filesystem safety | `storage` | Preserve path, symlink, concurrency and atomic-write protections on every OS |
| Agent guidance | `plugin/scripts/sync-reference.mjs` | Host installs skills; npm installs the engine; generate references from source docs |

The installer migration link and unused manual-download styling were removed from
the website. Media CI uses its existing Linux package-manager setup rather than
duplicating Windows-specific installer discovery. Public runtime requirements
live in `docs/start/installation.md`; do not infer unsupported OS/feature pairs
without a reproducible failure. Changes to workflow files remain local until
remote work is authorized.
