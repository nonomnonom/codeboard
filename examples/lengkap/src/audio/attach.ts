import type { StoryboardProject } from "codeboard-studio";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { makeSound } from "./sound.ts";
export async function attachSound(board: StoryboardProject, output: string): Promise<void> {
  const bytes = makeSound();
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
}
