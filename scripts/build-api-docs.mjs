import ts from "typescript";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { relative, resolve } from "node:path";

const check = process.argv.includes("--check");
assert.ok(
  process.argv.slice(2).every((arg) => arg === "--check"),
  "Usage: node scripts/build-api-docs.mjs [--check]",
);
async function page(path, text) {
  if (check)
    assert.equal(
      (await readFile(path, "utf8")).replace(/\r\n/g, "\n"),
      text,
      `Stale API reference: ${path}; run npm run docs:generate`,
    );
  else await writeFile(path, text);
}

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
const program = ts.createProgram(["src/index.ts"], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  skipLibCheck: true,
});
const checker = program.getTypeChecker();
const index = ts.createSourceFile(
  "index.ts",
  await readFile("src/index.ts", "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const exports = new Set();
const runtimeExports = new Set();
const documentedCallables = new Set();
for (const node of index.statements)
  if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
    for (const name of node.exportClause.elements) {
      exports.add(name.name.text);
      if (!node.isTypeOnly && !name.isTypeOnly) runtimeExports.add(name.name.text);
    }
  }
const groups = [
  [
    "api-project",
    "Project and artwork API",
    "Create documents, address stable IDs, and edit individual layers or elements. Read [project concepts](concepts.md) for ownership and [the quickstart](quickstart.md) for a minimal executable operation.",
    [
      "core/project",
      "core/migrate",
      "core/handles/structure",
      "core/handles/layer",
      "core/handles/selection",
      "model/errors",
      "runtime/capabilities",
      "core/edit-plan/artwork",
      "core/edit-plan/studio",
      "core/edit-plan/component-source",
      "core/story/captions",
      "interchange/script-csv",
      "interchange/script-fdx",
      "core/story/board",
      "core/story/board-capture",
      "core/story/lip-sync",
      "story/caption-csv",
    ],
  ],
  [
    "api-production",
    "Timeline and production API",
    "Access these methods through `project.production`. Timeline positions use global integer frames. Read values are inspection copies; use the mutation methods to apply changes. See [animation](animation.md), [camera](camera.md), [audio](audio.md), and [components](components.md).",
    [
      "core/production",
      "animation/rational-time",
      "animation/shot",
      "animation/editorial",
      "animation/editorial-edit",
      "animation/shot-edit",
      "animation/coordinates",
      "animation/shot-merge",
      "core/production/shot-merge",
      "core/production/shot-handoff",
      "core/production/palette-merge",
      "model/palette-merge",
      "animation/shot-points",
      "animation/shot-retime",
      "animation/mesh-inspection",
      "animation/curve-mesh",
      "animation/envelope-mesh",
      "animation/skin-mesh",
      "animation/controller-inspection",
      "animation/controller-transfer",
      "animation/controller-capture",
      "animation/controller-performance",
      "interchange/otio/import",
      "interchange/otio/export",
      "audio/studio",
      "audio/edit",
      "audio/conform",
      "audio/mix",
      "audio/ffmpeg-decoder",
    ],
  ],
  [
    "api-drawing",
    "Drawing and math API",
    "Named functions are imported from `codeboard-studio`. See [drawing](drawing.md), [brushes](brushes.md), and [math](math.md) for use and constraints. Built-in brushes are `brushes.roughPencil`, `cleanInk`, `shadeBrush`, `charcoal`, and `softEraser`. `brushParameterSchema` is JSON Schema data; `production.createBrush` validates a preset when adding it to a project.",
    [
      "drawing/curve-sampling",
      "drawing/point-transforms",
      "drawing/hatching",
      "drawing/path",
      "drawing/path-sampling",
      "drawing/path-geometry",
      "drawing/brushes",
      "drawing/brush-authoring",
      "drawing/resources",
      "drawing/swatch",
      "drawing/pixel-buffer",
      "drawing/pixel-codec",
      "interchange/psd/import",
      "drawing/pixel-selection",
      "drawing/pixel-fill",
      "drawing/math",
      "animation/ik",
    ],
  ],
  [
    "api-render",
    "Rendering and export API",
    "Render functions return image bytes or canvases; write returned PNG bytes with `writeFile`. Movie export requires FFmpeg. See [review](review.md) and [export](export.md).",
    [
      "render/panel",
      "render/panel-renderer",
      "render/shot",
      "render/fonts",
      "render/editorial",
      "render/review/panel",
      "render/review/sheets",
      "render/review/onion-skin",
      "animation/evaluate",
      "animation/lip-sync",
      "export/storyboard-export",
      "export/review-export",
      "export/review-manifest",
      "export/verify-review",
      "export/review-decision",
      "export/project-publish",
      "export/shot-project",
      "export/project-publish-manifest",
      "export/animatic-export",
      "export/movie-export",
      "export/studio-movie",
      "export/audio-stems",
      "export/frame-job",
      "export/frame-job-read",
      "export/frame-job-movie",
      "export/frame-job-sequence",
      "export/verify-frame-sequence",
      "export/verify-frame-job",
      "export/audio-stems-manifest",
      "export/verify-audio-stems",
      "export/movie-encoder",
      "audio/wav",
      "preview/server",
    ],
  ],
  [
    "api-storage",
    "Project storage API",
    "Open a store with `ProjectStore.open(path)` and always call `close()` in `finally`. For ordinary editing, prefer `StoryboardProject.open` and `save`. See [projects and revisions](projects.md) for partial reads, conflict handling, and named checkpoints.",
    ["storage/store"],
  ],
];
const modifiers = (node) => ts.getCombinedModifierFlags(node);
const visible = (node) =>
  !(modifiers(node) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) &&
  !node.name?.getText().startsWith("_") &&
  !node.name?.getText().startsWith("#");
function signature(node, source) {
  const f = ts.factory;
  const checked = checker.getSignatureFromDeclaration(node);
  const returnType =
    node.type ??
    (checked
      ? checker.typeToTypeNode(
          checker.getReturnTypeOfSignature(checked),
          node,
          ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.UseAliasDefinedOutsideCurrentScope,
        )
      : undefined);
  if (returnType && !node.type) ts.setEmitFlags(returnType, ts.EmitFlags.MultiLine);
  const declaration = ts.isMethodDeclaration(node)
    ? f.updateMethodDeclaration(
        node,
        node.modifiers,
        node.asteriskToken,
        node.name,
        node.questionToken,
        node.typeParameters,
        node.parameters,
        returnType,
        undefined,
      )
    : ts.isGetAccessorDeclaration(node)
      ? f.updateGetAccessorDeclaration(
          node,
          node.modifiers,
          node.name,
          node.parameters,
          returnType,
          undefined,
        )
      : f.updateFunctionDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.typeParameters,
          node.parameters,
          returnType,
          undefined,
        );
  return printer
    .printNode(ts.EmitHint.Unspecified, declaration, source)
    .replace(/^(export |declare )+/g, "")
    .trim();
}
for (const [slug, title, intro, files] of groups) {
  let output = `# ${title}\n\n${intro}\n\nParameter declarations below are extracted from the current source. A value after \`=\` is the default; \`?\` marks an optional input. Named data shapes are listed in [API types](api-types.md).\n`;
  for (const file of files) {
    const source = program.getSourceFile(`src/${file}.ts`);
    if (!source) throw new Error(`Public reference source missing: ${file}`);
    for (const node of source.statements) {
      if (
        ts.isClassDeclaration(node) &&
        node.name &&
        (exports.has(node.name.text) || file === "core/production")
      ) {
        output += `\n## ${node.name.text}\n`;
        documentedCallables.add(node.name.text);
        for (const member of node.members)
          if (
            visible(member) &&
            (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member))
          ) {
            output += `\n### ${member.name.getText(source)}\n\n\`\`\`ts\n${signature(member, source)}\n\`\`\`\n`;
          }
      } else if (ts.isFunctionDeclaration(node) && node.name && exports.has(node.name.text)) {
        documentedCallables.add(node.name.text);
        output += `\n## ${node.name.text}\n\n\`\`\`ts\n${signature(node, source)}\n\`\`\`\n`;
      }
    }
  }
  await page(`docs/${slug}.md`, output);
}
const publicModule = checker.getSymbolAtLocation(program.getSourceFile("src/index.ts"));
assert.ok(publicModule, "Public module symbol is missing");
const publicDeclarations = checker.getExportsOfModule(publicModule).map((symbol) => {
  const resolved = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const declarations = resolved.declarations ?? [];
  const location = resolved.valueDeclaration ?? declarations[0];
  const type = location ? checker.getTypeOfSymbolAtLocation(resolved, location) : undefined;
  return {
    name: symbol.name,
    declarations,
    callable:
      runtimeExports.has(symbol.name) &&
      !!type &&
      (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0),
  };
});
const undocumented = publicDeclarations.filter(
  ({ name, declarations, callable }) =>
    (callable ||
      (runtimeExports.has(name) && declarations.some((node) => ts.isClassDeclaration(node)))) &&
    !documentedCallables.has(name),
);
assert.equal(
  undocumented.length,
  0,
  `Public callable exports need an API page source group: ${undocumented.map((entry) => entry.name).join(", ")}`,
);
let types =
  "# API types\n\nImport exported types from `codeboard-studio` in TypeScript. JavaScript callers use the same object shapes. These declarations describe inputs and returned artwork; they are not instructions to hand-write a project container. Use handles and production methods to edit stored values.\n\nPositions are canvas units; rotation is radians; pressure and opacity use 0–1; pen timestamps use milliseconds; timeline positions use integer frames. Inherited and helper structural types are included for reference; not every helper type is a named package export.\n";
const helperTypes = new Set([
  "ValueMergeOptions",
  "ValueMergeConflict",
  "ValueMergeReport",
  "MutationOptions",
  "PointLike",
  "PathBooleanOperation",
  "RenderSource",
  "PanelRenderSource",
  "MovieExportOptions",
  "ToneOptions",
  "Header",
  "PanelInfo",
  "SaveOptions",
  "EvaluatedCamera",
  "EvaluatedLayer",
]);
const typeFiles = [
  "model/value-merge",
  "model/types/primitives",
  "model/types/query",
  "model/types/brushes",
  "model/types/artwork",
  "model/types/animation",
  "model/types/layers",
  "model/types/storyboard",
  "model/types/project",
  "model/types/media",
  "model/types/review",
  "model/types/delivery",
  "model/types/shot",
  "model/types/studio",
  "model/types/editorial",
  "model/types/script",
  "model/types/palettes",
  "animation/lip-sync",
  "animation/shot-merge",
  "interchange/otio/contract",
  "interchange/psd/contract",
  "model/types/studio-audio",
  "model/errors",
  "runtime/capabilities",
  "runtime/capability-catalog",
  "runtime/dependencies",
  "core/migrate",
  "core/project/capture",
  "core/story/captions",
  "core/story/board",
  "story/caption-csv",
  "core/edit-plan/types",
  "core/edit-plan/artwork",
  "core/edit-plan/studio",
  "drawing/resources/types",
  "render/review/panel",
  "render/review/onion-skin",
  "drawing/path-sampling",
  "drawing/pixel-selection",
  "drawing/pixel-fill",
  "drawing/pixel-buffer",
  "drawing/pixel-codec",
  "core/coordinates",
  "animation/ik",
  "animation/rational-time",
  "export/review-contract",
  "export/project-publish-manifest",
  "storage/copy",
  "export/movie-export",
  "export/studio-movie",
  "export/studio-movie-source",
  "export/audio-stems",
  "export/frame-job",
  "export/frame-job-movie",
  "export/verify-frame-job",
  "export/frame-job-contract",
  "render/fonts",
  "export/movie-encoder",
  "core/production",
  "core/production/host",
  "drawing/curve-sampling",
  "drawing/point-transforms",
  "drawing/hatching",
  "drawing/path-geometry",
  "render/panel-renderer",
  "render/source",
  "audio/wav",
  "audio/studio",
  "audio/sample-clock",
  "audio/edit",
  "audio/conform",
  "audio/mix",
  "audio/selection",
  "audio/ffmpeg-decoder",
  "storage/store",
  "storage/types",
  "animation/evaluate",
];
for (const { declarations } of publicDeclarations)
  for (const declaration of declarations) {
    if (!ts.isInterfaceDeclaration(declaration) && !ts.isTypeAliasDeclaration(declaration))
      continue;
    const file = relative(resolve("src"), resolve(declaration.getSourceFile().fileName)).replaceAll(
      "\\",
      "/",
    );
    assert.ok(
      !file.startsWith("../") && file.endsWith(".ts"),
      `Public type is outside source ownership: ${file}`,
    );
    const stem = file.slice(0, -3);
    if (!typeFiles.includes(stem)) typeFiles.push(stem);
  }
const documentedTypes = new Set();
for (const file of typeFiles) {
  const source = ts.createSourceFile(
    file,
    await readFile(`src/${file}.ts`, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  for (const node of source.statements)
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      (file.startsWith("model/types/") ||
        exports.has(node.name.text) ||
        helperTypes.has(node.name.text))
    ) {
      types += `\n## ${node.name.text}\n\n\`\`\`ts\n${printer.printNode(ts.EmitHint.Unspecified, node, source)}\n\`\`\`\n`;
      documentedTypes.add(node.name.text);
    }
}
const missingTypes = publicDeclarations.filter(
  ({ name, declarations }) =>
    declarations.some(
      (node) => ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node),
    ) && !documentedTypes.has(name),
);
assert.equal(
  missingTypes.length,
  0,
  `Public types missing from API reference: ${missingTypes.map((entry) => entry.name).join(", ")}`,
);
await page("docs/api-types.md", types);
console.log(`${check ? "Verified" : "Generated"} six public API reference pages.`);
