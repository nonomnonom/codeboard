import { colors, ground } from "../../character/art.ts";
import {
  code,
  group,
  header,
  mono,
  popup,
  sourceExcerpt,
  still,
  workspace,
  wrapCode,
} from "../artwork/layout.ts";
import { inkAction } from "../artwork/studies.ts";
import type { SceneContext } from "./types.ts";
export function draw({
  project: b,
  panel: p,
  start,
  end,
  ordinal,
  poseSource,
}: SceneContext): void {
  header(p, ordinal + 1, "Movement needs weight.");
  workspace(p, "Claude Code / directed revision");
  const first = group(p, "Timing study / intentionally abrupt", start, start + 48);
  mono(p, "TIMING STUDY", 894, 389, 25, colors.muted, first.id);
  const track = p.addGroup("Sparse study exposures", {}, first.id),
    keys = [];
  for (const [i, f] of [110, 130, 140, 152, 174].entries()) {
    const cel = still(p, f, 1330, 800, 1.55, track.id);
    keys.push({ frame: start + i * 6, drawingId: cel.id });
  }
  b.production.setDrawingSequence(track.id, keys);
  ground(p, 916, 1750, 800);
  const read = group(p, "Read source", start + 4, end);
  mono(p, "Read / poses.ts", 118, 359, 23, colors.muted, read.id);
  const observation = group(p, "Visible diagnosis", start + 26, end);
  mono(p, "The landing feels abrupt.", 118, 411, 29, colors.paper, observation.id);
  mono(p, "Let the body take the weight.", 118, 464, 29, colors.paper, observation.id);
  const impact = sourceExcerpt(poseSource, "const impact =", "put(154");
  code(p, wrapCode(impact), start + 58, end, { y: 568, size: 26, step: 6 });
  code(p, wrapCode(sourceExcerpt(poseSource, "put(154", "const rebound"), 42), start + 88, end, {
    y: 722,
    size: 24,
    step: 8,
  });
  const revision = group(p, "Corrected contact drawings", start + 48, end);
  mono(p, "REDRAW THE CONTACT", 894, 389, 25, colors.orange, revision.id);
  const correction = p.addGroup("Contact revision cels", {}, revision.id),
    ck = [];
  for (const [i, f] of [152, 154, 156, 158, 162, 166, 174].entries()) {
    const cel = still(p, f, 1330, 800, 1.75, correction.id);
    ck.push({ frame: start + 48 + i * 12, drawingId: cel.id });
  }
  b.production.setDrawingSequence(correction.id, ck);
  inkAction(
    b,
    p,
    [
      [120, 635],
      [450, 635],
      [570, 611],
    ],
    start + 62,
    start + 86,
    { pen: true },
  );
  popup(
    b,
    p,
    "A decision, made visible.",
    "Contact → compression → recovery",
    start + 106,
    end,
    943,
    850,
    825,
  );
}
