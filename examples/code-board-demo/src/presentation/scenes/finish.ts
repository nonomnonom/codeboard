import assert from "node:assert/strict";
import { colors, drawClawd, ground, text } from "../../character/art.ts";
import { at, drawing } from "../../character/poses.ts";
import { group, header, mono } from "../artwork/layout.ts";
import { penNib, registration } from "../artwork/props.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: b, panel: p, start, ordinal }: SceneContext): void {
  header(p, ordinal + 1, "Choose every line.");
  const labels = ["ROUGH", "CLEAN", "DETAIL"] as const;
  for (const [i, label] of labels.entries()) {
    const section = group(p, label, start + i * 32, start + (i + 1) * 32);
    for (const [j, finish] of labels.entries()) {
      mono(
        p,
        String(j + 1).padStart(2, "0"),
        120,
        407 + j * 96,
        25,
        j === i ? colors.orange : colors.muted,
        section.id,
      );
      text(p, finish, 187, 410 + j * 96, 41, j === i ? colors.paper : colors.muted, section.id);
    }
    mono(
      p,
      ["Find the weight.", "Select the silhouette.", "Leave the ink alive."][i]!,
      120,
      792,
      28,
      colors.paper,
      section.id,
    );
    const track = p.addGroup("Same contact / selected finish", {}, section.id),
      keys = [];
    for (let j = 0; j < 12; j++) {
      const f = 152 + j * 2,
        e = at(f),
        cel = drawClawd(p, drawing(e.id), {
          x: 1260,
          y: 819,
          scale: 2.5,
          parent: track.id,
          rough: i === 0,
          detail: i === 2,
          name: e.id,
        });
      if (i === 2 && j < 8) {
        const pose = drawing(e.id),
          u = [-0.85, -0.81, -0.65, -0.6, -0.38, -0.2, 0.04, 0.65][j],
          v = [-0.79, -0.48, -0.9, -0.37, -0.84, -0.18, -0.89, -0.16][j];
        assert.ok(u !== undefined && v !== undefined, "Missing hatch coordinate");
        const nib = penNib(p, cel.id);
        b.production.addLayerKeyframe(nib.id, start + i * 32 + j * 2, {
          transform: {
            x: 1260 + 2.5 * ((u * pose.w) / 2 - pose.lean * v),
            y: 819 + 2.5 * (pose.bottom + v * pose.h),
          },
          easing: "hold",
        });
      }
      keys.push({ frame: start + i * 32 + j * 2, drawingId: cel.id });
    }
    b.production.setDrawingSequence(track.id, keys);
  }
  ground(p, 859, 1680, 819);
  registration(p, 895, 1630, 330);
  mono(p, "SAME CONTACT / SAME EXPOSURE", 1250, 948, 25, colors.muted, undefined, "center");
}
