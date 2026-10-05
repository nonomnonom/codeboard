import { colors, inkLine, text } from "../../character/art.ts";
import { sequence } from "../project/performance.ts";
import { group } from "../artwork/layout.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: b, panel: p, start }: SceneContext): void {
  text(p, "Codeboard", 295, 514, 140);
  text(p, "Animate your idea with code.", 311, 648, 45);
  inkLine(
    p,
    undefined,
    [
      [310, 565],
      [790, 552],
      [1184, 560],
    ],
    colors.orange,
    9,
  );
  const endAction = sequence(b, p, start, 120, 72, { x: 400, y: 560, scaleX: 1, scaleY: 1 });
  for (const [a, z, dip] of [
    [0, 32, 0],
    [32, 34, 4],
    [34, 36, 13],
    [36, 38, 18],
    [38, 40, 10],
    [40, 42, 3],
    [42, 44, -5],
    [44, 48, -2],
    [48, 72, 0],
  ] as const) {
    b.production.addLayerKeyframe(endAction.stage.id, start + a, {
      transform: { y: 560 + dip },
      easing: "hold",
    });
    const g = group(p, "Wordmark underline / landing response", start + a, start + z);
    inkLine(
      p,
      g.id,
      [
        [1184, 560],
        [1450, 559],
        [1624, 560 + dip],
        [1766, 556],
      ],
      colors.orange,
      5,
      91,
    );
  }
}
