import { flight } from "../artwork/flight.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame, duration }: SceneContext): void {
  flight(p, board, frame, duration);
}
