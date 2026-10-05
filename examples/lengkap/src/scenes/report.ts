import type { StoryboardProject } from "codeboard-studio";
import { type Art, document, motor } from "../artwork/art.ts";
export function draw(a: Art, _board: StoryboardProject): void {
  const page = a.group("Report / close-up angle", 38, 85);
  page.set({ transform: { x: 38, y: 85, scaleX: 1, scaleY: 1, rotation: -0.13 } });
  document(a, 0, -63, 1160, 853, undefined, page.id);
  for (let j = 0; j < 6; j++)
    motor(
      a,
      233 + (j % 3) * 321,
      316 + Math.floor(j / 3) * 243,
      1.5,
      [1, 9, 17, 25, 33, 41][j]!,
      j === 5 ? 15 : 9,
      page.id,
    );
}
