# Maintain the documentation

Public framework documentation lives in `docs/`. Derive API claims from `src/` public exports, declarations and the owning implementation; an example proves only its own use of the API. Keep demo walkthroughs and galleries with their owning project in `examples/`. Core guides must work with reader-created or reader-supplied projects, without a demo checkout, hidden helper, fixed showcase ID or generated fixture prerequisite. Write for a person making artwork: explain the task, show the smallest useful example, describe the result, and explain constraints where the reader needs to make a choice. Put repository commands and implementation history in contributor documentation.

## Content ownership

| Content | Maintained source | Generated consumer |
| --- | --- | --- |
| Getting started and task guides | `docs/start`, `learn`, `drawing`, `animation`, `audio`, `workflow`, `delivery` | Website and installable plugin |
| Detailed contracts | `docs/reference` | Website and installable plugin |
| API signatures | Public declarations in `src/`; introductions in `scripts/build-api-docs.mjs` | `docs/reference/api/` |
| Navigation | `meta.json` in each docs folder | Fumadocs sidebar |
| Runnable examples and showcase walkthroughs | `examples/` | Example ZIPs and showcase links |
| Agent behavior | `plugin/skills/*/SKILL.md` | `release/codeboard-plugin/skills/` |
| Contributor instructions | `CONTRIBUTING.md` and `contributing/` | Repository readers |

The website reads `docs/` directly. Do not copy guides into the website. The installable plugin is built into ignored `release/codeboard-plugin/`; do not commit a reference bundle under the skill source. API Markdown is generated and checked in for reading without a TypeScript build; edit its generator or declarations rather than its output.

## Add or revise a page

Choose the existing task folder. Keep a page focused on one reader outcome; a title such as “Split an audio clip” is more useful than an implementation module name. Start with what the reader will do and what they need first. Keep beginner steps separate from advanced contracts. Link to a shared explanation rather than copying it.

Use repository-relative Markdown links, including for media. They work in the checkout; the website resolves them from each page's location and the plugin build rewrites references to files outside its package. Update the local `meta.json` when adding, deleting or moving a page. Breaking documentation routes are allowed in this restructure; links maintained in the repo must use the new routes.

Preserve constraints that prevent data loss: overwrites, source versus output ownership, stale writes, migration, retry receipts, import losses and unsupported formats. Describe them as decisions or failure recovery steps. Keep dated test results in release/evaluation records, not as trailing paragraphs in task guides.

## Generate and check

```sh
npm run docs:generate
npm run check:docs
npm run docs:bundle
npm run check:plugin
npm run website:build
```

`docs:generate` regenerates API signatures. `check:plugin` builds the complete installable plugin, verifies it against the sources, checks manifests/skills/links, and exercises update, tamper and rename behavior. The website build verifies exported links and anchors. For changed recipes, run the documentation recipe tests and the corresponding example.

## Update illustrations and downloads

The npm documentation database is generated into `dist/docs/` from the same public source selection used by the plugin. `docs:bundle` uses Markdown heading structure, preserves source text, and indexes qualified API headings from generated reference pages. Do not edit or commit the database. Ordinary TypeScript builds clean `dist`; build the docs bundle after the last engine build and before packaging. `prepack` does both; release jobs using `npm pack --ignore-scripts` must run `docs:bundle` explicitly. Package tests exercise retrieval from the actual tarball, including offline operation, symbols, continuation, and checksum/version failures.

Use `npm run docs:assets -- --video` to generate study images/videos and source downloads. FFmpeg and ffprobe are needed for video studies. The source belongs in `examples/studies/`; published images belong in `website/public/art/guides/`. Inspect images and playback after changing their authoring source.

`node scripts/package-examples.mjs` packages each example with the current built engine. Build the engine first. Use `npm run test:studies:install` when changing standalone studies or their packaging.
