# Technical reference

Use this section when you need an exact command, function signature, data shape or failure contract. For a first project, follow [your first drawing](../start/first-drawing.md); for the object hierarchy and units, read [the project model](../start/project-model.md).

## Commands and API

| Reference | What you will find |
| --- | --- |
| [Command line](cli.md) | Authoring, inspection, revision and export commands |
| [Offline documentation](docs-query.md) | Search exact symbols and task guides, then read bounded source text |
| [Project API](api/project.md) | Create projects and edit artwork through handles |
| [Production API](api/production.md) | Timeline, camera, audio, components and production operations |
| [Drawing API](api/drawing.md) | Paths, brush resources, pixels, math and geometry |
| [Rendering API](api/render.md) | Frames, sheets, movies and delivery verification |
| [Storage API](api/storage.md) | Saved projects, partial reads and named revisions |
| [Types](api/types.md) | Arguments, returned values and stored data shapes |

Import named exports from `codeboard-studio`. API signatures show the callable contract; guide examples show how to combine calls into a task. In a signature, `?` marks an optional argument and a value after `=` is its default.

## Automate inspection and revision

| Task | Reference |
| --- | --- |
| Find a layer or element | [Object queries](object-queries.md) |
| Read saved metadata | [Storage queries](storage-queries.md) |
| Inspect timeline records | [Timeline queries](timeline-queries.md) |
| Inspect drawings and holds | [Drawing queries](drawing-queries.md) |
| Commit an edit that can be retried safely | [Edit plans](edit-plans.md) |
| Prepare shot, editorial or audio commands | [Shot plans](shot-plans.md) |
| Convert between frame and sample clocks | [Time conversion](time.md), [audio rounding](audio-timing.md) |
| Check files and embedded media | [Storage integrity](storage-integrity.md) |
| Diagnose a rejected operation | [Errors](errors.md), [troubleshooting](troubleshooting.md) |

Use the reference that matches your installed engine. `codeboard --version` identifies it; `codeboard capabilities` lists the available operations and their constraints.
