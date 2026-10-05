# Reference inputs

`schema3.cboard` is the immutable schema-3 fixture written by Codeboard commit `c666f4df8984ad0af55b555f190126b25b86b046`. It is a byte-for-byte copy of the repository's migration test fixture. It contains two board panels, animated artwork, a transition, embedded WAV media and a checkpoint. The current writer did not manufacture this input by changing a schema number.

The migration study renders matching frames before and after migration and rejects pixel differences. Migration creates a new current-format file; the original checkpoint remains in this source. Keep this input in the downloadable example. The fixture uses the repository's MIT license.

`cuts.otio` is generated with the official OpenTimelineIO 0.18.1 Python package by
`test/fixtures/otio/generate.py` in the Codeboard repository. Shot B uses 30 fps,
frames `[6, 36)`; shot A uses 24 fps, frames `[1007, 1025)` with media origin
1001. Together they occupy 42 frames at 24 fps. The OTIO study supplies explicit
URL-to-animation mappings. The named `.mov` references are fixture identifiers;
those source movies are not included or read. The study renders its mapped
editable animations and produces a conformed editorial movie with `--video`.
