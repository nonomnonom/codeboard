import type { CurveMeshInput } from "codeboard-studio";
import { make, rect, blue, amber } from "../../../shared.ts";

export function author() {
  const project = make("Deformation under magnification", 360, 320);
  const panel = project.addScene("Study").addShot("Ribbon").addPanel({ durationFrames: 24 });
  const parent = panel.addGroup("Two-times placement", {
    transform: { x: 120, y: 40, scaleX: 2, scaleY: 2 },
  });
  const surface = panel.addGroup("Ribbon surface", {}, parent.id);
  const mask = panel.addVectorLayer("Ribbon mask", { visible: false }, surface.id);
  rect(mask, -12, 0, 20, 120, "white");
  const art = panel.addVectorLayer("Paint stripes", { maskLayerId: mask.id }, surface.id);
  for (let stripe = 0; stripe < 12; stripe++)
    rect(art, -12, stripe * 10, 24, 10, stripe % 2 ? blue : amber);
  const capture = project.capturePanelAnimation(panel.id, { id: "animation:deformer-resolution" });
  const layerId = capture.identities.find((entry) => entry.sourceId === surface.id)!.capturedId;
  const rest: CurveMeshInput["rest"] = {
    width: 24,
    curve: [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 0, y: 80 },
      { x: 0, y: 120 },
    ],
  };
  const curve: CurveMeshInput = {
    rest,
    segments: 24,
    keyframes: [
      { ...rest, frame: 0, easing: "ease-in-out" },
      {
        width: 24,
        frame: 23,
        easing: "linear",
        curve: [
          { x: 0, y: 0 },
          { x: 45, y: 30 },
          { x: -35, y: 90 },
          { x: 25, y: 120 },
        ],
      },
    ],
  };
  return { project, animationId: capture.animationId, layerId, curve };
}
