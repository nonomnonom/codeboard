import type { PanelHandle, Transform } from "codeboard-studio";
import { StoryboardProject } from "codeboard-studio";
import {
  colors,
  drawClawd,
  ground,
  inkLine,
  line,
  obstacle,
  poly,
  text,
} from "../../character/art.ts";
import { acting, at, drawing } from "../../character/poses.ts";
import type { DrawOptions } from "../../character/types.ts";
import { finalStage } from "../artwork/stage.ts";
export function project(title: string) {
  return StoryboardProject.create({
    title,
    width: 1920,
    height: 1080,
    frameRate: 24,
    background: colors.bg,
    seed: 72,
  });
}
export function panel(p: StoryboardProject, title: string, duration: number) {
  return p.addScene(title).addShot(title).addPanel({ title, durationFrames: duration });
}
export function heading(p: PanelHandle, number: string, title: string, subtitle?: string) {
  text(p, "Codeboard", 100, 110, 40);
  text(p, `${number} / ${title}`, 1820, 105, 25, colors.paper, undefined, "Segoe Print", "right");
  if (subtitle) text(p, subtitle, 100, 200, 36);
}
export function sample(
  p: PanelHandle,
  f: number,
  x: number,
  y: number,
  s = 1,
  opts: DrawOptions = {},
) {
  const e = at(f);
  return drawClawd(p, drawing(e.id), {
    x,
    y: y + e.y * s,
    scale: s,
    name: `${e.id} / final local frame ${f}`,
    ...opts,
  });
}
export function label(p: PanelHandle, f: number, x: number, y: number) {
  const e = at(f);
  text(
    p,
    `${e.id}  /  f${String(f).padStart(3, "0")}`,
    x,
    y,
    23,
    colors.muted,
    undefined,
    "Consolas",
    "center",
  );
}
export function sequence(
  board: StoryboardProject,
  p: PanelHandle,
  start: number,
  sourceStart: number,
  length: number,
  placement: Partial<Transform>,
  rough = false,
  detail = true,
) {
  const stage = p.addGroup(rough ? "Rough action staging" : "Action staging", {
    transform: placement,
  });
  const track = p.addGroup(
    rough ? "Rough cel substitutions" : "Clean cel substitutions",
    {},
    stage.id,
  );
  const entries = [
    { ...at(sourceStart), frame: sourceStart },
    ...acting.exposures.filter((e) => e.frame > sourceStart && e.frame < sourceStart + length),
  ];
  const ids = new Map<string, string>();
  for (const e of entries)
    if (!ids.has(e.id))
      ids.set(
        e.id,
        drawClawd(p, drawing(e.id), { parent: track.id, rough, detail, name: e.id }).id,
      );
  board.production.setDrawingSequence(
    track.id,
    entries.map((e) => ({ frame: start + e.frame - sourceStart, drawingId: ids.get(e.id)! })),
  );
  for (const e of entries)
    board.production.addLayerKeyframe(track.id, start + e.frame - sourceStart, {
      transform: { x: e.x, y: e.y },
      easing: "hold",
    });
  return { stage, track };
}
export function authorFinal() {
  const b = project("Codeboard / Clawd performance");
  b.transaction("Author four-legged performance with cel exposure", () => {
    const p = panel(b, "Walk, notice, hop, land, settle", 192);
    finalStage(p);
    sequence(b, p, 0, 0, 192, { x: -120, y: 800, scaleX: 1.3, scaleY: 1.3 });
    b.setMetadata(
      "artwork",
      "Original code-authored Clawd contours; reference image is not a render asset.",
    );
    b.setMetadata(
      "timing",
      "24 fps; mostly twos; 12 walk drawings repeated three times; notice and settle holds.",
    );
  });
  return b;
}
export function authorReel() {
  const b = project("Codeboard / Animate your idea with code.");
  b.transaction("Author eight-part showreel from the performance drawings", () => {
    let p = panel(b, "IDEA", 48);
    text(p, "Codeboard", 150, 280, 124);
    text(p, "Animate your idea with code.", 160, 370, 42);
    inkLine(
      p,
      undefined,
      [
        [158, 304],
        [514, 306],
        [910, 298],
      ],
      colors.orange,
      8,
    );
    const terminal = p.addVectorLayer("Prompt terminal");
    poly(
      terminal,
      [
        [155, 485],
        [1770, 485],
        [1770, 820],
        [155, 820],
      ],
      undefined,
      colors.muted,
      2,
    );
    text(p, "Claude Code  /  agent", 192, 542, 27, colors.muted, undefined, "Consolas");
    text(
      p,
      "> Animate Clawd walking, stopping,",
      192,
      640,
      42,
      colors.paper,
      undefined,
      "Consolas",
    );
    text(p, "  and hopping over a line.", 192, 704, 42, colors.paper, undefined, "Consolas");
    p = panel(b, "STORYBOARD", 48);
    heading(p, "02", "STORYBOARD", "One small obstacle. One considered hop.");
    for (const [i, f, name] of [
      [0, 8, "WALK"],
      [1, 94, "NOTICE"],
      [2, 142, "HOP & LAND"],
    ] as const) {
      const x = 100 + i * 590,
        y = 300,
        l = p.addVectorLayer(`${name} panel`);
      poly(
        l,
        [
          [x, y],
          [x + 550, y + 2],
          [x + 550, y + 510],
          [x, y + 508],
        ],
        undefined,
        colors.paper,
        2,
      );
      ground(p, x + 30, x + 520, 705);
      if (i < 2) sample(p, f, x + 250, 705, 1.04);
      else {
        sample(p, 140, x + 180, 705, 1.04, { exposure: { startFrame: 48, endFrame: 72 } });
        sample(p, 156, x + 385, 705, 1.04, { exposure: { startFrame: 72, endFrame: 96 } });
      }
      if (i > 0) obstacle(p, x + (i === 2 ? 230 : 433), 705);
      text(p, name, x + 275, 883, 32, colors.paper, undefined, "Segoe Print", "center");
    }
    p = panel(b, "KEY DRAWINGS", 72);
    heading(p, "03", "KEY DRAWINGS", "Weight changes the drawing.");
    for (const [i, f, name] of [
      [0, 4, "SUPPORT"],
      [1, 124, "ANTICIPATION"],
      [2, 142, "AIRBORNE"],
      [3, 156, "CONTACT / WEIGHT"],
    ] as const) {
      const x = 265 + i * 465;
      ground(p, x - 195, x + 195, 705);
      sample(p, f, x, 705, 1.35);
      text(p, name, x, 820, 26, colors.paper, undefined, "Segoe Print", "center");
      label(p, f, x, 872);
    }
    p = panel(b, "DRAWING SEQUENCE", 48);
    heading(p, "04", "DRAWING SEQUENCE", "From compression to release.");
    for (let i = 0; i < 8; i++) {
      const f = 122 + i * 2,
        x = 170 + i * 226;
      ground(p, x - 95, x + 95, 690);
      sample(p, f, x, 690, 0.82);
      label(p, f, x, 778);
    }
    text(
      p,
      "Consecutive exposures from the final action  /  24 fps, mostly on twos",
      960,
      931,
      27,
      colors.muted,
      undefined,
      "Segoe Print",
      "center",
    );
    p = panel(b, "IN-BETWEEN", 48);
    heading(p, "05", "IN-BETWEEN", "The push leaves the feet last.");
    // Exact preceding and following cels, with their original action-space displacement.
    for (const [f, opacity] of [
      [126, 0.19],
      [130, 0.22],
    ] as const)
      sample(p, f, 980, 805, 2.4, { opacity });
    sample(p, 128, 980, 805, 2.4);
    ground(p, 500, 1440, 805);
    text(p, "f126", 600, 910, 25, colors.muted, undefined, "Consolas");
    text(p, "f128 / active", 980, 910, 27, colors.paper, undefined, "Consolas", "center");
    text(p, "f130", 1350, 910, 25, colors.muted, undefined, "Consolas");
    p = panel(b, "ROUGH TO CLEAN", 72);
    heading(p, "06", "ROUGH TO CLEAN", "Same action. Same exposure.");
    text(p, "ROUGH", 485, 315, 30, colors.paper, undefined, "Segoe Print", "center");
    text(p, "CLEAN", 1435, 315, 30, colors.paper, undefined, "Segoe Print", "center");
    const divider = p.addVectorLayer("Comparison divider");
    line(
      divider,
      [
        [960, 360],
        [960, 882],
      ],
      colors.muted,
      1,
    );
    for (const [base, rough] of [
      [-625, true],
      [325, false],
    ] as const) {
      ground(p, base + 790, base + 1470, 810);
      obstacle(p, base + 1177, 810);
      sequence(b, p, 264, 112, 72, { x: base, y: 810, scaleX: 1.1, scaleY: 1.1 }, rough);
    }
    p = panel(b, "FINAL ANIMATION", 192);
    finalStage(p, 336);
    sequence(b, p, 336, 0, 192, { x: -120, y: 800, scaleX: 1.3, scaleY: 1.3 });
    p = panel(b, "END CARD", 48);
    text(p, "Codeboard", 310, 523, 138);
    text(p, "Animate your idea with code.", 325, 654, 44);
    inkLine(
      p,
      undefined,
      [
        [323, 567],
        [720, 555],
        [1170, 558],
      ],
      colors.orange,
      9,
    );
    sample(p, 190, 1510, 650, 1.5);
    b.setMetadata(
      "credit",
      "Claude Code is the agent shown in the demo concept. Codeboard is the product; no endorsement is claimed.",
    );
    b.setMetadata(
      "artwork",
      "Editable vector cels and procedural ink via Codeboard public APIs. No bitmap character or camera animation.",
    );
  });
  return b;
}
