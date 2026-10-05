import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  StoryboardProject,
  reviseShotAnimation,
  renderShotFramePNG,
  createShotRenderSession,
  shotPointCoordinates,
  captureShotController,
  compileControllerTransfer,
  type ShotAnimation,
  type ShotController,
} from "../src/index.js";

function fixture(name = "source") {
  const project = StoryboardProject.create({ title: name, width: 80, height: 40 });
  const panel = project.addScene("S").addShot("S").addPanel({ durationFrames: 24 });
  const group = panel.addGroup("Character", { transform: { y: 12 } });
  panel
    .addVectorLayer("Face", {}, group.id)
    .path(
      [
        { op: "M", x: 0, y: 0 },
        { op: "L", x: 8, y: 0 },
        { op: "L", x: 8, y: 8 },
        { op: "L", x: 0, y: 8 },
        { op: "Z" },
      ],
      { fill: "#397783" },
    );
  project.production.addLayerKeyframe(group.id, 0, { transform: { x: 8 }, easing: "linear" });
  project.production.addLayerKeyframe(group.id, 16, { transform: { x: 24 } });
  const capture = project.capturePanelAnimation(panel.id, { id: `animation:${name}` });
  const animation = project.shotAnimation(capture.animationId);
  const layerId = animation.layers[0]!.id;
  const controllers: ShotController[] = [
    {
      id: "controller:replace",
      name: "Reach",
      mode: "replace",
      weight: 0.5,
      targets: [{ layerId, values: { x: 40 } }],
      keyframes: [],
    },
    {
      id: "controller:add",
      name: "Expression",
      mode: "additive",
      weight: 0,
      activeRange: { startFrame: 4, endFrame: 12 },
      targets: [{ layerId, values: { x: 12 } }],
      keyframes: [
        { frame: 0, weight: 0, easing: "linear" },
        { frame: 16, weight: 1, easing: "linear" },
      ],
    },
  ];
  return { project, animation, layerId, controllers };
}
function position(animation: ShotAnimation, layerId: string, frame: number) {
  return shotPointCoordinates(
    animation,
    layerId,
    { x: 0, y: 0 },
    { direction: "localToFrame", frame, camera: false },
  ).candidates[0]!.point;
}

it("composes named controllers in order without baking over base keys or extending active ranges", async () => {
  const { animation, layerId, controllers } = fixture();
  const before = structuredClone(animation);
  const controlled = reviseShotAnimation(
    animation,
    controllers.map((controller) => ({ op: "controller.put", controller })),
  );
  expect(animation).toEqual(before);
  expect(controlled.layers).toEqual(before.layers);
  for (const [frame, x] of [
    [0, 24],
    [3, 25.5],
    [8, 34],
    [12, 30],
    [16, 32],
  ] as const)
    expect(position(controlled, layerId, frame).x).toBeCloseTo(x);
  const reference = structuredClone(animation);
  reference.layers[0]!.keyframes = [];
  reference.layers[0]!.transform.x = 34;
  expect(await renderShotFramePNG(controlled, 8)).toEqual(await renderShotFramePNG(reference, 8));
  const moved = reviseShotAnimation(controlled, [
    { op: "controller.move", id: "controller:add", beforeId: "controller:replace" },
  ]);
  expect(position(moved, layerId, 8).x).toBeCloseTo(31);
  const removed = reviseShotAnimation(controlled, [
    { op: "controller.remove", id: "controller:add" },
    { op: "controller.remove", id: "controller:replace" },
  ]);
  expect(await renderShotFramePNG(removed, 8)).toEqual(await renderShotFramePNG(animation, 8));
});

it("retains controller plans across commit/retry/reopen and isolates render sessions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-controllers-"));
  try {
    const { project, animation, controllers } = fixture();
    const file = join(directory, "shot.cboard");
    await project.save(file);
    const plan = project.plan("Character controls", [
      {
        op: "animation.edit",
        id: animation.id,
        edits: controllers.map((controller) => ({ op: "controller.put", controller })),
      },
    ]);
    const committed = await project.commit(plan, { requestId: "controllers:put" });
    const reopened = await StoryboardProject.open(file);
    expect(await reopened.commit(plan, { requestId: "controllers:put" })).toEqual({
      receipt: committed.receipt,
      replayed: true,
    });
    const source = reopened.shotAnimation(animation.id),
      original = structuredClone(source),
      session = createShotRenderSession(source);
    source.controllers![0]!.weight = 0;
    for (const frame of [23, 3, 8, 0, 12, 3])
      expect(await session.png(frame)).toEqual(await renderShotFramePNG(original, frame));
    expect(reopened.shotAnimation(animation.id).layers).toEqual(animation.layers);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("captures inactive additive poses and transfers explicit identities/ranges without changing destination keys", () => {
  const { animation, layerId, controllers } = fixture();
  const captured = captureShotController(animation, {
    id: "controller:capture",
    name: "Local delta",
    frame: 16,
    referenceFrame: 0,
    evaluation: "base",
    mode: "additive",
    targets: [{ layerId, channels: ["x"] }],
  });
  expect(captured.weight).toBe(0);
  expect(captured.targets[0]!.values.x).toBe(16);
  const source = reviseShotAnimation(
    animation,
    controllers.map((controller) => ({ op: "controller.put", controller })),
  );
  const target = fixture("recipient").animation;
  target.layers[0]!.id = "layer:recipient";
  const before = structuredClone(target);
  const options = {
    controllers: [{ sourceId: "controller:add", targetId: "controller:recipient" }],
    layers: [{ sourceId: layerId, targetId: "layer:recipient" }],
    frameOffset: 4,
    sourceRange: { startFrame: 6, endFrame: 10 },
  };
  const transferred = reviseShotAnimation(
    target,
    compileControllerTransfer(source, target, options),
  );
  expect(target).toEqual(before);
  expect(transferred.layers).toEqual(before.layers);
  expect(transferred.controllers![0]!.activeRange).toEqual({ startFrame: 10, endFrame: 14 });
  expect(position(transferred, "layer:recipient", 9).x).toBeCloseTo(17);
  expect(position(transferred, "layer:recipient", 12).x).toBeCloseTo(26);
  expect(position(transferred, "layer:recipient", 14).x).toBeCloseTo(22);
  expect(() => compileControllerTransfer(source, target, { ...options, layers: [] })).toThrow();
  expect(() => compileControllerTransfer(source, transferred, options)).toThrow();
});

it("rejects invalid batches atomically and reports invalid evaluated channels", async () => {
  const { animation, controllers } = fixture();
  const before = structuredClone(animation);
  expect(() =>
    reviseShotAnimation(animation, [
      { op: "controller.put", controller: controllers[0]! },
      { op: "controller.key.remove", id: controllers[0]!.id, frame: 99 },
    ]),
  ).toThrow();
  expect(animation).toEqual(before);
  const invalid = reviseShotAnimation(animation, [
    {
      op: "controller.put",
      controller: {
        ...controllers[0]!,
        mode: "additive",
        weight: 1,
        targets: [{ layerId: animation.layers[0]!.id, values: { opacity: 1 } }],
      },
    },
  ]);
  await expect(renderShotFramePNG(invalid, 8)).rejects.toMatchObject({
    code: "INVALID_ARGUMENT",
    details: { reason: "CONTROLLER_RESULT", channel: "opacity", frame: 8 },
  });
  expect(animation).toEqual(before);
});
