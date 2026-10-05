# Changelog

Changes are grouped by release. Unreleased work is not a claim of registry publication.

## Unreleased

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
