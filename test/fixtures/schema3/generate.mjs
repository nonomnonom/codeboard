import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source) throw new Error("Pass the extracted c666f4d source directory");
const { StoryboardProject, ProjectStore, createToneWav, renderFramePNG } = await import(
  pathToFileURL(resolve(source, "src/index.ts")).href
);
const output = fileURLToPath(new URL("./", import.meta.url));
await mkdir(output, { recursive: true });
const project = StoryboardProject.create({
  title: "Schema 3 migration fixture",
  width: 64,
  height: 64,
  frameRate: 24,
});
const scene = project.addScene("Legacy scene");
const first = scene.addShot("First").addPanel({ durationFrames: 24 });
const second = scene.addShot("Second").addPanel({ durationFrames: 24 });
for (const [panel, start, fill] of [
  [first, 0, "red"],
  [second, 24, "blue"],
]) {
  const layer = panel.addVectorLayer("Mark");
  layer.path(
    [{ op: "M", x: 4, y: 4 }, { op: "L", x: 20, y: 4 }, { op: "L", x: 20, y: 20 }, { op: "Z" }],
    { fill },
  );
  project.production.addLayerKeyframe(layer.id, start, { transform: { x: 0 } });
  project.production.addLayerKeyframe(layer.id, start + 23, { transform: { x: 20 } });
}
project.production.setTransition(first.id, { type: "dissolve", durationFrames: 4 });
const wav = createToneWav({ frequency: 440, durationSeconds: 2 });
await writeFile(join(output, "cue.wav"), wav);
const assetId = project.production.addAsset({
  id: "legacy-cue",
  name: "Cue",
  kind: "audio",
  path: "cue.wav",
  source: "linked",
  mimeType: "audio/wav",
});
const track = project.production.addAudioTrack("Sound");
project.production.addAudioClip(track, {
  assetId,
  name: "Trimmed cue",
  startFrame: 3,
  sourceInFrame: 2,
  durationFrames: 30,
  volume: 0.5,
  fadeInFrames: 2,
  fadeOutFrames: 3,
});
if (project.toJSON().schemaVersion !== 3)
  throw new Error("Generator requires the legacy schema-3 writer");
const file = join(output, "legacy.cboard");
await project.save(file, { overwrite: true });
const store = ProjectStore.open(file);
try {
  store.saveRevision("legacy-checkpoint", { expectedVersion: project.version });
} finally {
  store.close();
}
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const frames = [];
for (const frame of [0, 12, 20, 22, 23, 24, 36, 47]) {
  const png = await renderFramePNG(project.toJSON(), frame);
  await writeFile(join(output, `frame-${frame}.png`), png);
  frames.push({ frame, sha256: sha256(png) });
}
await writeFile(
  join(output, "expected.json"),
  `${JSON.stringify({ writerCommit: "c666f4df8984ad0af55b555f190126b25b86b046", schemaVersion: 3, fileSha256: sha256(await readFile(file)), audioSha256: sha256(wav), assetId, document: project.toJSON(), frames }, null, 2)}\n`,
);
