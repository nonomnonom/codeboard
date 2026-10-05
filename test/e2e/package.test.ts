import { afterAll, beforeAll, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";

const root = resolve(".");
const install = process.env.CODEBOARD_TEST_INSTALL === "1";
let directory: string;
let cli: string;
let version: string;
let entries: string[];

function runNode(args: string[], cwd = directory) {
  return execFileSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

beforeAll(async () => {
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Run package tests with npm test or npm run test:package");
  directory = await mkdtemp(join(tmpdir(), "codeboard-package-e2e-"));
  runNode([join(root, "scripts/build-docs-index.mjs")], root);
  const [archive] = JSON.parse(
    runNode([npm, "pack", "--json", "--ignore-scripts", "--pack-destination", directory], root),
  );
  entries = archive.files.map((file: { path: string }) => file.path);
  const modules = join(directory, "node_modules");
  const engine = join(modules, "codeboard-studio");
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  if (install) {
    runNode([npm, "install", "--no-audit", "--no-fund", join(directory, archive.filename)]);
  } else {
    await mkdir(engine, { recursive: true });
    execFileSync(
      "tar",
      ["-xzf", join(directory, archive.filename), "--strip-components=1", "-C", engine],
      {
        windowsHide: true,
        timeout: 30_000,
      },
    );
    const metadata = JSON.parse(await readFile(join(engine, "package.json"), "utf8"));
    for (const dependency of Object.keys(metadata.dependencies)) {
      const target = join(modules, dependency);
      await mkdir(dirname(target), { recursive: true });
      await symlink(
        join(root, "node_modules", dependency),
        target,
        process.platform === "win32" ? "junction" : "dir",
      );
    }
  }
  const metadata = JSON.parse(await readFile(join(engine, "package.json"), "utf8"));
  version = metadata.version;
  cli = join(engine, metadata.bin.codeboard);
}, 180_000);

afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

it("ships runtime entry points and no repository tests or development sources", () => {
  expect(entries).toEqual(
    expect.arrayContaining(["dist/src/index.js", "dist/src/index.d.ts", "dist/src/cli.js"]),
  );
  expect(
    entries.filter(
      (path) =>
        !path.startsWith("dist/src/") &&
        !["dist/docs/index.sqlite", "dist/docs/manifest.json"].includes(path) &&
        !["package.json", "README.md", "LICENSE", "NOTICE"].includes(path),
    ),
  ).toEqual([]);
});

it("loads the archived public API and preserves editable artwork through storage", async () => {
  const smoke = join(directory, "smoke.mjs");
  await writeFile(smoke, await readFile(join(root, "scripts/package-smoke.mjs")));
  expect(runNode([smoke])).toContain("Public package:");
});

it("reports the archived package version and public commands", () => {
  expect(runNode([cli, "--version"]).trim()).toBe(version);
  const help = runNode([cli, "--help"]);
  expect(help).toContain("inspect");
  expect(help).toContain("movie");
  expect(help).not.toMatch(/\bupdate\b/);
});

it("retrieves versioned documentation offline without loading renderers or development packages", async () => {
  const guard = join(directory, "offline.mjs");
  await writeFile(
    guard,
    `
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s,c,next) { if (['sharp','skia-canvas','remark','typescript','zbsearch'].includes(s.split('/')[0])) throw Error('Unexpected dependency '+s); return next(s,c); }"
));
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
const blocked = () => { throw Error('Network is unavailable'); };
net.connect = net.createConnection = net.Socket.prototype.connect = blocked;
http.request = http.get = https.request = https.get = globalThis.fetch = blocked;
syncBuiltinESMExports();
`,
  );
  const search = JSON.parse(
    runNode([
      "--import",
      pathToFileURL(guard).href,
      cli,
      "docs",
      "search",
      "ProductionTools.drawingNeighbors",
    ]),
  );
  expect(search.packageVersion).toBe(version);
  expect(search.docsHash).toMatch(/^[a-f0-9]{64}$/);
  expect(search.mode).toBe("symbol");
  expect(search.results[0].symbol).toBe("ProductionTools.drawingNeighbors");
  const read = JSON.parse(
    runNode(["--import", pathToFileURL(guard).href, cli, "docs", "read", search.results[0].id]),
  );
  expect(read.docsHash).toBe(search.docsHash);
  expect(read.content).toContain("skipBlank?: boolean");
  expect(read.truncated).toBe(false);
});

it("finds every indexed qualified symbol and reads original source with lossless continuation", async () => {
  const runtime = pathToFileURL(join(dirname(cli), "cli/docs/query.js")).href;
  const database = pathToFileURL(join(dirname(cli), "../docs/index.sqlite")).href;
  const probe = join(directory, "docs-probe.mjs");
  await writeFile(
    probe,
    `
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { searchDocs, readDocs } from ${JSON.stringify(runtime)};
const version = ${JSON.stringify(version)};
const db = new DatabaseSync(new URL(${JSON.stringify(database)}), {readOnly:true});
const symbols = db.prepare('SELECT * FROM symbols').all();
assert(symbols.length > 373);
for (const symbol of symbols) {
 const result = searchDocs(version, symbol.qualified, {limit:'10'});
 assert(result.mode === 'symbol');
 assert(result.results.some(r => r.id === symbol.section_id), symbol.qualified);
}
for (const id of ['animation/onion-skins', 'reference/api/project#storyboardproject']) {
 const parts=[]; let fromLine;
 do {
  const result=readDocs(version,id,{maxLines:'7',...(fromLine?{fromLine}: {})});
  parts.push(result.content); fromLine=result.nextLine?.toString();
 } while(fromLine);
 const section=db.prepare('SELECT * FROM sections WHERE id=?').get(id);
 const page=db.prepare('SELECT * FROM pages WHERE id=?').get(section?.page_id ?? id);
 const expected=section ? page.content.split('\\n').slice(section.start_line-1,section.end_line).join('\\n') : page.content.replace(/\\n$/, '');
 assert.equal(parts.join('\\n').trimEnd(),expected.trimEnd());
}
db.close(); console.log(symbols.length);
`,
  );
  expect(Number(runNode([probe]))).toBeGreaterThan(373);
});

it("ranks task guides, filters API results and rejects unsafe or oversized requests", () => {
  for (const [query, page] of [
    ["camera shot local frames", "animation/camera"],
    ["onion skin previous next drawing", "animation/onion-skins"],
    ["audio samples rational time", "audio/shot-audio"],
    ["component expectedInputHash upgrade", "drawing/component-upgrades"],
  ]) {
    const result = JSON.parse(runNode([cli, "docs", "search", query!]));
    expect(
      result.results.some((row: { pageId: string }) => row.pageId === page),
      query,
    ).toBe(true);
  }
  const onlyApi = JSON.parse(runNode([cli, "docs", "search", "camera", "--kind", "api"]));
  expect(onlyApi.results.length).toBeGreaterThan(0);
  expect(onlyApi.results.every((row: { kind: string }) => row.kind === "api")).toBe(true);
  for (const query of ["zxqvnonexistent", '" OR * --', "gambar sebelum sesudah"]) {
    expect(JSON.parse(runNode([cli, "docs", "search", query])).results).toEqual([]);
  }
  for (const args of [
    ["search", ""],
    ["search", "x".repeat(513)],
    ["search", "camera", "--limit", "0"],
    ["read", "../../package.json"],
    ["read", "index", "--from-line", "999999"],
  ]) {
    const result = spawnSync(process.execPath, [cli, "docs", ...args], {
      cwd: directory,
      encoding: "utf8",
      windowsHide: true,
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("INVALID_ARGUMENT");
  }
});

it("fails closed for damaged or mismatched documentation bundles", async () => {
  const path = join(dirname(cli), "../docs/manifest.json");
  const original = await readFile(path);
  try {
    for (const mutation of [{ packageVersion: "wrong" }, { databaseHash: "0".repeat(64) }]) {
      await writeFile(path, JSON.stringify({ ...JSON.parse(original.toString()), ...mutation }));
      const result = spawnSync(process.execPath, [cli, "docs", "read", "index"], {
        cwd: directory,
        encoding: "utf8",
        windowsHide: true,
      });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(
        "Matching documentation bundle is missing or invalid",
      );
    }
  } finally {
    await writeFile(path, original);
  }
});

it("keeps the npm artifact, lockfile, plugin and website on the same release version", async () => {
  const lock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8"));
  expect(lock.version).toBe(version);
  expect(lock.packages[""].version).toBe(version);
  for (const path of [
    "plugin/plugin.json",
    "plugin/.codex-plugin/plugin.json",
    "plugin/.claude-plugin/plugin.json",
  ]) {
    expect(JSON.parse(await readFile(join(root, path), "utf8")).version, path).toBe(version);
  }
  const site = await readFile(join(root, "website/lib/shared.ts"), "utf8");
  const declarations = [...site.matchAll(/export const releaseVersion = (["'])([^"']+)\1;/g)];
  expect(declarations).toHaveLength(1);
  expect(declarations[0]![2]).toBe(version);
});

it("authors, revises and renders a known image using only the archived CLI", async () => {
  const work = join(directory, "authoring");
  await mkdir(work);
  await writeFile(
    join(work, "scene.mjs"),
    `
import { StoryboardProject } from 'codeboard-studio';
const project = StoryboardProject.create({title:'Package film',width:16,height:8});
const panel = project.addScene('Scene').addShot('Shot').addPanel({id:'panel',durationFrames:2});
panel.addVectorLayer('Red').path([
  {op:'M',x:0,y:0},{op:'L',x:16,y:0},{op:'L',x:16,y:8},{op:'L',x:0,y:8},{op:'Z'}
], {fill:'#ff0000'});
await project.save('film.cboard');
`,
  );
  runNode([cli, "run", "scene.mjs"], work);
  runNode([cli, "validate", "film.cboard"], work);
  await writeFile(
    join(work, "commands.json"),
    JSON.stringify([{ op: "panel.revise", id: "panel", changes: { dialogue: "Revised caption" } }]),
  );
  const plan = runNode([cli, "plan", "film.cboard", "commands.json", "--label", "Caption"], work);
  await writeFile(join(work, "plan.json"), plan);
  const commit = JSON.parse(
    runNode([cli, "commit", "film.cboard", "plan.json", "--request-id", "caption"], work),
  );
  const saved = await readFile(join(work, "film.cboard"));
  const retry = JSON.parse(
    runNode([cli, "commit", "film.cboard", "plan.json", "--request-id", "caption"], work),
  );
  expect(commit.replayed).toBe(false);
  expect(retry).toEqual({ ...commit, replayed: true });
  expect(await readFile(join(work, "film.cboard"))).toEqual(saved);
  await writeFile(
    join(work, "render.mjs"),
    `
import { writeFile } from 'node:fs/promises';
import { StoryboardProject, renderPanelPNG } from 'codeboard-studio';
const project = await StoryboardProject.open('film.cboard');
if(project.toJSON().panels[0].dialogue !== 'Revised caption') throw new Error('Caption was not saved');
await writeFile('frame.png',await renderPanelPNG(project,'panel',{annotations:false}));
`,
  );
  runNode([cli, "run", "render.mjs"], work);
  const { data, info } = await sharp(join(work, "frame.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([16, 8, 4]);
  expect(data).toEqual(Buffer.from(Array.from({ length: 16 * 8 }, () => [255, 0, 0, 255]).flat()));
});

it("creates a runnable starter without overwriting the user's script", async () => {
  const work = join(directory, "starter");
  await mkdir(work);
  const args = install ? [process.env.npm_execpath!, "exec", "--no", "--", "codeboard"] : [cli];
  expect(runNode([...args, "--version"], work).trim()).toBe(version);
  runNode([...args, "init"], work);
  const source = await readFile(join(work, "scene.mjs"));
  expect(() => runNode([...args, "init"], work)).toThrow();
  expect(await readFile(join(work, "scene.mjs"))).toEqual(source);
  runNode([...args, "run", "scene.mjs"], work);
  const metadata = await sharp(join(work, "output/first.png")).metadata();
  expect(metadata.format).toBe("png");
  expect(metadata.width).toBeGreaterThan(0);
  runNode([cli, "validate", "output/first.cboard"], work);
});
