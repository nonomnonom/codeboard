import { type StoryboardProject, encodeWav } from "codeboard-studio";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { paths } from "../../config.ts";
const out = paths.performance;
export function sound(seconds: number, actionOffset = 0, process = false) {
  const sr = 48000,
    data = new Float32Array(seconds * sr);
  let seed = 314159;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  function tap(t: number, duration: number, amp: number, freq: number, type = "tap") {
    const start = Math.round(t * sr),
      n = Math.round(duration * sr);
    for (let i = 0; i < n && start + i < data.length; i++) {
      const s = i / sr,
        u = i / n,
        env = Math.min(1, i / 180) * Math.exp(-u * (type === "scrape" ? 2 : 7));
      const wave =
        type === "scrape"
          ? noise() * 0.35
          : Math.sin(2 * Math.PI * (freq * s - (freq * 0.25 * s * s) / duration)) * 0.78 +
            noise() * 0.14;
      data[start + i] = (data[start + i] ?? 0) + amp * env * wave;
    }
  }
  if (process)
    for (const t of [0, 2, 4, 7, 9, 11] as const) tap(t + 0.07, 0.24, 0.1, 400, "scrape");
  const performanceAudio = (offset: number) => {
    for (const f of [0, 12, 24, 36, 48, 60, 72, 84] as const)
      tap(offset + f / 24, 0.095, 0.15, 180);
    tap(offset + 128 / 24, 0.18, 0.12, 530);
    tap(offset + 152 / 24, 0.2, 0.24, 100);
    tap(offset + 174 / 24, 0.07, 0.055, 240);
  };
  performanceAudio(actionOffset);
  if (process) {
    tap(11 + (128 - 112) / 24, 0.18, 0.08, 530);
    tap(11 + (152 - 112) / 24, 0.18, 0.13, 100);
  }
  return encodeWav([data], sr);
}
export async function attachSound(
  b: StoryboardProject,
  name: string,
  seconds: number,
  offset: number,
  process: boolean,
  directory = out,
) {
  const bytes = sound(seconds, offset, process);
  await writeFile(join(directory, name), bytes);
  b.transaction("Attach original synthesized Foley", () => {
    const id = b.production.addAsset({
      name,
      kind: "audio",
      path: name,
      mimeType: "audio/wav",
      source: "managed",
      checksum: createHash("sha256").update(bytes).digest("hex"),
    });
    const track = b.production.addAudioTrack("Original drawing, footfalls, hop and landing / CC0");
    b.production.addAudioClip(track, {
      assetId: id,
      name: "Original Foley",
      startFrame: 0,
      sourceInFrame: 0,
      durationFrames: seconds * 24,
      volume: 1,
      fadeInFrames: 0,
      fadeOutFrames: 0,
    });
  });
}
