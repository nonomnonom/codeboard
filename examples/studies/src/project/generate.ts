import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  capabilities,
  decodePixels,
  ProjectStore,
  StoryboardProject,
  exportMovie,
  exportShotMovie,
  exportEditorialMovie,
} from "codeboard-studio";
import { output as defaultOutput } from "../config.ts";
import { studies } from "../catalog.ts";
import { report } from "../shared/artifacts.ts";

export async function generate(destination: string | undefined, video = false): Promise<string> {
  const runtime = await capabilities({ probeDependencies: video });
  if (video && runtime.dependencies.ffmpeg.status !== "available")
    throw new Error("Video studies require FFmpeg; set FFMPEG_PATH and FFPROBE_PATH");
  const coverage = runtime.features.map((feature) => ({
    feature: feature.id,
    status: feature.status,
    studies: studies
      .filter((study) => study.features.includes(feature.id))
      .map((study) => study.id),
    constraints: feature.constraints,
  }));
  for (const study of studies)
    for (const feature of study.features)
      if (!runtime.features.some((entry) => entry.id === feature))
        throw new Error(`Unknown runtime feature: ${feature}`);
  await mkdir(defaultOutput, { recursive: true });
  const output = destination ? resolve(destination) : await mkdtemp(join(defaultOutput, "run-"));
  if (destination) await mkdir(output);
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
    console.log(`Generating documentation study: ${study.id}`);
    await study.generate(directory);
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
    const image = await decodePixels(await readFile(join(directory, `${study.id}.png`)));
    const saved = await StoryboardProject.open(file);
    results.push({
      id: study.id,
      status: "generated",
      evidence: {
        projectId: saved.id,
        version: saved.version,
        imageWidth: image.width,
        imageHeight: image.height,
      },
      kind: study.kind,
      image: `${study.id}/${study.id}.png`,
      ...(video && (study.video || study.media) ? { video: `${study.id}/${study.id}.mp4` } : {}),
    });
  }
  await report(output, "manifest", {
    format: "codeboard-documentation-studies/1",
    runtime: runtime.runtime,
    coverage,
    coverageMeaning: "Declared study associations, not runtime coverage or feature certification",
    results,
    visualReview: "pending",
  });
  return output;
}
