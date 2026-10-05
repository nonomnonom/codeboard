import { exportMovie } from "codeboard-studio";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { author } from "../project/author.ts";
import { output } from "../config.ts";
import { sheets } from "../review/review.ts";
import { makeSound } from "../audio/sound.ts";
export { author } from "../project/author.ts";
async function main() {
  await mkdir(output, { recursive: true });
  const board = author(),
    bytes = makeSound();
  await writeFile(join(output, "lengkap-foley.wav"), bytes);
  board.transaction("Place original Foley", () => {
    const id = board.production.addAsset({
      id: "asset:foley",
      name: "Original pen, paper, stamp and room",
      kind: "audio",
      path: "lengkap-foley.wav",
      mimeType: "audio/wav",
      source: "managed",
      checksum: createHash("sha256").update(bytes).digest("hex"),
    });
    const track = board.production.addAudioTrack("Foley / no voice or music");
    board.production.addAudioClip(track, {
      assetId: id,
      name: "LENGKAP / 15s mix",
      startFrame: 0,
      sourceInFrame: 0,
      durationFrames: 360,
      volume: 1,
      fadeInFrames: 0,
      fadeOutFrames: 0,
    });
  });
  await board.save(join(output, "lengkap.cboard"), { overwrite: true });
  await sheets(board);
  console.log("Artwork and editable project saved.");
  if (process.argv.includes("--movie")) {
    const stats = await exportMovie(board, join(output, "lengkap.mp4"), {
      onProgress: (n, total) => {
        if (n % 24 === 0) console.log(`Render ${n}/${total}`);
      },
    });
    await writeFile(join(output, "render-metrics.json"), JSON.stringify(stats, null, 2));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
