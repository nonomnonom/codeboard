# Codeboard agent skills

Ten skills help a coding agent draw, animate, review and revise editable Codeboard projects. The engine is installed separately from npm.

[Install and use the skills](../docs/start/agent-setup.md).

## Build the installable plugin

From the repository root, run:

```sh
npm run plugin:build
```

Install from `release/codeboard-plugin/`. That generated directory contains the host manifests, all ten skills and their offline references. The `plugin/` directory is authoring source and is not an installable distribution.

Edit skill behavior in `skills/*/SKILL.md`, framework guides in `docs/` at the repository root. The build copies those sources into the distribution; no second reference source is checked in. Example projects remain separate and are not plugin prerequisites or bundled runtime assets.

## Skill ownership

| Skill | Responsibility |
| --- | --- |
| [codeboard](skills/codeboard/SKILL.md) | Session context and operation selection |
| [codeboard-draw](skills/codeboard-draw/SKILL.md) | Artwork, layers, pixels and components |
| [codeboard-brushes](skills/codeboard-brushes/SKILL.md) | Brushes, imported resources and swatches |
| [codeboard-storyboard](skills/codeboard-storyboard/SKILL.md) | Story beats, panels and captions |
| [codeboard-animate](skills/codeboard-animate/SKILL.md) | Poses, drawings, rigs and timing |
| [codeboard-camera](skills/codeboard-camera/SKILL.md) | Framing and camera movement |
| [codeboard-audio](skills/codeboard-audio/SKILL.md) | Cues, trim, mixing and synchronization |
| [codeboard-revise](skills/codeboard-revise/SKILL.md) | Saved-state protection and conflicts |
| [codeboard-review](skills/codeboard-review/SKILL.md) | Visual inspection and delivery evidence |
| [codeboard-debug](skills/codeboard-debug/SKILL.md) | Diagnosis |

Run `npm run check:plugin` to build and validate the distribution. [Evaluation instructions](evals/README.md) and [dated results](evals/results.md) describe the separate agent evaluations and their limits. Documentation maintenance is covered in [the contributor guide](../contributing/documentation.md).
