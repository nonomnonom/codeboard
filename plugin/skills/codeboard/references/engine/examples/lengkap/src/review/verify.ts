import {
  ProjectStore,
  StoryboardProject,
  createRenderSession,
  renderFramePNG,
  renderFrameSheet,
  type Layer,
} from "codeboard-studio";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { output } from "../config.ts";
const root = output,
  review = join(root, "review"),
  file = join(root, "lengkap.cboard");
await mkdir(review, { recursive: true });
const sourceBytes = await readFile(file);
const experiment = await mkdtemp(join(review, "revision-"));
const workingFile = join(experiment, "lengkap.cboard");
await copyFile(file, workingFile);
const board = await StoryboardProject.open(workingFile),
  before = board.toJSON();
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const walk = (layers: Layer[]): Layer[] =>
  layers.flatMap((l) => (l.kind === "group" ? [l, ...walk(l.children)] : [l]));
assert.equal(before.panels.length, 6);
assert.equal(before.scenes.length, 6);
const brushUsage: Record<string, number> = {};
for (const panel of before.panels)
  for (const layer of walk(panel.layers))
    if (layer.kind !== "group") {
      for (const element of layer.elements)
        if (element.kind === "raster-stroke")
          brushUsage[element.brush.id] = (brushUsage[element.brush.id] ?? 0) + 1;
    }
for (const id of [
  "brush:dry-ink",
  "brush:soft-pastel",
  "brush:charcoal-mass",
  "brush:pen",
  "brush:graphite-pencil",
  "brush:rough-ink",
  "brush:stamp-ink",
])
  assert.ok(brushUsage[id], `Unused material: ${id}`);
const detailLayers = before.panels.map((panel) =>
  walk(panel.layers)
    .filter((l) => l.name.startsWith("Detail /"))
    .map((l) => l.name),
);
assert.ok(
  detailLayers.every((layers) => layers.length > 0),
  "Every scene needs authored illustration details",
);
assert.deepEqual(
  before.panels.map((p) => [p.startFrame, p.durationFrames]),
  [
    [0, 60],
    [60, 60],
    [120, 60],
    [180, 60],
    [240, 60],
    [300, 60],
  ],
);
const session = createRenderSession(board);
assert.equal(session.durationFrames, 360);
const held = hash(await renderFramePNG(board, 311));
assert.equal(hash(await renderFramePNG(board, 359)), held);
const stamp = walk(before.panels[2]!.layers).find(
  (l) => l.name === "Cap / appears only at contact",
)!;
assert.deepEqual(stamp.exposure, { startFrame: 134, endFrame: 180 });
const reds = (frame: number) => {
  const canvas = session.frame(frame),
    ctx = canvas.getContext("2d");
  try {
    const data = ctx.getImageData(0, 0, 1920, 1080).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i]! > data[i + 1]! * 1.5 && data[i]! > 100 && data[i + 1]! < 130) n++;
    return n;
  } finally {
    ctx.reset();
  }
};
assert.equal(reds(133), 0);
assert.ok(reds(134) > 0);
assert.ok(reds(160) > reds(134));
const times = [
  0, 5, 14, 27, 40, 59, 61, 76, 92, 109, 115, 119, 120, 129, 133, 134, 139, 146, 152, 170, 180, 194,
  203, 239, 240, 250, 260, 267, 273, 299, 300, 304, 308, 311, 335, 359,
];
await writeFile(
  join(review, "timing-contact.png"),
  await renderFrameSheet(board, times, { columns: 6, thumbnailWidth: 320 }),
);
// Bound rendering to one frame at a time; large brush surfaces otherwise compete for GPU resources.
const hashes: string[] = [];
for (const panel of before.panels)
  hashes.push(hash(await renderFramePNG(board, panel.startFrame + 59)));
const suffix = hash(Buffer.from(hashes.join(""))).slice(0, 12),
  baseName = `lengkap-final-${suffix}`,
  variantName = `shorter-red-link-${suffix}`;
const store = ProjectStore.open(workingFile);
try {
  store.verify();
  if (!store.listRevisions().some((r) => r.name === baseName))
    store.saveRevision(baseName, { expectedVersion: board.version });
} finally {
  store.close();
}
const target = walk(before.panels[4]!.layers).find(
  (l) => l.name === "Red / interrupted connection",
)!;
assert.notEqual(target.kind, "group");
if (target.kind === "group") throw new Error("Expected drawing");
board.transaction("Revision proof / shorten outgoing red line by 36 design pixels", () => {
  for (const element of target.elements.filter(
    (e) => e.kind === "raster-stroke" && e.points[0]!.x < 600,
  ))
    board
      .panel("panel:5")
      .layer(target.id)
      .edit(element.id, (e) => {
        assert.equal(e.kind, "raster-stroke");
        if (e.kind !== "raster-stroke") throw new Error("Expected stroke");
        return {
          ...e,
          points: e.points.map((p) => ({
            ...p,
            x: p.x - 36 * Math.max(0, (p.x - 414) / (535 - 414)),
          })),
        };
      });
});
const revised = board.toJSON();
const afterHashes: string[] = [];
for (const panel of revised.panels)
  afterHashes.push(hash(await renderFramePNG(board, panel.startFrame + 59)));
for (const i of [0, 1, 2, 3, 5]) {
  assert.equal(hashes[i], afterHashes[i], `Unchanged scene ${i + 1} render differs`);
  assert.deepEqual(before.panels[i], revised.panels[i]);
}
assert.notEqual(hashes[4], afterHashes[4]);
assert.equal(createRenderSession(board).durationFrames, 360);
await board.save(workingFile);
const history = ProjectStore.open(workingFile);
try {
  if (!history.listRevisions().some((r) => r.name === variantName))
    history.saveRevision(variantName, { expectedVersion: board.version });
} finally {
  history.close();
}
board.undo();
assert.equal(hash(await renderFramePNG(board, 299)), hashes[4]);
await board.save(workingFile);
const reopened = await StoryboardProject.open(workingFile);
assert.equal(hash(await renderFramePNG(reopened, 299)), hashes[4]);
const proof = {
  durationFrames: 360,
  frameRate: 24,
  seconds: 15,
  dimensions: [1920, 1080],
  brushUsage,
  detailLayers,
  stampContactFrame: 134,
  redPixelsBeforeContact: 0,
  closingStableFromFrame: 311,
  revision: {
    baseName,
    namedVariant: variantName,
    change: "Scene 05 outgoing red stroke shortened by 36 design pixels",
    changedScene: 5,
    unaffectedScenes: [1, 2, 3, 4, 6],
    beforeHashes: hashes,
    afterHashes,
    undoRestored: true,
    reopenedMatches: true,
    activeVersion: "Source untouched; alternative retained in experiment copy",
    experiment: workingFile,
  },
};
assert.deepEqual(await readFile(file), sourceBytes, "Verification changed its source project");
await writeFile(join(review, "verification.json"), JSON.stringify(proof, null, 2));
console.log("Timing, contact, final hold, storage, isolated revision and undo/reopen verified.");
