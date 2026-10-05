import { hands } from "../artwork/art.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame }: SceneContext): void {
  const { repairHand, repairGear } = hands(p, "repair");
  for (const [offset, x, y, rotation] of [
    [0, 26, -14, -0.065],
    [18, 0, 0, -0.065],
    [25, 0, 0, -0.065],
    [39, 0, 0, 0.045],
    [47, 0, 0, 0.045],
    [56, 10, -6, 0.025],
    [71, 32, -22, 0],
  ])
    board.production.addLayerKeyframe(repairHand!.id, frame + offset!, {
      transform: { x: 609 + x!, y: 344.2 + y!, rotation: rotation! },
      easing: "ease-in-out",
    });
  for (const [offset, rotation] of [
    [0, 0],
    [25, 0],
    [39, 0.8],
    [71, 0.8],
  ])
    board.production.addLayerKeyframe(repairGear!.id, frame + offset!, {
      transform: { rotation: rotation! },
      easing: "ease-in-out",
    });
}
