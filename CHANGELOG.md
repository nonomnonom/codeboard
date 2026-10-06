# Changelog

## 1.1.0

### Minor Changes

- Insert an editable character rig and its local performance into an existing shot using `instantiateShotCharacter`, `character.instantiate` plans and the `character-plan` CLI. Copies remap substitutions, IK, controllers, deformation and tracked component origins while preserving the destination set and camera. Placement and frame offset are explicit; incomplete external dependencies reject.
- Add persistent primitive 3D scenes through `LayerHandle.scene3D`. Saved projects retain mesh and group transforms, perspective or orthographic cameras, basic materials and lighting, and transform/camera keyframes. Scenes render through normal board, shot, and editorial workflows, and participate in capture, retiming, and character-instance offsets. Add a visual study and save/reopen/edit/render integration tests.

  Also add `codeboard-studio/three` for rendering externally authored Three.js scenes as SVG or RGBA snapshots. Both APIs use SVG painter ordering; textures, shadows, PBR and skeletal animation are unsupported. Projects containing the new scene element require this version or newer.

## 1.0.0

Code-first editable 2D production: storyboard and shot animation, saved-state revision,
editorial assembly, audio, review and delivery through the JavaScript/TypeScript API and CLI.

### Migration and changed contracts

- New projects use document schema 5 and SQLite container format 3. Schema-3/format-1
  and schema-4/format-2 projects remain readable but cannot be edited in place.
  Use `codeboard migrate old.cboard new.cboard`; retain the original for its history
  and request receipts. Migration copies the current document and embedded assets.
- Review manifests use `codeboard-review/2`, with explicit board, shot or editorial
  targets and per-frame source mappings. Consumers of version 1 must update parsing.
- Animatic packages require a new output directory and publish their manifest last.
  Existing directories are rejected; returned output paths are absolute.
- Object discovery includes hierarchy, keys and review records. Use kind filters
  when consuming results and restart bounded queries after edits or reopening.
- Studio movie exports require an explicit audio mix or omission policy when audio
  is authored. Board-global frames, shot-local frames and audio samples are distinct.

### Production workflows

- Persist independent shot animation and editorial clips, drawing holds, capture
  handles, explicit board-to-shot plans and audio conversion. Retiming reports
  quantization and rejects destructive collisions.
- Author IK/rest poses, mesh/curve/envelope/skin bindings and ordered controllers;
  transfer numeric performances using explicit identities. Lip sync consumes supplied
  mouth cues and preserves editable exposure corrections.
- Use palette bindings, component baselines and conflict-aware upgrades. Native shot
  handoff and three-way merge preserve independently edited fields within their
  documented resource-compatibility limits.
- Composite masks, blend modes, ordered layer effects and shot graphs on RGBA8 surfaces.
  Import supported PSD pixel layers, script CSV/FDX subsets and OTIO cut sequences
  with explicit loss or rejection policies.
- Mix rationally placed studio audio, export aligned WAV stems and H.264/AAC movies,
  or render version-pinned PNG frame jobs with resume and sequence verification.
- Save checkpoints, retry version/hash-bound agent plans through durable receipts,
  inspect bounded metadata, publish native projects and pin font files for handoff.
- Export saved-snapshot reviews; verify hashes, decoded images, unsigned decisions
  and their optional saved-source/revision binding through the API or CLI.

### Reliability and distribution

- Preserve atomic document/receipt commits, stale-writer rejection, legacy-file
  protection, cancellation and owned-output cleanup. Add process recovery and
  migration regression fixtures plus package/install checks.
- Organize implementation by domain, consolidate example workspace configuration,
  and ship generated API documentation and matching offline plugin references.
- Bundle version-matched documentation in the npm package. Add offline `docs search`
  and `docs read` with exact symbol lookup, task-guide search, JSON source references
  and bounded continuation. Queries need no network, model, renderer or plugin.
- Require media studies in release validation, synchronize version metadata and
  deploy website documentation after a successful published engine release.

### Supported limits

The renderer uses 8-bit surfaces. Interchange formats are documented subsets;
there is no native Harmony interchange, speech recognition, automatic rigging,
HDR/OCIO compositor or built-in scheduler. See the guides for operation budgets,
font/runtime reproducibility limits and explicit audio policies.

## [0.3.0] - 2026-10-05

- BREAKING: distribute the engine and CLI only through npm (`codeboard-studio`). Require user-provided Node.js 22.22+; remove platform archives, shell/PowerShell installers, automatic GitHub update checks, and `codeboard update`. Use npm to install, pin, update, and uninstall.
- Publish validated npm tarballs through GitHub Actions trusted publishing after cross-platform installation checks; update website, examples, and bundled agent references for npm installation.

- Expand agent installation guidance with portable skill folders, documented discovery paths for additional hosts, reference verification, and remote-environment setup.

- Add the agent plugin under `plugin/`, with Codex and Claude Code manifests, ten operation skills, and a generated offline reference bundle. `npm run docs:generate` updates API references and the bundle; validation rejects drift from the canonical documentation.
- Document plugin installation, verification, first use, and updates for Codex and Claude Code in the public guides and agent workflow.
- Use Fumadocs configuration-based collection imports for the website after the macro integration failed the local production build; keep root `docs/` as the shared documentation source.
- Correct brush documentation to identify `brushParameterSchema` as JSON Schema data and use `production.createBrush` for engine validation.
- Run all public examples with the installed v0.2.1 CLI, without engine source imports, local builds or tsx.
- Publish the complete 48-second demo source with original synthesized Foley, review outputs and saved-frame verification; test the downloadable demo against published runtimes on Windows, macOS and Linux.

## [0.2.1] - 2026-10-05

- Check for stable GitHub updates once daily in interactive terminals, with an offline-safe timeout and an environment opt-out.
- Offer an interactive update confirmation, plus `codeboard update --check` and `codeboard update --yes`; verify the release installer and reuse the existing versioned installation without changing projects.

## [0.2.0] - 2026-10-04

- Install from GitHub with checksum-verifying shell and PowerShell installers, automatic command setup, and retained version directories.
- Create an authoring script with `codeboard init` and execute JavaScript or erasable TypeScript with `codeboard run`, including public API imports outside the installation directory.
- Replace the old documentation with public installation, drawing, animation, review, revision, and export guides.

## [0.1.1] - 2026-10-04

- Add GitHub-only portable CLI bundles for Windows x64, Linux x64, macOS x64 and macOS arm64, including Node and native runtime dependencies.
- Verify each extracted bundle on its target OS before release; document installation paths.
- Remove the unused npm registry publishing workflow.

## [0.1.0] - 2026-10-04

### Added

- Code-authored raster/vector drawing, custom brush resources, layers, masks, keyframes, exposures, storyboard sheets, preview, and FFmpeg movie export.
- SQLite `.cboard` persistence with binary assets, named revisions, integrity checks, and targeted artwork reads/updates.
- LAST LIGHT and LENGKAP examples with editable source and original artwork/audio.
- A small executable quickstart, contributor documentation, GitHub issue forms, CI configuration, and package-install verification.

### Packaging

- Repository identity and support links for `nonomnonom/codeboard`.
- Package builds before packing; runtime distribution remains separate from rendered demo outputs.
