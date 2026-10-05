# Codeboard website direction

The user requested alignment with the Nonom portfolio in `web/`. Reference: its `docs/DESIGN.md`, `src/app/globals.css`, local font configuration and button/card primitives. The portfolio is a reference only; Codeboard has no build dependency on that sibling project.

Use the Nonom Library application's monochrome surfaces: light #ebebeb, ink #242424, white cards and popovers, muted text #616161, borders #e9e9e9; dark surfaces #242424/#303030, text #f5f5f5, muted text #bbbbbb and borders #555555. DM Sans serves body, navigation, and documentation headings; Cormorant Garamond remains the editorial face for the homepage, showcase, and wordmark. Fonts are bundled locally with their OFL licenses.

ENERGY 2 / RHYTHM 2 / MOTION 1. Match Nonom's 12px control corners, 16px panels, 48px primary controls, quiet grey dividers, and visible keyboard focus. Documentation uses a white reading panel on a grey shell. Search and page actions use the same surface and control hierarchy. Code blocks have a separate toolbar, visible copy label, highlighted source, and keyboard-scrollable content. Black/white identifies interface actions; diagram colors distinguish data or artwork and are not UI accents.

Fumadocs Base UI continues to own navigation, search, TOC, theme controls and code-copy behavior. Its shadcn preset maps local semantic tokens to those components. Do not copy the account or billing shell into documentation. Code and tables may scroll horizontally inside the reading column. Images retain aspect ratio and meaningful alt text; their behavior is explained in adjacent prose. Illustrations show actual Codeboard output; schematic diagrams are labeled explicitly.

The shared homepage footer and documentation page credit identify Codeboard as made by Nonom Friedman and link to the portfolio and Nonom Library. The top-level navigation includes Nonom Library. Keep these destinations in `lib/shared.ts` so they do not diverge between layouts.

No autonomous decorative animation. Retain light/dark parity and reduced-motion support. Keep source examples, fonts, documentation and generated assets inside the Codeboard repository.
