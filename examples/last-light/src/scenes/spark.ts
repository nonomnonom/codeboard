import { hands } from "../artwork/art.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame }: SceneContext): void {
  const { transfer, dormant, ignition, sparks } = hands(p, "spark", frame);
  for (const [offset, opacity] of [
    [0, 0],
    [8, 1],
    [23, 1],
    [35, 0],
  ])
    board.production.addLayerKeyframe(transfer!.id, frame + offset!, {
      opacity: opacity!,
      easing: "ease-in-out",
    });
  board.production.addLayerKeyframe(ignition!.id, frame, { opacity: 0, easing: "hold" });
  board.production.addLayerKeyframe(ignition!.id, frame + 8, { opacity: 1, easing: "hold" });
  for (const [offset, scale, opacity] of [
    [0, 0.2, 0],
    [7, 0.2, 0],
    [8, 0.2, 1],
    [12, 0.65, 0.9],
    [18, 1, 0.35],
    [24, 1.3, 0],
  ])
    board.production.addLayerKeyframe(sparks!.id, frame + offset!, {
      transform: { x: 609 * (1 - scale!), y: 339 * (1 - scale!), scaleX: scale!, scaleY: scale! },
      opacity: opacity!,
      easing: offset === 7 ? "hold" : "linear",
    });
  board.production.addLayerKeyframe(dormant!.id, frame, { opacity: 1, easing: "hold" });
  board.production.addLayerKeyframe(dormant!.id, frame + 8, { opacity: 0, easing: "hold" });
}
