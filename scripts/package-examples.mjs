import { readFile, writeFile, readdir, mkdir, mkdtemp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { zipSync } from "fflate";
const root = new URL("../", import.meta.url);
const target = new URL("website/public/art/examples/", root);
await mkdir(target, { recursive: true });
const engine = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const workspace = JSON.parse(await readFile(new URL("examples/package.json", root), "utf8"));
const packRoot = fileURLToPath(new URL(".preview/example-packages/", root));
await mkdir(packRoot, { recursive: true });
const packDirectory = await mkdtemp(join(packRoot, "build-"));
const npm =
  process.env.npm_execpath ?? join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const docsBuild = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("scripts/build-docs-index.mjs", root))],
  { cwd: fileURLToPath(root), stdio: "inherit", windowsHide: true },
);
if (docsBuild.error) throw docsBuild.error;
if (docsBuild.status !== 0) throw new Error("Cannot bundle engine documentation");
const packed = spawnSync(
  process.execPath,
  [npm, "pack", "--ignore-scripts", "--json", "--pack-destination", packDirectory],
  {
    cwd: fileURLToPath(root),
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  },
);
if (packed.error) throw packed.error;
if (packed.status !== 0) throw new Error(`Cannot package the local engine: ${packed.stderr}`);
const [artifact] = JSON.parse(packed.stdout);
const engineArchive = await readFile(join(packDirectory, artifact.filename));
const projects = [
  ...new Set(
    Object.keys(workspace.scripts)
      .filter((name) => name.includes(":"))
      .map((name) => name.split(":")[0]),
  ),
].map((name) => ({ name }));
for (const project of projects) {
  const base = `examples/${project.name}/`;
  const scripts = { typecheck: "tsc --noEmit" };
  for (const [name, command] of Object.entries(workspace.scripts)) {
    if (!name.startsWith(`${project.name}:`)) continue;
    const prefix = `node --import tsx src/cli/run.ts ${project.name} `;
    if (!command.startsWith(prefix)) throw new Error(`Unsupported example command: ${name}`);
    scripts[name.slice(project.name.length + 1)] = `codeboard run ${command.slice(prefix.length)}`;
  }
  const manifest = {
    name: `@codeboard/example-${project.name}`,
    version: workspace.version,
    private: true,
    type: "module",
    scripts,
    dependencies: { "codeboard-studio": "file:vendor/codeboard-studio.tgz" },
  };
  const files = {};
  async function collect(relative) {
    for (const entry of await readdir(new URL(base + relative, root), { withFileTypes: true })) {
      const file = relative + entry.name;
      if (entry.isDirectory()) await collect(`${file}/`);
      else if (/\.(?:ts|cboard|otio|md|woff2|png|psd)$/.test(entry.name))
        files[`${project.name}/${file}`] = await readFile(new URL(base + file, root));
    }
  }
  await collect("src/");
  files[`${project.name}/vendor/codeboard-studio.tgz`] = engineArchive;
  files[`${project.name}/vendor/engine.json`] = Buffer.from(
    `${JSON.stringify({ name: engine.name, version: engine.version, integrity: artifact.integrity }, null, 2)}\n`,
  );
  manifest.devDependencies = {
    typescript: engine.devDependencies.typescript,
    "@types/node": engine.devDependencies["@types/node"],
  };
  const config = {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2023", "DOM"],
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      verbatimModuleSyntax: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      skipLibCheck: true,
      types: ["node"],
    },
    include: ["src/**/*.ts"],
  };
  files[`${project.name}/package.json`] = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  files[`${project.name}/tsconfig.json`] = Buffer.from(`${JSON.stringify(config, null, 2)}\n`);
  for (const entry of await readdir(new URL(base, root), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const source = new URL(`${base}${entry.name}`, root);
    const markdown = await readFile(source, "utf8");
    const standalone = markdown.replace(
      /(!?\[[^\]]*\]\()([^\s)]+)(\))/g,
      (match, start, href, end) => {
        if (/^(?:[a-z]+:|\/|#)/i.test(href)) return match;
        const destination = new URL(href, source);
        const local = relative(fileURLToPath(new URL(base, root)), fileURLToPath(destination));
        if (local !== ".." && !local.startsWith(`..${sep}`)) return match;
        const path = relative(fileURLToPath(root), fileURLToPath(destination)).split(sep).join("/");
        if (path === ".." || path.startsWith("../"))
          throw new Error(`Documentation link leaves repository: ${href}`);
        const host = start.startsWith("!")
          ? "https://raw.githubusercontent.com/nonomnonom/codeboard/main/"
          : "https://github.com/nonomnonom/codeboard/blob/main/";
        return `${start}${host}${path}${destination.hash}${end}`;
      },
    );
    files[`${project.name}/${entry.name}`] = Buffer.from(standalone);
  }
  files[`${project.name}/LICENSE`] = await readFile(new URL("LICENSE", root));
  await writeFile(new URL(`${project.name}.zip`, target), zipSync(files, { level: 9 }));
}
console.log(
  "Packaged each example with its matching local engine build; no engine publication required.",
);
