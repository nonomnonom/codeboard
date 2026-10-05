import type { StoryboardProject } from "codeboard-studio";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sound } from "./sound.ts";
export async function attachSound(
  board: StoryboardProject,
  output: string,
  frame: number,
): Promise<void> {
  await mkdir(join(output, "audio"), { recursive: true });
  const soundPanels = board.toJSON().panels;
  const panelStart = (id: string) => soundPanels.find((panel) => panel.id === id)!.startFrame;
  for (const [kind, seconds, start, duration, volume] of [
    ["rain", 34, 0, frame, 0.9],
    ["mechanism", 3, panelStart("panel:06") + 25, 20, 0.8],
    ["ignition", 0.75, panelStart("panel:08") + 8, 18, 0.55],
    ["light", 9.5, panelStart("panel:11"), 228, 1],
  ] as const) {
    const bytes = sound(kind, seconds),
      path = `audio/${kind}.wav`;
    await writeFile(join(output, path), bytes);
    board.transaction(`Place ${kind}`, () => {
      const asset = board.production.addAsset({
        id: `asset:${kind}`,
        name: kind,
        kind: "audio",
        path,
        mimeType: "audio/wav",
        source: "managed",
        checksum: createHash("sha256").update(bytes).digest("hex"),
      });
      const track = board.production.addAudioTrack(kind);
      board.production.addAudioClip(track, {
        assetId: asset,
        name: kind,
        startFrame: start,
        sourceInFrame: 0,
        durationFrames: duration,
        volume,
        fadeInFrames: kind === "rain" ? 24 : kind === "ignition" ? 0 : 4,
        fadeOutFrames: kind === "mechanism" ? 4 : kind === "ignition" ? 3 : 24,
      });
      if (kind === "mechanism") {
        const relayPanel = board.toJSON().panels.find((p) => p.id === "panel:13")!;
        board.production.addAudioClip(track, {
          assetId: asset,
          name: "Lamp relay contact",
          startFrame: relayPanel.startFrame + 17,
          sourceInFrame: 9,
          durationFrames: 4,
          volume: 0.65,
          fadeInFrames: 0,
          fadeOutFrames: 2,
        });
      }
    });
  }
}
