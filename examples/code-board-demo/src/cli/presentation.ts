import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { findPackageJSON, stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { paths } from "../config.ts";
const command = process.argv[2] ?? "author";
if (process.argv.length > 3)
  throw new Error("Choose one presentation action without extra arguments");
process.env.SKIA_CANVAS_THREADS ??= "1";
const packagePath = findPackageJSON(import.meta.resolve("codeboard-studio"));
if (!packagePath) throw new Error("Cannot locate the active Codeboard package");
const manifest = JSON.parse(readFileSync(packagePath, "utf8")) as {
  bin?: {
    codeboard?: unknown;
  };
};
if (typeof manifest.bin?.codeboard !== "string") throw new Error("Codeboard CLI entry is missing");
const cli = fileURLToPath(new URL(manifest.bin.codeboard, pathToFileURL(packagePath)));
// Each stage releases its renderer and document memory before the next starts.
function run(script: string, args: string[] = []) {
  const result = spawnSync(process.execPath, [cli, "run", script, ...args], {
    cwd: paths.root,
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, CODEBOARD_DEMO_OUTPUT: paths.output },
  });
  if (result.error)
    throw new Error(`Cannot launch the active Codeboard CLI. ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${script} failed (${result.status ?? result.signal})`);
}
switch (command) {
  case "author":
    run("src/presentation/project/performance.ts");
    run("src/presentation/project/film.ts");
    run("src/presentation/review/turnaround.ts");
    break;
  case "render":
    run("src/presentation/review/render.ts");
    break;
  case "verify":
    run("src/presentation/review/verify-performance.ts");
    run("src/presentation/review/verify-film.ts");
    break;
  case "review-script":
    await mkdir(paths.output, { recursive: true });
    await writeFile(
      join(paths.output, "review-playback.js"),
      stripTypeScriptTypes(
        await readFile(new URL("../presentation/review/playback.ts", import.meta.url), "utf8"),
      ),
    );
    console.log(join(paths.output, "review-playback.js"));
    break;
  default:
    throw new Error(
      "Usage: codeboard run src/cli/presentation.ts [author|render|verify|review-script]",
    );
}
