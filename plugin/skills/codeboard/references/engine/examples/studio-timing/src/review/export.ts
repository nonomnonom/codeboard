import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  StoryboardProject,
  ProjectStore,
  createFFmpegAudioDecoder,
  exportEditorialMovie,
  exportReview,
} from "codeboard-studio";
import { config, paths } from "../config.ts";

export async function review(directory = config.output) {
  const files = paths(directory);
  const project = await StoryboardProject.open(files.project);
  return exportReview(files.project, directory, {
    expectedVersion: project.version,
    target: { kind: "editorial", sequenceId: config.sequenceId },
    frames: [0, 12, 119, 120, 131, 132, 239],
  });
}

export async function movie(directory = config.output) {
  const files = paths(directory);
  const project = await StoryboardProject.open(files.project);
  const store = ProjectStore.open(files.project);
  try {
    const decoder = createFFmpegAudioDecoder((id) =>
      store.readAsset(id, { expectedVersion: project.version }),
    );
    const result = await exportEditorialMovie(
      project.editorialSequence(config.sequenceId),
      project.studio.animations,
      files.movie,
      {
        audio: { mode: "mix", decoder, transitions: "sum" },
      },
    );
    const report = {
      projectId: project.id,
      version: project.version,
      movieSha256: createHash("sha256")
        .update(await readFile(files.movie))
        .digest("hex"),
      ...result,
    };
    await writeFile(join(directory, "delivery.json"), `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    store.close();
  }
}
