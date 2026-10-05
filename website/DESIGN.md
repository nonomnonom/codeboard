# Codeboard website direction

The user requested alignment with the Nonom portfolio in `web/`. Reference: its `docs/DESIGN.md`, `src/app/globals.css`, local font configuration and button/card primitives. The portfolio is a reference only; Codeboard has no build dependency on that sibling project.

Use the portfolio's monochrome editorial identity: light #f5f5f5, ink #242424, cards #fafafa, muted text #616161, borders #d5d5d5; dark surfaces #242424/#303030, text #f5f5f5, muted text #bbbbbb and borders #555555. DM Sans serves body/navigation; Cormorant Garamond supplies editorial headings. Fonts are bundled locally with their OFL licenses.

ENERGY 2 / RHYTHM 2 / MOTION 1. Use clear reading hierarchy, generous section spacing, 8px component corners, restrained borders and visible keyboard focus. The key visual motif is the portfolio's serif heading against direct sans-serif technical content. Black/white identifies interface actions; diagram colors distinguish data or artwork and are not UI accents.

Fumadocs continues to own navigation, search, TOC, theme controls and code-copy behavior. Adapt its theme tokens and typography rather than copying unrelated application logic. Code and tables may scroll horizontally inside the reading column. Images retain aspect ratio and meaningful alt text; their behavior is explained in adjacent prose. Illustrations show actual Codeboard output; schematic diagrams are labeled explicitly.

No autonomous decorative animation. Retain light/dark parity and reduced-motion support. Keep source examples, fonts, documentation and generated assets inside the Codeboard repository.
