import {
  StoryboardProject,
  createRenderSession,
  exportMovie,
  renderFrameSheet,
} from "codeboard-studio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { colors } from "../../character/art.ts";
import { paths } from "../../config.ts";
import { attachSound } from "./performance.ts";
import { draw as drawClosing } from "../scenes/closing.ts";
import { draw as drawCurves } from "../scenes/curves.ts";
import { draw as drawDelivery } from "../scenes/delivery.ts";
import { draw as drawFinish } from "../scenes/finish.ts";
import { draw as drawPerformance } from "../scenes/performance.ts";
import { draw as drawPrompt } from "../scenes/prompt.ts";
import { draw as drawQuestion } from "../scenes/question.ts";
import { draw as drawRevision } from "../scenes/revision.ts";
import { draw as drawStoryboard } from "../scenes/storyboard.ts";
import { draw as drawTimeline } from "../scenes/timeline.ts";
import { rigging, turnaround } from "../artwork/studies.ts";
const sceneDrawings = [
  drawQuestion,
  drawPrompt,
  drawStoryboard,
  drawRevision,
  drawTimeline,
  drawCurves,
  drawFinish,
  drawDelivery,
  drawPerformance,
  drawClosing,
];
const ffmpegPath = process.env.FFMPEG_PATH ?? "ffmpeg";
export const launchOut = paths.launch;
export const stages: [string, number][] = [
  ["THE QUESTION", 3],
  ["THE PROMPT", 4],
  ["TURNAROUND", 4],
  ["RIGGING", 4],
  ["STORYBOARD", 3],
  ["THE REVISION", 6],
  ["TIMELINE", 4],
  ["BEZIER & IN-BETWEEN", 3],
  ["ROUGH TO DETAIL", 4],
  ["DELIVERY", 2],
  ["THE ANIMATION", 8],
  ["CODEBOARD", 3],
];
export const durationSeconds = stages.reduce((n, [, s]) => n + s, 0);
export const finalStartFrame = stages
  .slice(
    0,
    stages.findIndex(([name]) => name === "THE ANIMATION"),
  )
  .reduce((n, [, s]) => n + s * 24, 0);
export async function authorLaunch() {
  const poseSource = await readFile(new URL("../../character/poses.ts", import.meta.url), "utf8");
  const verification = JSON.parse(
    await readFile(join(paths.performance, "verification.json"), "utf8"),
  );
  const b = StoryboardProject.create({
    title: "Codeboard / From prompt to performance",
    width: 1920,
    height: 1080,
    frameRate: 24,
    background: colors.bg,
    seed: 72,
  });
  let start = 0;
  b.transaction("Stage an agent workflow using real source and real drawings", () => {
    for (const [ordinal, [name, seconds]] of stages.entries()) {
      const index = ordinal >= 4 ? ordinal - 2 : ordinal;
      const duration = seconds * 24,
        end = start + duration;
      const p = b
        .addScene(name)
        .addShot(name)
        .addPanel({ id: `launch:${ordinal + 1}`, title: name, durationFrames: duration });
      if (name === "TURNAROUND") {
        turnaround(b, p, start, end);
        start = end;
        continue;
      }
      if (name === "RIGGING") {
        rigging(b, p, start, end);
        start = end;
        continue;
      }
      const draw = sceneDrawings[index];
      if (!draw) throw new Error("Missing presentation scene");
      draw({ project: b, panel: p, start, end, ordinal, poseSource });
      start = end;
    }
    b.setMetadata(
      "presentation",
      "Scripted visualization of an agent workflow, not a screen recording. Claude Code is depicted as the agent; Codeboard is the product. No endorsement claim.",
    );
    b.setMetadata(
      "source",
      "Displayed source is extracted from actual poses.ts. Turnaround has 32 additional model-sheet drawings; rig controls visualize the same procedural leg/body geometry used by art.ts. Public API names and verification figures refer to the saved project and its authoring scripts.",
    );
    b.setMetadata("verification", JSON.stringify(verification));
  });
  if (
    verification.uniqueRenderedDrawings !== 55 ||
    verification.exposureKeys !== 84 ||
    verification.pairedFramesCompared !== 192
  )
    throw new Error("Update displayed verification figures to match the actual project.");
  return b;
}
export async function main(movie = process.argv.includes("--movie")) {
  await mkdir(join(launchOut, "review"), { recursive: true });
  const b = await authorLaunch();
  await attachSound(b, "launch-foley.wav", durationSeconds, finalStartFrame / 24, false, launchOut);
  const path = join(launchOut, "codeboard-launch.cboard");
  await b.save(path, { overwrite: true });
  const saved = await StoryboardProject.open(path),
    s = createRenderSession(saved);
  let offset = 0;
  const fs = stages.map(([, seconds]) => {
    const f = offset + Math.floor(seconds * 24 * 0.72);
    offset += seconds * 24;
    return f;
  });
  for (const [i, f] of fs.entries()) {
    const c = s.frame(f);
    await writeFile(join(launchOut, "review", `stage-${i + 1}.png`), await c.toBuffer("png"));
    c.getContext("2d").reset();
  }
  await writeFile(
    join(launchOut, "launch-overview.png"),
    await renderFrameSheet(saved, fs, { columns: 3, thumbnailWidth: 640 }),
  );
  await writeFile(
    join(launchOut, "timeline.json"),
    JSON.stringify(
      stages.reduce(
        (r, [name, seconds]) => {
          const start = r.at(-1)?.endSeconds ?? 0;
          r.push({ name, startSeconds: start, endSeconds: start + seconds });
          return r;
        },
        [] as {
          name: string;
          startSeconds: number;
          endSeconds: number;
        }[],
      ),
      null,
      2,
    ),
  );
  console.log(
    `Launch authoring: ${durationSeconds} seconds; final begins at ${finalStartFrame / 24}s.`,
  );
  if (movie) {
    const stats = await exportMovie(saved, join(launchOut, "codeboard-launch.mp4"), {
      ffmpegPath,
      onProgress: (n, total) => {
        if (n % 96 === 0) console.log(`Launch ${n}/${total}`);
      },
    });
    await writeFile(join(launchOut, "render.json"), JSON.stringify(stats, null, 2));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
