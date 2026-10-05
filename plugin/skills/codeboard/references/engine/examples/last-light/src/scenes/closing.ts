import { payoff } from "../artwork/payoff.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame, duration, state }: SceneContext): void {
  const { firefly } = payoff(p, board, frame);
  if (!state.fireflyComponent)
    throw new Error("Create the firefly component before its final instance");
  const finalFly = board.production.instantiateComponent(
    state.fireflyComponent,
    p.id,
    { ...firefly, scaleX: 0.28, scaleY: 0.28 },
    { id: "instance:final-firefly" },
  );
  const wings = board.production.find({ panelId: p.id, name: "Etched brass wings" })[0]!;
  for (let f = 0; f < duration; f += 3)
    board.production.addLayerKeyframe(wings.id, frame + f, {
      transform: { scaleY: f % 6 === 0 ? 1 : 0.16 },
      easing: "hold",
    });
  for (const [offset, dx, dy] of [
    [0, 0, 0],
    [18, 4, -3],
    [36, 11, -5],
    [54, 8, -2],
    [71, 14, -4],
  ])
    board.production.addLayerKeyframe(finalFly, frame + offset!, {
      transform: { x: firefly.x + dx!, y: firefly.y + dy! },
      easing: "ease-in-out",
    });
  const head = board.production.find({ panelId: p.id, name: "Keeper / head and gaze" })[0]!;
  for (const [offset, angle] of [
    [0, 0],
    [12, 0],
    [18, -0.045],
    [24, -0.13],
    [30, -0.18],
    [71, -0.18],
  ])
    board.production.addLayerKeyframe(head.id, frame + offset!, {
      transform: { rotation: angle! },
      easing: "ease-in-out",
    });
}
