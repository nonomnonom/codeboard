import { colors, ground, line, poly } from "../../character/art.ts";
import { acting, at } from "../../character/poses.ts";
import { box, focusCel, header, mono, still } from "../artwork/layout.ts";
import { inkAction } from "../artwork/studies.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: b, panel: p, start, end, ordinal }: SceneContext): void {
  header(p, ordinal + 1, "Hold the thought. Then push.");
  mono(p, "PREVIEW / 0.25x", 110, 305, 26, colors.muted);
  mono(p, "TIMELINE / LOCAL FRAMES", 813, 305, 26, colors.orange);
  ground(p, 118, 701, 850);
  focusCel(
    b,
    p,
    Array.from({ length: 12 }, (_, i) => 122 + i * 2),
    start,
    8,
    { x: 413, y: 850, scale: 1.45 },
  );
  mono(p, "API / setDrawingSequence", 116, 919, 25, colors.paper);
  mono(p, "Hold A124. Build the push.", 116, 967, 24, colors.muted);
  inkAction(
    b,
    p,
    [
      [893, 524],
      [893, 534],
      [1056, 534],
      [1056, 524],
    ],
    start + 8,
    start + 28,
    { pen: false, width: 3 },
  );
  const tx = 812,
    tw = 982,
    px = (f: number) => tx + ((f - 122) / 24) * tw;
  const ruler = p.addVectorLayer("Actual source-frame ruler");
  line(
    ruler,
    [
      [tx, 381],
      [tx + tw, 381],
    ],
    colors.muted,
    1,
  );
  for (let f = 122; f <= 146; f += 2) {
    line(
      ruler,
      [
        [px(f), 371],
        [px(f), 389],
      ],
      colors.muted,
      1,
    );
    if (f % 4 === 2) mono(p, String(f), px(f), 356, 24, colors.paper, undefined, "center");
  }
  mono(p, "CEL", tx, 427, 24, colors.muted);
  mono(p, "ROOT Y", tx, 582, 24, colors.muted);
  mono(p, "SOUND", tx, 714, 24, colors.muted);
  const entries = acting.exposures.filter((e) => e.frame >= 122 && e.frame < 146);
  for (const [i, e] of entries.entries()) {
    const next = Math.min(146, entries[i + 1]?.frame ?? 146),
      x = px(e.frame),
      w = px(next) - x;
    box(p, x, 447, w - 2, 65, undefined, "#211e17");
    mono(p, e.id, x + w / 2, 487, 20, colors.paper, undefined, "center");
  }
  const curve = p.addVectorLayer("Root height samples");
  line(
    curve,
    Array.from({ length: 13 }, (_, i) => {
      const f = 122 + i * 2;
      return [px(f), 665 + at(f).y * 0.32];
    }),
    colors.paper,
    2.5,
  );
  const sfx = p.addVectorLayer("Push sound event");
  line(
    sfx,
    [
      [px(128), 739],
      [px(128), 777],
    ],
    colors.orange,
    4,
  );
  mono(p, "push", px(128) + 15, 766, 23, colors.paper);
  const playhead = p.addGroup("Timeline playhead"),
    playInk = p.addVectorLayer("Playhead", {}, playhead.id);
  line(
    playInk,
    [
      [tx, 373],
      [tx, 794],
    ],
    colors.orange,
    2.6,
  );
  poly(
    playInk,
    [
      [tx - 7, 367],
      [tx + 7, 367],
      [tx, 380],
    ],
    colors.orange,
  );
  b.production.addLayerKeyframe(playhead.id, start, { transform: { x: 0 }, easing: "linear" });
  b.production.addLayerKeyframe(playhead.id, end - 1, { transform: { x: tw }, easing: "hold" });
  for (let i = 0; i < 6; i++) {
    const f = 124 + i * 4,
      x = 893 + i * 163;
    ground(p, x - 68, x + 68, 957);
    still(p, f, x, 957, 0.43);
    mono(p, `f${f}`, x, 1003, 21, colors.muted, undefined, "center");
  }
}
