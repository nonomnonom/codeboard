# Storyboard sheets

`exportStoryboard(project, directory, options)` writes individual panel PNGs and a multipage `storyboard.pdf`, returning `panelFiles`, `pdfFile` and `pageCount`. The saved project remains authoritative; sheet layout never modifies artwork, panel numbering or timing.

Options are `pageWidth`, `pageHeight`, `margin`, `gutter`, `columns`, `rows` and `captionHeight`. Defaults are 1440×1020, 64-pixel margins, 28-pixel gutters, two columns, two rows and a 126-pixel caption area. The image is fitted without cropping or changing its aspect ratio. A representative frame at 60% of each panel's duration is rendered through the normal engine.

Panel title, action, dialogue, camera and notes wrap using actual font metrics. Explicit paragraph breaks are retained; prose whitespace is normalized. Long uninterrupted words are split at grapheme boundaries. Text is never silently shortened with an ellipsis. If a caption does not fit, further cells repeat the same artwork and panel number with a `text 2/3` indicator. Pagination counts these continuation cells before writing the page headers. Increasing `captionHeight` reserves more text space and reduces image space; it does not change the project's camera or frame composition.

Each cell also shows duration, start frame and revision. Project titles wrap in the page header. Invalid dimensions, nonfinite options, noninteger/zero row counts and layouts with no room for artwork or caption lines fail before panel files are written. A page has a 32-megapixel allocation budget. Very long captions can produce many continuation cells; this is a fixed-grid storyboard sheet, not an optimized screenplay layout.
