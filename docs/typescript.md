# TypeScript authoring

Use a local npm dependency when you want editor completion, strict type checking and a reproducible CLI version. `codeboard run` executes supported TypeScript by stripping types; it does not run the TypeScript checker.

## Set up a project

Install Node.js 22.22 or later. In a new artwork folder:

```sh
npm init -y
npm install --save-exact codeboard-studio
npm install --save-dev typescript @types/node
```

Keep `package.json` and `package-lock.json`. On another machine, run `npm ci`. Reuse existing tooling when adding Codeboard to a project that already has a package manifest.

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["*.mts", "src/**/*.mts"]
}
```

`.mts` explicitly selects ES modules. If you prefer `.ts`, set `"type": "module"` in the package manifest and include those files in the configuration. Use explicit file extensions for relative imports.

## A complete typed drawing

Save as `scene.mts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { StoryboardProject, pathCommands, renderFramePNG } from 'codeboard-studio';

const project = StoryboardProject.create({
  title: 'Typed drawing', width: 640, height: 360,
  frameRate: 24, background: '#f3eddf',
});
const panel = project.addScene('Study').addShot('Triangle')
  .addPanel({ id: 'triangle', durationFrames: 48 });
panel.addVectorLayer('Shape', { id: 'shape' }).path(
  pathCommands('M 200 260 L 320 80 L 440 260 Z'),
  { fill: '#b77528', stroke: '#191916', strokeWidth: 4 },
);

await mkdir('output', { recursive: true });
await project.save('output/typed.cboard', { overwrite: true });
await writeFile('output/typed.png', await renderFramePNG(project, 0));
```

The script owns and replaces only `output/typed.cboard` and `output/typed.png`. Keep independently revised artwork in another file.

```sh
npx tsc --noEmit
npx codeboard run scene.mts
npx codeboard validate output/typed.cboard
```

Expect a filled triangle in the PNG and an editable vector layer in the saved project. A successful typecheck does not prove visual quality; open the PNG and inspect the result.

## Imports and supported syntax

Use named imports from `codeboard-studio` and `import type` for type-only imports. Do not import internal `dist/src/...` modules or copy declarations into a pretend module. The local dependency provides both runtime code and public declarations.

Use objects, interfaces, type aliases, unions and ordinary functions. The runner does not compile JSX, enums, parameter properties or `tsconfig` path aliases. A project that depends on those features needs a separate compatible compilation step.

## Common failures

| Symptom | Check |
| --- | --- |
| TypeScript cannot resolve `codeboard-studio` | Install it in the artwork project; a global CLI is not a local dependency |
| Script runs but the typecheck fails | Correct the types; execution strips types without validating them |
| Relative import fails | Use a real relative file path with its extension; remove compiler-only aliases |
| API in a plugin reference is missing | Compare `npx codeboard --version` with the bundled reference version |
| A query result may be undefined | Check the result before editing; do not suppress the error with `any` |

Use [the task map](reference.md) to find operations and [API types](api-types.md) for their public data shapes.
