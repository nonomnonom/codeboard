import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = process.argv[2];
if (!directory) throw new Error("Pass the extracted schema-4 engine package directory");
const {
  StoryboardProject,
  ProjectStore,
  createToneWav,
  defineEditorialSequence,
  renderFramePNG,
  renderShotFramePNG,
  renderEditorialFramePNG,
} = (await import(
  pathToFileURL(resolve(directory, "dist/src/index.js")).href
)) as typeof import("../../../src/index.js");
const output = fileURLToPath(new URL("./", import.meta.url));
await mkdir(output, { recursive: true });
const project = StoryboardProject.create({
  title: "Schema 4 studio migration",
  width: 48,
  height: 48,
  frameRate: 24,
});
assert.equal(project.toJSON().schemaVersion, 4, "Use the original schema-4 writer");
const scene = project.addScene("Migration scene");
for (const [index, color] of ["#cc2244", "#2255cc"].entries()) {
  const panel = scene.addShot(`Shot ${index}`).addPanel({ durationFrames: 24 });
  const layer = panel.addVectorLayer("Moving mark");
  layer.path(
    [{ op: "M", x: 3, y: 3 }, { op: "L", x: 13, y: 3 }, { op: "L", x: 13, y: 13 }, { op: "Z" }],
    { fill: color },
  );
  project.production.addLayerKeyframe(layer.id, index * 24, { transform: { x: 0 } });
  project.production.addLayerKeyframe(layer.id, index * 24 + 23, { transform: { x: 20 } });
  project.capturePanelAnimation(panel.id, { id: `animation:${index}` });
}
await writeFile(join(output, "cue.wav"), createToneWav({ frequency: 523.25, durationSeconds: 2 }));
project.production.addAsset({
  id: "cue",
  name: "Cue",
  kind: "audio",
  path: "cue.wav",
  source: "linked",
  mimeType: "audio/wav",
});
project.setStudioAudio("animation:0", [
  {
    id: "sound",
    name: "Trimmed samples",
    muted: false,
    clips: [
      {
        id: "sample-cue",
        assetId: "cue",
        name: "Cue",
        start: { ticks: 2, rate: { numerator: 24, denominator: 1 } },
        source: { sampleRate: 48000, startSample: 1001, sampleCount: 24000 },
        volume: 0.5,
        fadeInSamples: 800,
        fadeOutSamples: 1200,
      },
    ],
  },
]);
project.putEditorialSequence(
  defineEditorialSequence(
    {
      id: "edit",
      frameRate: { numerator: 24, denominator: 1 },
      clips: [0, 1].map((index) => ({
        id: `clip:${index}`,
        animationId: `animation:${index}`,
        startFrame: index * 18,
        sourceInFrame: 3,
        durationFrames: 18,
        transition: { type: "cut" as const, durationFrames: 0 },
      })),
    },
    project.studio.animations,
  ),
);
const file = join(output, "legacy.cboard");
await project.save(file, { overwrite: true });
const receipt = (
  await project.commit(
    project.plan("Saved legacy title", [
      { op: "project.metadata", key: "fixture", value: "schema-4" },
    ]),
    { requestId: "legacy-request" },
  )
).receipt;
const store = ProjectStore.open(file);
try {
  assert.equal(store.inspect().formatVersion, 2);
  store.saveRevision("studio-checkpoint", { expectedVersion: project.version });
} finally {
  store.close();
}
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const document = project.toJSON();
const samples: {
  kind: "board" | "shot" | "editorial";
  frame: number;
  filename: string;
  sha256: string;
}[] = [];
for (const kind of ["board", "shot", "editorial"] as const) {
  for (const frame of kind === "board"
    ? [0, 12, 24, 47]
    : kind === "shot"
      ? [0, 11, 23]
      : [0, 17, 18, 35]) {
    const png =
      kind === "board"
        ? await renderFramePNG(document, frame)
        : kind === "shot"
          ? await renderShotFramePNG(document.studio.animations[0]!, frame)
          : await renderEditorialFramePNG(
              document.studio.editorial[0]!,
              document.studio.animations,
              frame,
            );
    const filename = `${kind}-${frame}.png`;
    await writeFile(join(output, filename), png);
    samples.push({ kind, frame, filename, sha256: hash(png) });
  }
}
await writeFile(
  join(output, "expected.json"),
  `${JSON.stringify(
    {
      writerArchiveSha256: "42df13e06288998b577b2b7a8ba5055bce3efc298a3e07531db2e3826eca04f8",
      fileSha256: hash(await readFile(file)),
      audioSha256: hash(await readFile(join(output, "cue.wav"))),
      document,
      receipt,
      samples,
    },
    null,
    2,
  )}\n`,
);
