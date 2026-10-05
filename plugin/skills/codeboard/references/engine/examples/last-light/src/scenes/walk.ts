import { city } from "../artwork/art.ts";
import { walkingPerformance } from "../artwork/walk.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame, duration }: SceneContext): void {
  city(p);
  walkingPerformance(p, board, frame, duration, 230, 36, 1.08);
}
