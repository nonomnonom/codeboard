import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  mergeShotAnimation,
  planShotMerge,
  renderShotFramePNG,
  createPixels,
  type ShotAnimation,
} from "../src/index.js";

function fixture() {
  const project = StoryboardProject.create({
    title: "Independent shot workers",
    width: 32,
    height: 32,
  });
  const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 24 });
  const layer = panel.addVectorLayer("Prop");
  layer.path(
    [{ op: "M", x: 4, y: 4 }, { op: "L", x: 20, y: 4 }, { op: "L", x: 20, y: 20 }, { op: "Z" }],
    { fill: "red" },
  );
  project.capturePanelAnimation(panel.id, { id: "animation:shot" });
  return { project, base: project.shotAnimation("animation:shot") };
}
function fill(animation: ShotAnimation, value: string) {
  const layer = animation.layers[0]!;
  if (layer.kind === "group" || layer.elements[0]?.kind !== "vector-path")
    throw new Error("Fixture path missing");
  layer.elements[0].fill = value;
}

it("treats competing raster bytes atomically and preserves typed pixels in merge plans", () => {
  const project = StoryboardProject.create({ title: "Pixel merge", width: 32, height: 32 });
  const panel = project.addScene("Scene").addShot("Shot").addPanel();
  panel.addRasterLayer("Paint").rasterSurface(createPixels(2, 2));
  project.capturePanelAnimation(panel.id, { id: "animation:pixels" });
  const base = project.shotAnimation("animation:pixels");
  const local = structuredClone(base),
    incoming = structuredClone(base);
  const pixels = (shot: ShotAnimation) => {
    const layer = shot.layers[0]!;
    if (layer.kind === "group" || layer.elements[0]?.kind !== "raster-surface")
      throw new Error("Fixture pixels missing");
    return layer.elements[0].pixels;
  };
  pixels(local)[0] = 127;
  pixels(incoming)[1] = 255;
  const result = mergeShotAnimation(base, local, incoming);
  expect(result.animation).toBeNull();
  expect(result.conflicts).toMatchObject([{ path: "/layers/0/elements/0/pixels" }]);
  const merged = mergeShotAnimation(base, local, incoming, {
    resolutions: { "/layers/0/elements/0/pixels": "local" },
  });
  expect(pixels(merged.animation!)).toEqual(pixels(local));
  project.putShotAnimation(local);
  incoming.layers[0]!.opacity = 0.5;
  const planned = planShotMerge(project, base, incoming, {
    resolutions: { "/layers/0/elements/0/pixels": "local" },
  });
  expect(planned.plan?.commands[0]).toMatchObject({
    op: "animation.put",
    animation: {
      layers: [
        {
          opacity: 0.5,
          elements: [{ pixelsBase64: Buffer.from(pixels(local)).toString("base64") }],
        },
      ],
    },
  });
});

it("merges independent fields while preserving local transforms, keyframes, and input snapshots", () => {
  const { base } = fixture(),
    local = structuredClone(base),
    incoming = structuredClone(base);
  local.layers[0]!.transform.x = 3;
  local.layers[0]!.keyframes.push({
    id: "key:local",
    frame: 12,
    transform: {},
    opacity: 0.5,
    easing: "linear",
  });
  fill(incoming, "blue");
  const before = structuredClone([base, local, incoming]);
  const result = mergeShotAnimation(base, local, incoming);
  expect(result.conflicts).toEqual([]);
  expect(result.animation?.layers[0]?.transform.x).toBe(3);
  expect(result.animation?.layers[0]?.keyframes).toEqual(local.layers[0]!.keyframes);
  expect(result.animation?.layers[0]).toMatchObject({ elements: [{ fill: "blue" }] });
  expect([base, local, incoming]).toEqual(before);
  expect(mergeShotAnimation(base, local, base).animation).toEqual(local);
});

it("returns no animation for conflicts and only accepts current explicit resolution paths", () => {
  const { base } = fixture(),
    local = structuredClone(base),
    incoming = structuredClone(base);
  fill(local, "green");
  fill(incoming, "blue");
  const result = mergeShotAnimation(base, local, incoming);
  const path = "/layers/0/elements/0/fill";
  expect(result.animation).toBeNull();
  expect(result.conflicts).toEqual([{ path, kind: "value", resolution: "unresolved" }]);
  expect(
    mergeShotAnimation(base, local, incoming, { resolutions: { [path]: "local" } }).animation,
  ).toEqual(local);
  expect(
    mergeShotAnimation(base, local, incoming, { resolutions: { [path]: "incoming" } }).animation,
  ).toEqual(incoming);
  expect(() =>
    mergeShotAnimation(base, local, incoming, { resolutions: { "/typo": "local" } }),
  ).toThrow(/current conflict/);
  incoming.id = "different";
  expect(() => mergeShotAnimation(base, local, incoming)).toThrow(/same animation/);
});

it("requires a whole-collection choice for changed membership/order and a whole-shot choice for retiming", () => {
  const { base } = fixture(),
    local = structuredClone(base),
    incoming = structuredClone(base);
  local.layers[0]!.opacity = 0.5;
  incoming.layers = [];
  expect(mergeShotAnimation(base, local, incoming)).toMatchObject({
    animation: null,
    conflicts: [{ path: "/layers", kind: "structure" }],
  });
  expect(
    mergeShotAnimation(base, local, incoming, { resolutions: { "/layers": "local" } }).animation,
  ).toEqual(local);
  const retimed = structuredClone(base);
  retimed.frameRate = { numerator: 30, denominator: 1 };
  expect(mergeShotAnimation(base, local, retimed)).toMatchObject({
    animation: null,
    conflicts: [{ path: "", kind: "timing" }],
  });
  expect(
    mergeShotAnimation(base, local, retimed, { resolutions: { "": "incoming" } }).animation,
  ).toEqual(retimed);
});

it("assembles two independently saved workers through durable plans and rejects stale assembly", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-shot-merge-"));
  try {
    const { project, base } = fixture();
    const published = join(directory, "base.cboard");
    await project.save(published);
    const colorWorker = await StoryboardProject.open(published);
    const layoutWorker = await StoryboardProject.open(published);
    await colorWorker.save(join(directory, "color.cboard"));
    await layoutWorker.save(join(directory, "layout.cboard"));
    const color = colorWorker.shotAnimation(base.id);
    fill(color, "blue");
    colorWorker.putShotAnimation(color);
    await colorWorker.save(join(directory, "color.cboard"));
    const layout = layoutWorker.shotAnimation(base.id);
    layout.layers[0]!.transform.x = 3;
    layoutWorker.putShotAnimation(layout);
    await layoutWorker.save(join(directory, "layout.cboard"));
    const assembled = await StoryboardProject.open(published);
    await assembled.save(join(directory, "assembled.cboard"));
    const first = planShotMerge(
      assembled,
      base,
      (await StoryboardProject.open(join(directory, "color.cboard"))).shotAnimation(base.id),
    );
    expect(first.plan).not.toBeNull();
    await assembled.commit(first.plan!, { requestId: "worker:color" });
    const second = planShotMerge(
      assembled,
      base,
      (await StoryboardProject.open(join(directory, "layout.cboard"))).shotAnimation(base.id),
    );
    expect(second.conflicts).toEqual([]);
    const stale = await StoryboardProject.open(join(directory, "assembled.cboard"));
    const stalePlan = planShotMerge(stale, base, layout).plan!;
    const committed = await assembled.commit(second.plan!, { requestId: "worker:layout" });
    const reopened = await StoryboardProject.open(join(directory, "assembled.cboard"));
    expect(await reopened.commit(second.plan!, { requestId: "worker:layout" })).toEqual({
      ...committed,
      replayed: true,
    });
    await expect(stale.commit(stalePlan, { requestId: "stale:layout" })).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
    });
    const expected = structuredClone(color);
    expected.layers[0]!.transform.x = 3;
    expect(reopened.shotAnimation(base.id)).toEqual(expected);
    expect(await renderShotFramePNG(reopened.shotAnimation(base.id), 0)).toEqual(
      await renderShotFramePNG(expected, 0),
    );
    expect((await StoryboardProject.open(published)).shotAnimation(base.id)).toEqual(base);
    expect(planShotMerge(reopened, base, layout).plan).toBeNull();
    const bad = structuredClone(color);
    fill(bad, "green");
    const before = reopened.toJSON();
    expect(planShotMerge(reopened, base, bad).plan).toBeNull();
    expect(reopened.toJSON()).toEqual(before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
