import { relay } from "../artwork/relay.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame }: SceneContext): void {
  relay(p, board, frame);
}
