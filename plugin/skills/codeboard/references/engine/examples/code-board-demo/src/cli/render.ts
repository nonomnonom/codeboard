import { StoryboardProject, exportMovie } from "codeboard-studio";
import { join } from "node:path";
import { output } from "../config.ts";
import { renderReview } from "../study/main.ts";
const project = await StoryboardProject.open(join(output, "clawd.cboard"));
await renderReview(project, output);
if (process.argv.includes("--movie")) await exportMovie(project, join(output, "clawd.mp4"));
console.log(`Rendered saved project version ${project.version}; visual review is pending.`);
