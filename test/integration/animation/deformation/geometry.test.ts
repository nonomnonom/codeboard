import { expect, it } from "vitest";
import {
  bakeCurveMesh,
  bakeEnvelopeMesh,
  createCurveMeshEvaluator,
  createSkinMeshEvaluator,
  type EnvelopeMeshPose,
} from "../../../../src/index.js";
import { createMeshAnimationEvaluator } from "../../../../src/animation/mesh-animation.js";
import { line, ribbon, envelope, source, triangles } from "./fixture.js";

it("evaluates curve controls before normals, preserving ribbon width between rotated poses", () => {
  const input = {
    rest: ribbon,
    segments: 2,
    keyframes: [
      { ...ribbon, frame: 0, easing: "linear" as const },
      { width: 8, curve: line(0, 0, 30, 0), frame: 20, easing: "linear" as const },
    ],
  };
  const evaluate = createCurveMeshEvaluator(input);
  const midpoint = evaluate(10);
  for (let index = 0; index < midpoint.destination.length; index += 2) {
    const a = midpoint.destination[index]!,
      b = midpoint.destination[index + 1]!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(8);
    expect((a.x + b.x) / 2).toBeCloseTo(index * 3.75);
    expect((a.y + b.y) / 2).toBeCloseTo(index * 3.75);
  }
  const baked = createMeshAnimationEvaluator(bakeCurveMesh(input))(10);
  expect(
    Math.hypot(
      baked.destination[0]!.x - baked.destination[1]!.x,
      baked.destination[0]!.y - baked.destination[1]!.y,
    ),
  ).toBeCloseTo(Math.sqrt(32));
  input.keyframes[1]!.width = 200;
  Reflect.set(midpoint.destination[0]!, "x", 900);
  for (const frame of [20, 3, 10, 0, 3]) {
    const pose = evaluate(frame);
    expect(
      Math.hypot(
        pose.destination[0]!.x - pose.destination[1]!.x,
        pose.destination[0]!.y - pose.destination[1]!.y,
      ),
    ).toBeCloseTo(8);
  }
});

it("samples envelope boundaries and interior Coons blending with explicit corner rejection", () => {
  const pose: EnvelopeMeshPose = {
    ...envelope,
    top: [
      { x: -4, y: 0 },
      { x: -4 / 3, y: -8 },
      { x: 4 / 3, y: -8 },
      { x: 4, y: 0 },
    ],
  };
  const mesh = bakeEnvelopeMesh({
    rest: envelope,
    columns: 2,
    rows: 2,
    keyframes: [
      { frame: 0, pose: envelope, easing: "linear" },
      { frame: 20, pose, easing: "linear" },
    ],
  });
  const evaluate = createMeshAnimationEvaluator(mesh);
  expect(evaluate(20).destination[1]!.x).toBeCloseTo(0);
  expect(evaluate(20).destination[1]!.y).toBeCloseTo(-6);
  expect(evaluate(20).destination[4]!.x).toBeCloseTo(0);
  expect(evaluate(20).destination[4]!.y).toBeCloseTo(12);
  expect(evaluate(10).destination[4]!.y).toBeCloseTo(13.5);
  expect(() =>
    bakeEnvelopeMesh({ rest: { ...envelope, top: line(-3, 0, 8, 0) }, keyframes: [] }),
  ).toThrow(
    expect.objectContaining({ details: expect.objectContaining({ reason: "ENVELOPE_CORNERS" }) }),
  );
});

it("uses inverse bind matrices and normalized explicit weights without silently repairing bad bindings", () => {
  const skin = {
    source,
    triangles,
    joints: [
      { id: "a", bind: [1, 0, 0, 1, 10, 0] as const },
      { id: "b", bind: [1, 0, 0, 1, 0, 20] as const },
    ],
    weights: source.map(() => [
      { jointId: "a", weight: 0.25 },
      { jointId: "b", weight: 0.75 },
    ]),
  };
  const evaluate = createSkinMeshEvaluator(skin);
  const output = evaluate([
    { jointId: "a", matrix: [1, 0, 0, 1, 18, 0] },
    { jointId: "b", matrix: [1, 0, 0, 1, 0, 24] },
  ]);
  expect(output.destination).toEqual(source.map(({ x, y }) => ({ x: x + 2, y: y + 3 })));
  expect(() => evaluate([{ jointId: "a", matrix: [1, 0, 0, 1, 18, 0] }])).toThrow(
    expect.objectContaining({
      details: expect.objectContaining({ reason: "SKIN_POSE_INCOMPLETE" }),
    }),
  );
  skin.weights[0]![0]!.weight = 0.5;
  expect(() => createSkinMeshEvaluator(skin)).toThrow(
    expect.objectContaining({ details: expect.objectContaining({ reason: "SKIN_WEIGHT_SUM" }) }),
  );
});
