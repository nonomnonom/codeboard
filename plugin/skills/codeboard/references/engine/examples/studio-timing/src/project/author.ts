import { access, mkdir } from "node:fs/promises";
import { StoryboardProject, defineEditorialSequence } from "codeboard-studio";
import { config, paths } from "../config.ts";
import { authorShots } from "../artwork/shots.ts";
import { authorCues } from "../audio/cues.ts";

export async function author(directory = config.output) {
  const files = paths(directory);
  let exists = true;
  try {
    await access(files.project);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    exists = false;
  }
  if (exists)
    throw new Error("Project already exists; reopen it to revise or use a new output directory");
  await mkdir(directory, { recursive: true });
  const project = StoryboardProject.create({
    title: config.title,
    width: config.width,
    height: config.height,
    frameRate: config.frameRate,
  });
  const animations = authorShots(project);
  await authorCues(project, directory, animations);
  project.putEditorialSequence(
    defineEditorialSequence(
      {
        id: config.sequenceId,
        frameRate: { numerator: config.frameRate, denominator: 1 },
        clips: animations.map((animationId, index) => ({
          id: `cut-${index}`,
          animationId,
          startFrame: index * config.cutFrames,
          sourceInFrame: 0,
          durationFrames: config.cutFrames,
          transition: { type: "cut", durationFrames: 0 },
        })),
      },
      project.studio.animations,
    ),
  );
  await project.save(files.project);
  return project;
}
