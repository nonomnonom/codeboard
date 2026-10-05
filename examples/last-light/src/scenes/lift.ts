import { hands, insect } from "../artwork/art.ts";
import { flightWingCycle } from "../artwork/wings.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame, duration, state }: SceneContext): void {
  hands(p, "lift");
  const bug = insect(p, 609, 340, 0.85, true, true);
  board.production.addLayerKeyframe(bug.group.id, frame, { transform: { x: 609, y: 340 } });
  board.production.addLayerKeyframe(bug.group.id, frame + 9, {
    transform: { x: 608, y: 347 },
    easing: "ease-in-out",
  });
  board.production.addLayerKeyframe(bug.group.id, frame + 22, {
    transform: { x: 659, y: 283 },
    easing: "ease-in-out",
  });
  board.production.addLayerKeyframe(bug.group.id, frame + duration - 1, {
    transform: { x: 783, y: 125 },
    easing: "ease-in-out",
  });
  state.fireflyComponent = board.production.captureComponent(
    bug.group.id,
    "Mechanical firefly / open wings",
    { id: "component:firefly" },
  );
  flightWingCycle(p, board, bug.group.id, bug.wings.id, frame, duration);
}
