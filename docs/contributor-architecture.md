# Contributor architecture

Read [implemented behavior and limits](architecture.md) for the detailed contract. This page identifies the module that owns each responsibility.

| Responsibility | Source | Useful checks |
| --- | --- | --- |
| Public API and validated document model | `src/index.ts`, `src/model/` | Input validation and ownership tests |
| Authoring handles, transactions, production operations | `src/core/` | History, production, timing and transaction tests |
| Brush presets, paths, resource import | `src/drawing/` | Brush, path sampling and resource tests |
| Brush replay, vector drawing, composition and frame rendering | `src/render/` | Pixel parity, masks, camera resolution and reveal tests |
| Editable SQLite projects and partial reads | `src/storage/` | Persistence, codec, revision and frame-storage tests |
| Movie and storyboard export | `src/export/` | Movie integration and sheet-layout tests |
| Local preview and CLI | `src/preview/`, `src/cli.ts` | Package smoke test and manual loopback preview |
| Artwork and creative timing | `examples/` | Rendered review plus project verification |

The engine has one rendering path shared by previews and exports. A demonstration may author its own coordinates, brushes and timing; it must not introduce a hidden renderer branch for one film.

`npm run check` builds, tests, checks documentation links, and exercises the packed public API. `npm run test:install` additionally installs the archive into a clean temporary directory. Neither publishes a package.

Tests prove specific behavior. Inspect rendered output when changes affect composition, stroke character, masking, animation, or typography. Record limitations, especially platform font differences and native raster antialiasing.
