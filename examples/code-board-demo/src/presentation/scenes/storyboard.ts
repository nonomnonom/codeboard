import assert from "node:assert/strict";
import { colors, ground, obstacle, text } from "../../character/art.ts";
import { at } from "../../character/poses.ts";
import { box, enter, header, mono, still } from "../artwork/layout.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: b, panel: p, start, end, ordinal }: SceneContext): void {
  header(p, ordinal + 1, "Give Clawd a reason to stop.");
  for (const [i, _f, title] of [
    [0, 8, "WALK"],
    [1, 94, "NOTICE"],
    [2, 124, "DECIDE TO HOP"],
  ] as const) {
    const x = 104 + i * 606,
      g = enter(b, p, `Storyboard ${title}`, start + 8 + i * 12, end);
    box(p, x, 334, 498, 465, g.id);
    ground(p, x + 30, x + 468, 716, g.id);
    const track = p.addGroup("Storyboard action", {}, g.id),
      sk = [];
    const moments = [
      [4, 8, 12],
      [88, 90, 92],
      [110, 118, 124],
    ][i];
    assert.ok(moments, "Missing storyboard moments");
    for (const [j, m] of moments.entries()) {
      const cel = p.addGroup(`Storyboard f${m}`, {}, track.id);
      still(p, m, x + 246, 716, 0.93, cel.id);
      mono(p, `action f${m} / ${at(m).id}`, x + 249, 920, 24, colors.muted, cel.id, "center");
      sk.push({ frame: start + 8 + i * 12 + j * 6, drawingId: cel.id });
    }
    b.production.setDrawingSequence(track.id, sk);
    if (i > 0) obstacle(p, x + (i === 1 ? 410 : 265), 716, g.id);
    text(p, title, x + 249, 863, 30, colors.paper, g.id, "Segoe Print", "center");
  }
}
