import { encodeWav, type StoryboardProject } from "codeboard-studio";
export function fitRainBed(project: StoryboardProject, endFrame: number): void {
  const track = project.production
    .find({ kind: "audio-track", name: "rain" })
    .find((track) => track.name === "rain");
  if (!track) throw new Error("Flagship rain track missing");
  const clips = project.production.audioClips(track.id, { assetId: "asset:rain" });
  if (clips.length !== 1) throw new Error("Expected one continuous rain bed");
  const clip = clips[0]!;
  project.production.updateAudioClip(track.id, clip.id, {
    durationFrames: endFrame - clip.startFrame,
  });
}
export function sound(kind: "rain" | "mechanism" | "light" | "ignition", seconds: number): Buffer {
  const rate = 48000,
    n = Math.round(rate * seconds),
    left = new Float32Array(n),
    right = new Float32Array(n);
  let state = 14567,
    low = 0,
    other = 0;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return (state / 4294967296) * 2 - 1;
  };
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      noise = random();
    low = 0.97 * low + 0.03 * noise;
    other = 0.96 * other + 0.04 * random();
    const envelope = Math.min(1, t / (kind === "ignition" ? 0.002 : 0.08), (seconds - t) / 0.15);
    let a = 0,
      b = 0;
    if (kind === "rain") {
      a = (noise * 0.065 + low * 0.32) * (1 + 0.16 * Math.sin(t * 0.9));
      b = (random() * 0.065 + other * 0.32) * (1 + 0.16 * Math.sin(t * 0.7));
    }
    if (kind === "mechanism") {
      const pulse = t % 0.19,
        decay = Math.exp(-pulse * 90);
      a =
        (noise * 0.22 +
          Math.sin(t * 2 * Math.PI * 1830) * 0.16 +
          Math.sin(t * 2 * Math.PI * 2913) * 0.06) *
        decay;
      b = a * 0.8;
    }
    if (kind === "light") {
      const attack = Math.min(1, t / 1.7),
        release = Math.min(1, (seconds - t) / 2);
      a =
        (Math.sin(t * 2 * Math.PI * 220) * 0.045 +
          Math.sin(t * 2 * Math.PI * 330) * 0.035 +
          Math.sin(t * 2 * Math.PI * 554.36) * 0.025) *
        attack *
        release;
      b =
        (Math.sin((t + 0.001) * 2 * Math.PI * 220) * 0.045 +
          Math.sin((t + 0.002) * 2 * Math.PI * 330) * 0.035 +
          Math.sin(t * 2 * Math.PI * 555.1) * 0.025) *
        attack *
        release;
    }
    if (kind === "ignition") {
      const shimmer = Math.exp(-t * 9),
        overtone = Math.exp(-t * 15),
        contact = noise * 0.055 * Math.exp(-t * 75);
      a =
        Math.sin(t * 2 * Math.PI * 1320) * 0.16 * shimmer +
        Math.sin(t * 2 * Math.PI * 2317) * 0.08 * overtone +
        contact;
      b =
        Math.sin(t * 2 * Math.PI * 1323) * 0.14 * shimmer +
        Math.sin(t * 2 * Math.PI * 2317) * 0.07 * overtone +
        contact * 0.8;
    }
    left[i] = a * envelope;
    right[i] = b * envelope;
  }
  return encodeWav([left, right], rate);
}
