import { mkdir, mkdtemp, readFile, copyFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { starter } from "../dist/src/starter.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const work = join(root, ".preview", "documentation-assets");
const target = join(root, "website", "public", "art", "guides");
await mkdir(work, { recursive: true });
await mkdir(target, { recursive: true });
function run(args, cwd = work) {
  const result = spawnSync(process.execPath, [join(root, "dist/src/cli.js"), ...args], {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Guide asset generation failed: ${result.status}`);
}
const generation = await mkdtemp(join(work, "generation-"));
const studiesOutput = join(generation, "studies");
const video = process.argv.includes("--video");
run([
  "run",
  join(root, "examples/studies/src/cli/run.ts"),
  studiesOutput,
  ...(video ? ["--video"] : []),
]);
const manifest = JSON.parse(await readFile(join(studiesOutput, "manifest.json"), "utf8"));
let images = 0,
  movies = 0;
for (const study of manifest.results) {
  if (study.status !== "generated") continue;
  await copyFile(join(studiesOutput, study.image), join(target, `${study.id}.png`));
  images++;
  if (study.video) {
    await copyFile(join(studiesOutput, study.video), join(target, `${study.id}.mp4`));
    movies++;
  }
}
const published = {
  ...manifest,
  results: manifest.results.map((study) =>
    study.status === "generated"
      ? {
          ...study,
          image: `${study.id}.png`,
          ...(study.video ? { video: `${study.id}.mp4` } : {}),
        }
      : study,
  ),
};
await writeFile(join(target, "studies.json"), `${JSON.stringify(published, null, 2)}\n`);
await writeFile(join(generation, "quickstart.ts"), starter);
run(["run", join(generation, "quickstart.ts")], generation);
await copyFile(join(generation, "output/first.png"), join(target, "quickstart.png"));
run(["run", join(root, "scripts/write-studies-guide.ts")], root);
await import("./package-examples.mjs");
console.log(
  `Generated ${images + 1} guide images and ${movies} videos; validated study projects and packaged source.`,
);
