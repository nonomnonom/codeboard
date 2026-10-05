import { StoryboardProject, exportMovie } from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../../config.ts";
const file = join(paths.launch, "codeboard-launch.cboard");
const project = await StoryboardProject.open(file);
const stats = await exportMovie(project, join(paths.launch, "codeboard-launch.mp4"));
await writeFile(
  join(paths.launch, "render.json"),
  JSON.stringify(
    {
      source: file,
      sourceVersion: project.version,
      ...stats,
      visualReview: "pending",
    },
    null,
    2,
  ),
);
