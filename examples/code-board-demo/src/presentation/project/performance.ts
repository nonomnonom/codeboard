import { StoryboardProject, exportMovie } from "codeboard-studio";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { paths } from "../../config.ts";
import { acting } from "../../character/poses.ts";
import { authorFinal, authorReel } from "../artwork/performance.ts";
import { attachSound } from "../audio/foley.ts";
import { sheets } from "../review/performance.ts";
export { authorFinal, authorReel, sequence } from "../artwork/performance.ts";
export const out = paths.performance;
const FF = process.env.FFMPEG_PATH;
export async function main() {
  await mkdir(paths.output, { recursive: true });
  await mkdir(out);
  const final = authorFinal(),
    reel = authorReel();
  await attachSound(final, "clawd-foley.wav", 8, 0, false);
  await attachSound(reel, "showreel-foley.wav", 24, 14, true);
  await final.save(join(out, "clawd-final.cboard"));
  await reel.save(join(out, "codeboard-showreel.cboard"));
  await sheets(
    await StoryboardProject.open(join(out, "clawd-final.cboard")),
    await StoryboardProject.open(join(out, "codeboard-showreel.cboard")),
  );
  await writeFile(
    join(out, "exposures.json"),
    JSON.stringify(
      {
        fps: 24,
        durationFrames: 192,
        uniqueDrawings: acting.drawings.size,
        exposures: acting.exposures,
      },
      null,
      2,
    ),
  );
  console.log(
    `Authored ${acting.drawings.size} unique drawings, ${acting.exposures.length} exposures.`,
  );
  if (process.argv.includes("--movie"))
    for (const [_b, name] of [
      [final, "clawd-final"],
      [reel, "codeboard-showreel"],
    ] as const) {
      const reopened = await StoryboardProject.open(join(out, `${name}.cboard`));
      const stats = await exportMovie(reopened, join(out, `${name}.mp4`), {
        ...(FF ? { ffmpegPath: FF } : {}),
        onProgress: (n, total) => {
          if (n % 48 === 0) console.log(`${name}: ${n}/${total}`);
        },
      });
      await writeFile(join(out, `${name}-render.json`), JSON.stringify(stats, null, 2));
    }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
