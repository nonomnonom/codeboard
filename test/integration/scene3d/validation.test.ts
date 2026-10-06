import { expect, it } from "vitest";
import type { Scene3D } from "../../../src/index.js";
import { scene, setup } from "./helpers.js";

it.each([
  [
    "missing parent",
    (spec: Scene3D) => {
      spec.nodes[0]!.parentId = "missing";
    },
  ],
  [
    "duplicate node",
    (spec: Scene3D) => {
      spec.nodes.push(structuredClone(spec.nodes[0]!));
    },
  ],
  [
    "cyclic hierarchy",
    (spec: Scene3D) => {
      spec.nodes.push({ kind: "group", id: "loop", parentId: "loop" });
    },
  ],
  [
    "duplicate key",
    (spec: Scene3D) => {
      spec.nodes[0]!.keyframes![1]!.frame = 0;
    },
  ],
  [
    "negative board frame",
    (spec: Scene3D) => {
      spec.nodes[0]!.keyframes![0]!.frame = -1;
    },
  ],
  [
    "nonfinite position",
    (spec: Scene3D) => {
      spec.nodes[0]!.position = [Infinity, 0, 0];
    },
  ],
  [
    "invalid camera planes",
    (spec: Scene3D) => {
      spec.camera.near = 10;
      spec.camera.far = 1;
    },
  ],
  [
    "coincident camera target",
    (spec: Scene3D) => {
      spec.camera.position = [0, 0, 0];
    },
  ],
  [
    "oversized viewport",
    (spec: Scene3D) => {
      spec.width = 4097;
    },
  ],
  [
    "unsupported appearance",
    (spec: Scene3D) => {
      Object.assign(spec.nodes[0]!, { texture: "file:///secret" });
    },
  ],
] as const)("rejects %s without committing partial artwork", (_label, corrupt) => {
  const { project, layer } = setup();
  const before = project.toJSON();
  const spec = scene();
  corrupt(spec);
  expect(() => layer.scene3D(spec)).toThrow();
  expect(project.toJSON()).toEqual(before);
});
