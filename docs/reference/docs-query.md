# Find documentation from the CLI

Check an API or find a guide using the installed package's documentation. Search and read return JSON and work offline. They do not open artwork, load a renderer, download a model, or require the plugin.

```sh
codeboard docs read index
codeboard docs search "drawingNeighbors"
codeboard docs search "camera shot local frames" --kind guide
codeboard docs read "reference/api/production#drawingneighbors"
```

## Find the right operation

Search an exact API symbol when you know its name. Qualify shared method names with their class, such as `ProductionTools.drawingNeighbors`. Exact matches precede keyword search unless you select `--kind guide`.

For a task, use a few English keywords. Keyword search requires all non-stopword terms in a section and favors guides over signatures. It splits camelCase and stems English words. It does not translate, infer meaning with embeddings, or correct spelling. An agent working in another language should formulate English search terms, then explain the retrieved documentation in the user's language.

`--kind guide|api` restricts results. `--limit` accepts 1–10 and defaults to 5. Keyword results include at most two sections per page. Queries accept up to 512 UTF-8 bytes and 24 searchable terms; whitespace-only input is an error. For empty results, shorten the query, check spelling, or read `index`. Empty results alone do not establish that a feature is unsupported.

Results include `id`, `pageId`, heading, `kind`, source path and line range. Exact matches include the qualified `symbol`. Each `excerpt` contains at most 700 Unicode code points; its `truncated` flag tells you to read the section before relying on omitted constraints. The response's separate `truncated` flag indicates more matches than displayed. Ranking is not a confidence score.

## Read and continue

Pass a result ID to `docs read`. A page ID is its path below `docs/` without `.md`, such as `animation/camera`. A section adds its heading anchor. Quote IDs containing `#` for portable shell usage. The reader returns original Markdown, including code. A heading read includes its subsections.

```sh
codeboard docs read "reference/api/project#storyboardproject" --max-lines 20
```

When `truncated` is true, repeat the same ID with `--from-line` set to the returned `nextLine`. `--max-lines` defaults to 80 and accepts 1–200. Each response contains at most 24 KiB of source text and never cuts a source line. A partial response can end inside a code block: continue before copying it. `startLine`/`endLine` describe the requested section; `fromLine`/`throughLine` describe the returned slice.

Relative Markdown links remain source links. Resolve them against `source`, remove the `docs/` prefix and `.md` extension, and preserve the anchor to obtain another read ID. Media links are supplemental; images are not bundled. IDs are catalog entries, not arbitrary filesystem paths.

## Match the installed version

Every successful response includes `schemaVersion`, `packageVersion` and `docsHash`. Keep these with extracted evidence. Both commands verify the database checksum and package version; they never fall back to a website's latest documentation. Reinstall the intended package version if the bundle is missing, damaged or mismatched. In a source checkout, run `npm run build` then `npm run docs:bundle`.

The index is generated during packaging. Querying needs no writable cache and does not rebuild it. Node 22 may emit its SQLite experimental warning on stderr; stdout remains JSON. Failures use the [CLI error contract](errors.md).

Older releases may lack `docs`. Use the plugin's matching [offline reference bundle](../start/agent-setup.md) or matching package declarations until upgrading. Newer docs do not prove that an older runtime supports an operation.
