import type { StoryboardProject } from "codeboard-studio";
import { type Art, emptyMotor, person, warehouse } from "../artwork/art.ts";
export function draw(a: Art, _board: StoryboardProject): void {
  warehouse(a);
  const figure = person(a, 125, 296, 1.72, "stand");
  a.move(figure.head, [
    [0, 0, 0],
    [12, 0, 0],
    [22, 5, 1, 0.075],
    [59, 5, 1, 0.075],
  ]);
  for (const x of [458, 726, 1074]) emptyMotor(a, x, 510, 1.45);
}
