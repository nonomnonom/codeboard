import { sequence } from "../artwork/performance.ts";
import { finalStage } from "../artwork/stage.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: b, panel: p, start }: SceneContext): void {
  finalStage(p, start);
  sequence(b, p, start, 0, 192, { x: -120, y: 800, scaleX: 1.3, scaleY: 1.3 });
}
