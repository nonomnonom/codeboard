import { hands } from "../artwork/art.ts";
import type { SceneContext } from "./types.ts";
export function draw({ panel: p }: SceneContext): void {
  hands(p, "find");
}
