import { extinguishLantern } from "../artwork/acting.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame }: SceneContext): void {
  extinguishLantern(p, board, frame);
}
