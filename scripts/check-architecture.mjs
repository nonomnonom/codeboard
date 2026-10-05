import { readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const nameOf = (file) => relative(root, file).replaceAll("\\", "/");
const graph = new Map();
const eagerGraph = new Map();
const platformImports = new Map();
const errors = new Set();

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts"))
      graph.set(nameOf(file), new Set());
  }
}
await collect(root);
for (const name of graph.keys()) eagerGraph.set(name, new Set());

for (const [name, dependencies] of graph) {
  const file = resolve(root, name);
  const source = ts.createSourceFile(
    file,
    await readFile(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function record(specifier, eager = true) {
    if (specifier === "codeboard-studio") {
      dependencies.add("index.ts");
      if (eager) eagerGraph.get(name).add("index.ts");
      return;
    }
    if (isAbsolute(specifier) || specifier.startsWith("file:") || specifier.startsWith("#")) {
      errors.add(`${name}: use a source-relative dependency instead of ${specifier}`);
      return;
    }
    if (!specifier.startsWith(".")) {
      const platform = specifier.replace(/^node:/, "");
      if (!platformImports.has(name)) platformImports.set(name, new Set());
      platformImports.get(name).add(platform);
      return;
    }
    const target = nameOf(resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
    if (!graph.has(target)) errors.add(`${name}: unresolved source dependency ${specifier}`);
    else {
      dependencies.add(target);
      if (eager) eagerGraph.get(name).add(target);
    }
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        clause?.isTypeOnly ||
        (clause &&
          !clause.name &&
          bindings &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((item) => item.isTypeOnly));
      if (!typeOnly) record(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.isTypeOnly) {
      const bindings = node.exportClause;
      if (
        !bindings ||
        !ts.isNamedExports(bindings) ||
        bindings.elements.length === 0 ||
        bindings.elements.some((item) => !item.isTypeOnly)
      )
        record(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument))
        record(argument.text, node.expression.kind !== ts.SyntaxKind.ImportKeyword);
      else if (name !== "authoring-runner.ts")
        errors.add(`${name}: computed module loading cannot be checked statically`);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      record(node.moduleReference.expression.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

const inDomain = (name, domain) => name.startsWith(`${domain}/`);
const inAny = (name, domains) => domains.some((domain) => inDomain(name, domain));
const contract = (name) =>
  inDomain(name, "core/edit-plan/schema") ||
  [
    "core/edit-plan/schema.ts",
    "core/edit-plan/types.ts",
    "core/edit-plan/fingerprint.ts",
    "core/edit-plan/artwork.ts",
    "core/edit-plan/studio.ts",
    "core/edit-plan/layers.ts",
    "core/edit-plan/component-source.ts",
  ].includes(name);
const facade = (name) =>
  ["core/project.ts", "core/production.ts", "core/handles.ts"].includes(name) ||
  inDomain(name, "core/handles");

const platformIO = new Set([
  "fs",
  "child_process",
  "sqlite",
  "http",
  "https",
  "http2",
  "net",
  "tls",
  "dgram",
  "cluster",
  "worker_threads",
  "inspector",
  "module",
  "process",
]);
const ownsDocumentLogic = (name) =>
  inAny(name, ["model", "animation", "core/project", "core/production"]) ||
  contract(name) ||
  name === "export/frame-job-contract.ts";

const standaloneShotOwners = new Set([
  "animation/shot.ts",
  "animation/shot-edit.ts",
  "animation/layer-pose.ts",
  "animation/rig-rest.ts",
  "animation/shot-hierarchy.ts",
  "animation/coordinates.ts",
  "model/schema/shot.ts",
  "render/shot.ts",
  "render/panel.ts",
]);
const editorialOwners = new Set([
  "animation/editorial.ts",
  "animation/editorial-edit.ts",
  "model/schema/editorial.ts",
  "render/editorial.ts",
]);

function forbidden(origin, target) {
  if (
    ["model/validation/storyboard.ts", "model/validation/studio.ts"].includes(origin) &&
    target === "model/validation/document.ts"
  )
    return true;
  if (
    [
      "model/schema/storyboard.ts",
      "model/schema/media.ts",
      "model/schema/review.ts",
      "model/schema/studio.ts",
      "model/schema/configuration.ts",
      "model/schema/deformation.ts",
    ].includes(origin) &&
    target === "model/schema/project.ts"
  )
    return true;
  if (standaloneShotOwners.has(origin) && editorialOwners.has(target)) return true;
  if (
    origin === "export/frame-job-contract.ts" &&
    inAny(target, ["core", "storage", "render", "export", "preview", "runtime"])
  )
    return true;
  if (
    origin !== "cli.ts" &&
    !inDomain(origin, "cli") &&
    (target === "cli.ts" || inDomain(target, "cli"))
  )
    return true;
  if (inDomain(origin, "cli") && target === "cli.ts") return true;
  if (
    inDomain(origin, "model") &&
    inAny(target, ["core", "storage", "render", "export", "preview"])
  )
    return true;
  if (
    inDomain(origin, "animation") &&
    inAny(target, ["core", "storage", "render", "export", "preview"])
  )
    return true;
  if (
    inDomain(origin, "audio") &&
    inAny(target, ["core", "storage", "render", "export", "preview"])
  )
    return true;
  if (
    inDomain(origin, "interchange") &&
    inAny(target, ["core", "storage", "render", "export", "preview"])
  )
    return true;
  if (inDomain(origin, "render") && inAny(target, ["core", "storage", "export", "preview"]))
    return true;
  if (
    inAny(origin, ["core/project", "core/production"]) &&
    (facade(target) || inAny(target, ["storage", "render", "export", "preview"]))
  )
    return true;
  if (inDomain(origin, "core/project") && inDomain(target, "core/production")) return true;
  if (target === "model/schema.ts" || target === "model/validate.ts") return true;
  if (
    contract(origin) &&
    ((inDomain(target, "core") && !contract(target)) ||
      inAny(target, ["storage", "render", "export", "preview"]))
  )
    return true;
  if (inAny(origin, ["storage", "export"]) && inDomain(target, "core") && !contract(target))
    return true;
  if (inDomain(origin, "storage") && origin !== "storage/store.ts" && target === "storage/store.ts")
    return true;
  if (
    inDomain(origin, "drawing/resources") &&
    (target === "drawing/resources.ts" ||
      target === "index.ts" ||
      inAny(target, ["core", "storage", "render", "export", "preview"]))
  )
    return true;
  if (inDomain(origin, "core/edit-plan/schema") && target === "core/edit-plan/schema.ts")
    return true;
  return false;
}

// Walk from each owner so a barrel or intermediate helper cannot hide an upward dependency.
for (const origin of graph.keys()) {
  const visited = new Set([origin]);
  function walk(current, path) {
    if (ownsDocumentLogic(origin)) {
      for (const platform of platformImports.get(current) ?? []) {
        if (platformIO.has(platform.split("/")[0]))
          errors.add(`Platform I/O boundary: ${[...path, platform].join(" -> ")}`);
        if (platform === "sharp")
          errors.add(`Image codec in document logic: ${[...path, platform].join(" -> ")}`);
      }
    }
    for (const dependency of graph.get(current)) {
      const next = [...path, dependency];
      if (forbidden(origin, dependency)) errors.add(`Boundary: ${next.join(" -> ")}`);
      if (visited.has(dependency)) continue;
      visited.add(dependency);
      walk(dependency, next);
    }
  }
  walk(origin, [origin]);
}

const startupVisited = new Set();
function checkCLIStartup(name, path) {
  if (startupVisited.has(name)) return;
  startupVisited.add(name);
  for (const dependency of eagerGraph.get(name) ?? []) {
    const next = [...path, dependency];
    if (
      inAny(dependency, [
        "core",
        "storage",
        "drawing",
        "render",
        "export",
        "audio",
        "animation",
        "preview",
        "interchange",
      ])
    )
      errors.add(`CLI startup loads production backend: ${next.join(" -> ")}`);
    checkCLIStartup(dependency, next);
  }
}
checkCLIStartup("cli.ts", ["cli.ts"]);

const complete = new Set();
const active = new Set();
function findCycles(name, path) {
  if (active.has(name)) {
    errors.add(`Runtime cycle: ${[...path.slice(path.indexOf(name)), name].join(" -> ")}`);
    return;
  }
  if (complete.has(name)) return;
  active.add(name);
  for (const dependency of graph.get(name)) findCycles(dependency, [...path, name]);
  active.delete(name);
  complete.add(name);
}
for (const name of graph.keys()) findCycles(name, []);

if (errors.size) {
  console.error([...errors].sort().join("\n"));
  process.exitCode = 1;
} else {
  const edges = [...graph.values()].reduce((total, dependencies) => total + dependencies.size, 0);
  console.log(
    `Architecture checked: ${graph.size} source modules, ${edges} runtime dependency edges; no boundary violations or cycles.`,
  );
}
