# Skill design and source audit

## What belongs where

The plugin teaches decisions and completion criteria. Codeboard's canonical `docs/` owns API signatures, examples, units, and supported formats. A generated copy ships inside the core skill's `references/engine/`, together with quickstart and character-demo source. Installed agents read this local bundle without needing the author's checkout or network. The sync script records engine version and source/bundle hashes; the package check rejects drift. This is a generated distribution asset, not a separately maintained API manual.

`codeboard` owns session setup, runtime selection, documentation lookup, and capability verification. The nine specialists own their operation-specific choices. They refer to each other by skill name. A short session prerequisite is a dependency declaration, not a repeated setup procedure. Specialist selection is based on the task; there is no mandatory tour through every skill and no global startup hook for unrelated work.

`codeboard-revise` owns saved-state protection and conflict handling. `codeboard-review` owns visual evidence and delivery claims. Other skills define what their operation needs checked without repeating those workflows.

## Research applied

The local Superpowers 6.4.2 reference was inspected, particularly `writing-skills`, its subagent-testing guide, `using-superpowers`, `test-driven-development`, `systematic-debugging`, and host manifests. Useful patterns here are trigger-focused descriptions, one central operational principle, named skill references, and behavior tests before claiming effectiveness. Its universal startup mandate and software-development approval/commit process are not transplanted into an artwork tool.

The [Agent Skills specification](https://agentskills.io/specification) defines the portable folder/frontmatter contract and progressive loading. [Anthropic's authoring guidance](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) supports concise instructions, task-specific degrees of freedom, shallow references, and evaluation through actual use. Superpowers prefers descriptions that contain triggers only; that narrower house style is used here to keep discovery separate from execution.

No prompt can guarantee absence of hallucinations. The concrete controls are version identification, reading the relevant public declaration before unfamiliar calls, executing scripts against the engine, inspecting actual saved state, and reporting unsupported capabilities without inventing substitutes.

## Documentation audit

All 29 top-level Markdown guides in the checkout's `docs/`, its navigation metadata, and `docs/media/README.md` were read during this revision. The guide ownership map is:

| Owner | Documents |
| --- | --- |
| Session and API lookup | index, install, quickstart, cli, agent-workflow, reference, api-types |
| Drawing | drawing, layers, pixels, components, api-project, api-drawing |
| Brushes | brushes, brush-resources |
| Storyboard | storyboard |
| Animation | animation, math, code-board-demo |
| Camera | camera |
| Audio | audio |
| Revision | projects, api-storage, api-production |
| Review and export | review, onion-skin, export, api-render |
| Diagnosis | troubleshooting |

The official website could not be retrieved by the browsing tool in this environment. Local documentation, public declarations, executable examples, and engine behavior were therefore the sources used for API claims. The bundled snapshot identifies its engine version. Skills check that version against the installed runtime and consult matching declarations/documentation for discrepancies. Showcase media and installer links remain online; they are not needed to read API contracts. Internal links between included manuals/examples remain local.

## Validation boundaries

Structural checks catch broken metadata, references, duplicated paragraphs, and forbidden cross-skill paths. Artifact evals check actual project invariants. Separate read-only scenarios examine discovery and unsupported-feature responses. Human review is still needed for artistic quality. Small passing samples do not establish a failure rate, cross-model reliability, or universal improvement over docs alone.

## Documentation distribution review

The review traced authoring, generated declarations, website ingestion, plugin installation, example downloads, CI, and release validation. Retain the existing root `docs/` as the canonical guide source. Moving it into one consumer's plugin package would require changing website ingestion, GitHub edit links, repository links, API generation, and portable installer packaging without eliminating the need for a distributable snapshot. Symlinks would also reintroduce a dependency on files outside an installed plugin.

| Content or consumer | Owner and distribution path |
| --- | --- |
| Handwritten task guides and navigation | Edit root `docs/` only. |
| Six `api-*.md` pages | Public TypeScript declarations plus introductions in `scripts/build-api-docs.mjs`; generated into root `docs/`. |
| Website HTML, Markdown/LLM endpoints, navigation, OG pages | `website/source.config.ts` selects root `docs/`; the generated collection feeds `website/lib/source.ts`. All consumers use the same Fumadocs loader and keep their public URLs. |
| Offline agent reference | `plugin/scripts/sync-reference.mjs` derives `skills/codeboard/references/engine/` from canonical docs, selected runnable examples, LICENSE and NOTICE. |
| Skill behavior | Edit the owning `SKILL.md`; signatures and full examples remain in the reference bundle. |
| Runnable examples and media | Source stays in `examples/` / `code-board-demo/`; showcase media stays in website public assets. The plugin includes quickstart and the standalone character example, not all downloads or rendered media. |
| Portable engine installer | `scripts/build-portable.mjs` reads root `docs/install.md` for `INSTALL.md`. The engine distribution and agent plugin remain separate installations. |
| CI and engine release | Both workflows already run `npm run check`; it now verifies source-to-API and docs-to-bundle consistency. No remote workflow or release was executed here. |

Contributor workflow: edit the owning source, run `npm run docs:generate`, review the generated diff, then `npm run check`. This single generation command updates API pages before the plugin bundle. Generated files are committed so a marketplace install from a Git checkout is immediately usable without build hooks. A missing/stale file or manual bundle edit fails validation; renames remove obsolete files recorded by the previous bundle. The sync test covers update, tamper, rename, link conversion, and containment of obsolete-file removal.

The website continues to read canonical docs, never the packaged snapshot. Its independent build workflow does not run the engine validation gate; contributors still need the CI check to pass before merging. The plugin is installable from its local marketplace directory; publishing it into a third-party marketplace or adding release archives is outside this change. Consumers update installed plugins to receive newer docs, and the session skill checks the reference version against the runtime rather than silently treating the snapshot as current for all versions.

The local website build exposed a failure in the existing macro integration: transformed Markdown appeared as the source module, causing missing module exports and relative image imports. Moving the collection declaration to Fumadocs' supported [Config API](https://www.fumadocs.dev/docs/mdx/collections) keeps the same directory, schema, metadata and processed Markdown options while using generated collection imports. The production build then passed TypeScript and exported 97 routes, including all 29 documentation pages and their Markdown/OG endpoints. This verifies the observed failure and the chosen fix; it does not establish the upstream macro defect's cause on every platform.
