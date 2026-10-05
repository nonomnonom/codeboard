import { colors, ground, obstacle, text } from "../../character/art.ts";
import { group, mono, still } from "../artwork/layout.ts";
import { inkAction } from "../artwork/studies.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: b, panel: p, start, end }: SceneContext): void {
  text(p, "Codeboard", 100, 105, 44);
  text(p, "A small line.", 100, 415, 76);
  text(p, "A big decision.", 100, 510, 76);
  const g = p.addGroup("Notice / before the leap"),
    keys = [];
  const openingOffsets = [0, 6, 12, 36, 42, 50, 60] as const;
  for (const [i, f] of [88, 90, 92, 108, 110, 118, 124].entries()) {
    const cel = still(p, f, 1320, 825, 1.8, g.id);
    keys.push({ frame: start + openingOffsets[i]!, drawingId: cel.id });
  }
  b.production.setDrawingSequence(g.id, keys);
  ground(p, 982, 1770, 825);
  obstacle(p, 1630, 825);
  inkAction(
    b,
    p,
    [
      [994, 825],
      [1400, 825],
      [1623, 825],
      [1635, 803],
    ],
    start,
    start + 24,
    { width: 3 },
  );
  const q = group(p, "Opening question", start + 28, end);
  mono(p, "How do you make a drawing feel alive?", 106, 623, 29, colors.muted, q.id);
}
