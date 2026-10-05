import { closeupPerformance } from "../artwork/acting.ts";
import { contour } from "../artwork/art.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame, duration, index: i }: SceneContext): void {
  const l = p.addVectorLayer("Close-up background");
  contour(l, "M 0 0 L 1280 0 L 1280 720 L 0 720 Z", i === 9 ? "#10191d" : "#35464a");
  closeupPerformance(p, board, frame, duration, i === 9);
  if (i === 9) {
    const veil = p.addVectorLayer("Afterlight", { opacity: 0.4 });
    contour(veil, "M 0 0 L 1280 0 L 1280 720 L 0 720 Z", "#111c22");
  }
}
