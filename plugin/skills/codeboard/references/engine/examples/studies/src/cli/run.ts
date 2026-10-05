import { mkdir, mkdtemp } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  capabilities,
  ProjectStore,
  StoryboardProject,
  exportMovie,
  exportShotMovie,
  exportEditorialMovie,
} from "codeboard-studio";
import { output as defaultOutput } from "../config.ts";
import { studies } from "../catalog.ts";
import { report } from "../shared/artifacts.ts";

const args = process.argv.slice(2);
const video = args.includes("--video");
const positional = args.filter((arg) => arg !== "--video");
if (positional.length > 1 || positional.some((arg) => arg.startsWith("--")))
  throw new Error("Usage: run.ts [new-output-directory] [--video]");
const runtime = await capabilities({ probeDependencies: video });
if (video && runtime.dependencies.ffmpeg.status !== "available")
  throw new Error("Video studies require FFmpeg; set FFMPEG_PATH and FFPROBE_PATH");
const coverage = runtime.features.map((feature) => ({
  feature: feature.id,
  status: feature.status,
  studies: studies.filter((study) => study.features.includes(feature.id)).map((study) => study.id),
  constraints: feature.constraints,
}));
for (const entry of coverage)
  if (entry.status !== "unavailable" && !entry.studies.length)
    throw new Error(`Missing documentation study: ${entry.feature}`);
for (const study of studies)
  for (const feature of study.features)
    if (!runtime.features.some((entry) => entry.id === feature))
      throw new Error(`Unknown runtime feature: ${feature}`);
await mkdir(defaultOutput, { recursive: true });
const output = positional[0] ? resolve(positional[0]) : await mkdtemp(join(defaultOutput, "run-"));
if (positional[0]) await mkdir(output, { recursive: false });
const results = [];
for (const study of studies) {
  if (study.media && !video) {
    results.push({
      id: study.id,
      status: "not-run",
      reason: "Run with --video and FFmpeg/ffprobe",
    });
    continue;
  }
  const directory = join(output, study.id);
  await mkdir(directory);
  console.log(`Rendering documentation study: ${study.id}`);
  await study.render(directory);
  const file = join(directory, `${study.id}.cboard`);
  const store = ProjectStore.open(file);
  try {
    store.verify();
  } finally {
    store.close();
  }
  if (video && study.video) {
    const project = await StoryboardProject.open(file),
      destination = join(directory, `${study.id}.mp4`);
    if (study.video.kind === "board")
      await exportMovie(project, destination, { fontPolicy: "require-available" });
    else if (study.video.kind === "shot")
      await exportShotMovie(project.shotAnimation(study.video.id), destination, {
        audio: "omit",
        fontPolicy: "require-available",
      });
    else
      await exportEditorialMovie(
        project.editorialSequence(study.video.id),
        project.studio.animations,
        destination,
        { audio: "omit", fontPolicy: "require-available" },
      );
  }
  results.push({
    id: study.id,
    status: "generated",
    kind: study.kind,
    image: `${study.id}/${study.id}.png`,
    ...(video && (study.video || study.media) ? { video: `${study.id}/${study.id}.mp4` } : {}),
  });
}
await report(output, "manifest", {
  format: "codeboard-documentation-studies/1",
  runtime: runtime.runtime,
  coverage,
  results,
  visualReview: "pending",
});
console.log(`Documentation assets: ${output}`);
