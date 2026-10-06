import { StoryboardProject, type Scene3D, type Scene3DElement } from "../../../src/index.js";
import type { Canvas } from "skia-canvas";

export function scene(): Scene3D {
  return {
    width: 128,
    height: 128,
    camera: { kind: "orthographic", height: 4, position: [0, 0, 5], target: [0, 0, 0] },
    nodes: [
      {
        id: "box",
        kind: "mesh",
        geometry: "box",
        material: { kind: "basic", color: "#ff0000" },
        keyframes: [
          { frame: 0, position: [-1, 0, 0], easing: "linear" },
          { frame: 10, position: [1, 0, 0], easing: "linear" },
        ],
      },
    ],
  };
}

export function setup(spec = scene(), prefixFrames = 0) {
  const project = StoryboardProject.create({
    title: "3D motion",
    width: 128,
    height: 128,
    background: "#ffffff",
    frameRate: 24,
  });
  const shot = project.addScene("Scene").addShot("Shot");
  if (prefixFrames) shot.addPanel({ durationFrames: prefixFrames });
  const panel = shot.addPanel({ durationFrames: 11 });
  const layer = panel.addVectorLayer("3D");
  const id = layer.scene3D(spec);
  return { project, panel, layer, id };
}

export function element(project: StoryboardProject, panelIndex = 0): Scene3DElement {
  const layer = project.toJSON().panels[panelIndex]!.layers[0]!;
  if (layer.kind === "group" || layer.elements[0]?.kind !== "scene-3d")
    throw new Error("Missing 3D scene");
  return layer.elements[0];
}

export function pixels(canvas: Canvas): Uint8ClampedArray {
  const result = canvas.getContext("2d").getImageData(0, 0, 128, 128).data;
  canvas.getContext("2d").reset();
  return result;
}

export function redBounds(data: Uint8ClampedArray) {
  let left = 128,
    right = -1,
    count = 0;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4;
      if (data[i]! > 240 && data[i + 1]! < 15 && data[i + 2]! < 15 && data[i + 3]! > 240) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        count++;
      }
    }
  return { left, right, count, center: (left + right + 1) / 2 };
}
