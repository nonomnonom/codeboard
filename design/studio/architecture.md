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
See [release acceptance](RELEASE-CUTOFF.md) for verification and publication.
