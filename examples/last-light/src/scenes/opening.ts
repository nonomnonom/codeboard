import { opening } from "../artwork/opening.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame, duration }: SceneContext): void {
  opening(p, board, frame, duration);
}
