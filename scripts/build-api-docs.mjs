import ts from 'typescript';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const check = process.argv.includes('--check');
assert.ok(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: node scripts/build-api-docs.mjs [--check]');
async function page(path, text) {
  if (check) assert.equal((await readFile(path, 'utf8')).replace(/\r\n/g, '\n'), text,
    `Stale API reference: ${path}; run npm run docs:generate`);
  else await writeFile(path, text);
}

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const program = ts.createProgram(['src/index.ts'], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, skipLibCheck: true });
const checker = program.getTypeChecker();
const index = ts.createSourceFile('index.ts', await readFile('src/index.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const exports = new Set();
for (const node of index.statements) if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
  for (const name of node.exportClause.elements) exports.add(name.name.text);
}
const groups = [
  ['api-project', 'Project and artwork API', 'Create documents, address stable IDs, and edit individual layers or elements. Start with [the demo walkthrough](code-board-demo.md) for an executable project.', ['core/project', 'core/handles']],
  ['api-production', 'Timeline and production API', 'Access these methods through `project.production`. Timeline positions use global integer frames. Read values are inspection copies; use the mutation methods to apply changes. See [animation](animation.md), [camera](camera.md), [audio](audio.md), and [components](components.md).', ['core/production']],
  ['api-drawing', 'Drawing and math API', 'Named functions are imported from `codeboard-studio`. See [drawing](drawing.md), [brushes](brushes.md), and [math](math.md) for use and constraints. Built-in brushes are `brushes.roughPencil`, `cleanInk`, `shadeBrush`, `charcoal`, and `softEraser`. `brushParameterSchema` is JSON Schema data; `production.createBrush` validates a preset when adding it to a project.', ['drawing/curves', 'drawing/path', 'drawing/path-sampling', 'drawing/path-geometry', 'drawing/brushes', 'drawing/brush-authoring', 'drawing/resources', 'drawing/swatch', 'drawing/pixels', 'drawing/pixel-selection', 'drawing/math', 'animation/ik']],
  ['api-render', 'Rendering and export API', 'Render functions return image bytes or canvases; write returned PNG bytes with `writeFile`. Movie export requires FFmpeg. See [review](review.md) and [export](export.md).', ['render/panel-renderer', 'render/review', 'animation/evaluate', 'export/storyboard-export', 'export/animatic-export', 'export/movie-export', 'audio/wav', 'preview/server']],
  ['api-storage', 'Project storage API', 'Open a store with `ProjectStore.open(path)` and always call `close()` in `finally`. For ordinary editing, prefer `StoryboardProject.open` and `save`. See [projects and revisions](projects.md) for partial reads, conflict handling, and named checkpoints.', ['storage/store']],
];
const modifiers = node => ts.getCombinedModifierFlags(node);
const visible = node => !(modifiers(node) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) && !node.name?.getText().startsWith('_') && !node.name?.getText().startsWith('#');
function signature(node, source) {
  const f = ts.factory;
  const checked = checker.getSignatureFromDeclaration(node);
  const returnType = node.type ?? (checked ? checker.typeToTypeNode(checker.getReturnTypeOfSignature(checked), node, ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope) : undefined);
  if (returnType && !node.type) ts.setEmitFlags(returnType, ts.EmitFlags.MultiLine);
  const declaration = ts.isMethodDeclaration(node)
    ? f.updateMethodDeclaration(node, node.modifiers, node.asteriskToken, node.name, node.questionToken, node.typeParameters, node.parameters, returnType, undefined)
    : ts.isGetAccessorDeclaration(node)
      ? f.updateGetAccessorDeclaration(node, node.modifiers, node.name, node.parameters, returnType, undefined)
      : f.updateFunctionDeclaration(node, node.modifiers, node.asteriskToken, node.name, node.typeParameters, node.parameters, returnType, undefined);
  return printer.printNode(ts.EmitHint.Unspecified, declaration, source).replace(/^(export |declare )+/g, '').trim();
}
for (const [slug, title, intro, files] of groups) {
  let output = `# ${title}\n\n${intro}\n\nParameter declarations below are extracted from the current source. A value after \`=\` is the default; \`?\` marks an optional input. Named data shapes are listed in [API types](api-types.md).\n`;
  for (const file of files) {
    const source = program.getSourceFile(`src/${file}.ts`);
    if (!source) throw new Error(`Public reference source missing: ${file}`);
    for (const node of source.statements) {
      if (ts.isClassDeclaration(node) && node.name && (exports.has(node.name.text) || file === 'core/production')) {
        output += `\n## ${node.name.text}\n`;
        for (const member of node.members) if (visible(member) && (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member))) {
          output += `\n### ${member.name.getText(source)}\n\n\`\`\`ts\n${signature(member, source)}\n\`\`\`\n`;
        }
      } else if (ts.isFunctionDeclaration(node) && node.name && exports.has(node.name.text)) {
        output += `\n## ${node.name.text}\n\n\`\`\`ts\n${signature(node, source)}\n\`\`\`\n`;
      }
    }
  }
  await page(`docs/${slug}.md`, output);
}
let types = '# API types\n\nImport exported types from `codeboard-studio` in TypeScript. JavaScript callers use the same object shapes. These declarations describe inputs and returned artwork; they are not instructions to hand-write a project container. Use handles and production methods to edit stored values.\n\nPositions are canvas units; rotation is radians; pressure and opacity use 0–1; pen timestamps use milliseconds; timeline positions use integer frames. Inherited and helper structural types are included for reference; not every helper type is a named package export.\n';
const helperTypes = new Set(['MutationOptions', 'PointLike', 'PathBooleanOperation', 'RenderSource', 'PanelRenderSource', 'MovieExportOptions', 'ToneOptions', 'Header', 'PanelInfo', 'EvaluatedCamera', 'EvaluatedLayer']);
for (const file of ['model/types', 'drawing/resources', 'render/review', 'drawing/path-sampling', 'drawing/pixel-selection', 'drawing/pixels', 'core/coordinates', 'animation/ik', 'export/movie-export', 'core/production', 'drawing/curves', 'drawing/path-geometry', 'render/panel-renderer', 'audio/wav', 'storage/store', 'animation/evaluate']) {
  const source = ts.createSourceFile(file, await readFile(`src/${file}.ts`, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && (file === 'model/types' || exports.has(node.name.text) || helperTypes.has(node.name.text))) {
    types += `\n## ${node.name.text}\n\n\`\`\`ts\n${printer.printNode(ts.EmitHint.Unspecified, node, source)}\n\`\`\`\n`;
  }
}
await page('docs/api-types.md', types);
console.log(`${check ? 'Verified' : 'Generated'} six public API reference pages.`);
