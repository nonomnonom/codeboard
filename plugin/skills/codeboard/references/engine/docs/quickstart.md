# Your first drawing

[Install Codeboard from npm](install.md) with `npm install -g codeboard-studio`, then open a terminal in an empty working folder. Node.js 22.22 or later is required. If you installed Codeboard as a project dependency, use `npx codeboard` for the commands below.

```sh
codeboard init
codeboard run scene.mjs
```

`init` creates `scene.mjs`. It refuses to overwrite an existing file. `run` executes the script and makes the Codeboard API available as `codeboard-studio`.

The starter creates two files:

| File | Use |
| --- | --- |
| `output/first.png` | View the rendered drawing |
| `output/first.cboard` | Reopen and edit the project |

## Change the drawing

Open `scene.mjs` in your coding agent or text editor. The stroke is a curve through four points. Each point has a position and pressure; the brush controls how those samples become paint.

Change `size: 44` to `size: 70`, or replace the stroke color `#191916` with `#b77528`. Run the script again:

```sh
codeboard run scene.mjs
```

The starter deliberately regenerates its two output files. Save subsequent edits under a different filename if you want to keep both versions. [Reopening a saved project](projects.md) lets you revise existing artwork without rebuilding the scene.

## Preview the project

```sh
codeboard preview output/first.cboard
```

Open the local address printed in the terminal. The preview is for reviewing the artwork; make changes through code. Press Ctrl+C to stop the preview server.

## Export a storyboard sheet

```sh
codeboard render output/first.cboard --output sheets
```

The output directory contains panel images and a storyboard PDF. Add more panels to the script to develop a sequence.

## Use TypeScript

`codeboard run` also accepts `.ts` and `.mts` scripts. Type annotations and `import type` are supported. `.mts` always uses ES modules. The runner does not type-check, apply `tsconfig` path aliases, or compile JSX, enums, or parameter properties; use ordinary JavaScript or erasable TypeScript syntax.

## Give your agent a working brief

For example:

> Create a 16:9 storyboard with three panels: a character enters, notices a light, and reaches toward it. Use separate rough and ink layers. Run the script, render a contact sheet, inspect the images, and save the editable project before revising the hand pose.

Continue with [drawing](drawing.md), [animation](animation.md), or [the review loop](review.md).
