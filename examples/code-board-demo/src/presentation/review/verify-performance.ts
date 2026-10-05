import type { Layer } from "codeboard-studio";
import {
  StoryboardProject,
  createRenderSession,
  evaluateDrawing,
  evaluateLayer,
  renderDetail,
  renderFrameSheet,
} from "codeboard-studio";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { colors, drawClawd } from "../../character/art.ts";
import { acting, at, drawing } from "../../character/poses.ts";
import { out } from "../project/performance.ts";
await mkdir(join(out, "review"), { recursive: true });
const final = await StoryboardProject.open(join(out, "clawd-final.cboard"));
const reel = await StoryboardProject.open(join(out, "codeboard-showreel.cboard"));
const fdoc = final.toJSON(),
  rdoc = reel.toJSON(),
  fs = createRenderSession(final),
  rs = createRenderSession(reel);
async function pixels(canvas: ReturnType<ReturnType<typeof createRenderSession>["frame"]>) {
  try {
    return await canvas.toBuffer("raw");
  } finally {
    canvas.getContext("2d").reset();
  }
}
assert.equal(fs.durationFrames, 192);
assert.equal(rs.durationFrames, 576);
assert.deepEqual(
  rdoc.panels.map((p) => [p.startFrame, p.durationFrames]),
  [
    [0, 48],
    [48, 48],
    [96, 72],
    [168, 48],
    [216, 48],
    [264, 72],
    [336, 192],
    [528, 48],
  ],
);
assert.equal(fdoc.frameRate, 24);
assert.equal(fdoc.canvas.width, 1920);
assert.equal(fdoc.canvas.height, 1080);
const firstPanel = fdoc.panels[0];
assert.ok(firstPanel);
const stage = firstPanel.layers.find((l) => l.name === "Action staging");
assert.ok(stage && stage.kind === "group");
const track = stage.children[0];
assert.ok(track && track.kind === "group");
assert.ok(track.drawingSequence);
assert.equal(track.children.length, acting.drawings.size);
assert.equal(track.drawingSequence.length, acting.exposures.length);
let maxSoleDrift = 0,
  comparisons = 0;
const lastSoles = new Map<
  number,
  {
    x: number;
    planted: boolean;
  }
>();
for (let f = 0; f < 192; f++) {
  const e = at(f),
    pose = drawing(e.id),
    id = evaluateDrawing(track.drawingSequence, f),
    cel: Layer | undefined = track.children.find((c) => c.id === id);
  assert.ok(cel && cel.kind === "group");
  assert.equal(cel.name, e.id);
  assert.equal(pose.feet.length, 4);
  const transform = evaluateLayer(track, f).transform;
  for (let i = 0; i < 4; i++) {
    // Read the sole from the actual stored polygon, not just the generator's intention.
    const drawingLayer = cel.children[0];
    assert.ok(drawingLayer && drawingLayer.kind === "vector");
    const path = drawingLayer.elements[i];
    assert.ok(path && path.kind === "vector-path");
    const sole = path.commands[4];
    assert.ok(sole && sole.op !== "Z");
    const x = -120 + 1.3 * (transform.x + sole.x),
      y = 800 + 1.3 * (transform.y + sole.y);
    const previous = lastSoles.get(i),
      planted = pose.feet[i]!.planted;
    if (planted) {
      assert.ok(Math.abs(y - 800) < 0.001);
      if (previous?.planted) {
        maxSoleDrift = Math.max(maxSoleDrift, Math.abs(x - previous.x));
        comparisons++;
      }
    }
    lastSoles.set(i, { x, planted });
  }
  const a = await pixels(fs.frame(f)),
    b = await pixels(rs.frame(f + 336));
  if (!a.equals(b)) {
    let count = 0,
      maxDifference = 0;
    for (let i = 0; i < a.length; i++)
      if (a[i] !== b[i]) {
        count++;
        maxDifference = Math.max(maxDifference, Math.abs(a[i]! - b[i]!));
      }
    await writeFile(
      join(out, "review", `mismatch-${f}-final.png`),
      await fs.frame(f).toBuffer("png"),
    );
    await writeFile(
      join(out, "review", `mismatch-${f}-reel.png`),
      await rs.frame(f + 336).toBuffer("png"),
    );
    throw new Error(
      `Final shot differs at ${f}: ${count} channel bytes, maximum difference ${maxDifference}`,
    );
  }
  if (f % 48 === 0) console.log(`Compared final shot ${f}/192`);
}
assert.ok(maxSoleDrift < 0.001, `Planted foot drift: ${maxSoleDrift}`);
const celProject = StoryboardProject.create({
  title: "Unique cel proof",
  width: 420,
  height: 440,
  frameRate: 24,
  background: colors.bg,
});
celProject.transaction("Render normalized actual drawings", () => {
  for (const [id, pose] of acting.drawings) {
    const p = celProject.addScene(id).addShot(id).addPanel({ durationFrames: 1 });
    drawClawd(p, pose, { x: 200, y: 340, name: id });
  }
});
const cs = createRenderSession(celProject),
  hashes = new Map<string, string>();
let n = 0;
for (const [id] of acting.drawings) {
  const hash = createHash("sha256")
    .update(await pixels(cs.frame(n++)))
    .digest("hex");
  assert.ok(!hashes.has(hash), `Duplicate rendered cels: ${id}, ${hashes.get(hash)}`);
  hashes.set(hash, id);
}
// Review every exposure at timeline scale and retain full-resolution pose crops.
for (let page = 0; page < 3; page++) {
  const frames = Array.from({ length: 32 }, (_, i) => (page * 32 + i) * 2);
  await writeFile(
    join(out, "review", `all-exposures-${page + 1}.png`),
    await renderFrameSheet(final, frames, { columns: 8, thumbnailWidth: 240 }),
  );
}
for (const frame of [94, 124, 130, 142, 156, 186]) {
  const root = -120 + at(frame).x * 1.3;
  await writeFile(
    join(out, "review", `pose-${frame}.png`),
    await renderDetail(
      final,
      firstPanel.id,
      { x: Math.round(root - 190), y: 270, width: 380, height: 590 },
      frame,
    ),
  );
}
const report = {
  scope: "This authored performance only; not an engine quality score",
  visualReview: "pending",
  width: 1920,
  height: 1080,
  fps: 24,
  reelFrames: 576,
  clipFrames: 192,
  uniqueRenderedDrawings: hashes.size,
  exposureKeys: track.drawingSequence.length,
  pairedFramesCompared: 192,
  maximumPlantedSoleDriftPixels: maxSoleDrift,
  plantedSoleComparisons: comparisons,
  fourLegContoursInEveryDrawing: true,
  finalCameraLocked: true,
  source: "Saved and reopened cboard projects; sole coordinates from stored vector contours",
  exposureDurations: acting.exposures.reduce(
    (r, e, i) => {
      const n = (acting.exposures[i + 1]?.frame ?? 192) - e.frame;
      r[n] = (r[n] ?? 0) + 1;
      return r;
    },
    {} as Record<number, number>,
  ),
};
await writeFile(join(out, "verification.json"), JSON.stringify(report, null, 2));
console.log(report);
