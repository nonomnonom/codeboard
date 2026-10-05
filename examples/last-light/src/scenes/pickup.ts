import { createPixels } from "codeboard-studio";
import { placeLantern } from "../artwork/acting.ts";
import { contour, ink, insect, stroke, supportingHand } from "../artwork/art.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: board, panel: p, frame, duration }: SceneContext): void {
  const ground = p.addVectorLayer("Pickup / flooded paving");
  contour(ground, "M 0 0 L 1280 0 L 1280 720 L 0 720 Z", "#414e4e");
  contour(
    ground,
    "M 0 330 C 253 307 455 361 672 317 Q 997 279 1280 306 L 1280 550 Q 1014 529 846 582 C 524 634 272 529 0 620 Z",
    "#26383b",
    "#26383b",
  );
  for (const y of [105, 253, 398, 612])
    stroke(
      ground,
      [
        [0, y],
        [395, y - 23],
        [889, y + 36],
        [1280, y + 20],
      ],
      3,
      ink,
    );
  for (const [x, y] of [
    [130, 105],
    [696, 253],
    [374, 398],
    [1030, 612],
  ])
    stroke(
      ground,
      [
        [x!, y!],
        [x! + 48, y! + 138],
      ],
      2,
      ink,
    );
  for (let j = 0; j < 9; j++)
    stroke(
      ground,
      [
        [638 - j * 17, 540 + j * 8],
        [776, 546 + j * 8],
        [889 + j * 12, 538 + j * 9],
      ],
      1.2,
      "#abb2a2",
    );
  const contact = p.addVectorLayer("Lantern / pavement contact");
  contour(
    contact,
    "M 1009 682 Q 1089 664 1175 683 Q 1209 697 1128 703 Q 1026 706 1009 696 Z",
    ink,
    ink,
    1,
  );
  const reflected = createPixels(240, 56);
  for (let y = 0; y < reflected.height; y++)
    for (let x = 0; x < reflected.width; x++) {
      const u = (x - 120) / 120,
        v = (y - 16) / 40;
      const envelope = Math.max(0, 1 - u * u - v * v);
      const ripple = Math.max(0, Math.cos(y * 0.67 + x * 0.008)) ** 8;
      reflected.pixels.set(
        [237, 182, 93, Math.round(95 * envelope * ripple)],
        (y * reflected.width + x) * 4,
      );
    }
  const reflection = p.addRasterLayer("Lantern / painted pixel reflections");
  reflection.rasterSurface(reflected, {
    matrix: [1, 0, 0, 1, 970, 684],
    name: "amber-reflection-surface",
  });
  placeLantern(p, board, frame);
  for (const [layer, initial] of [
    [contact, 0.12],
    [reflection, 0.35],
  ] as const) {
    board.production.addLayerKeyframe(layer.id, frame, { opacity: initial, easing: "ease-in-out" });
    board.production.addLayerKeyframe(layer.id, frame + 12, { opacity: 1 });
  }
  const shadow = p.addVectorLayer("Machine / contact shadow", { opacity: 0.65 });
  contour(shadow, "M 738 535 Q 780 526 820 536 Q 800 545 752 543 Z", ink, ink, 1);
  const scale = 0.85,
    rotation = -0.18;
  const x = 780 - scale * (609 * Math.cos(rotation) - 340 * Math.sin(rotation));
  const y = 490 - scale * (609 * Math.sin(rotation) + 340 * Math.cos(rotation));
  const hand = supportingHand(p);
  hand.set({ transform: { x, y, scaleX: scale, scaleY: scale, rotation } });
  const resting = insect(p, 780, 490, 0.84 * scale, false, false);
  resting.group.set({
    transform: { x: 780, y: 490, scaleX: 0.84 * scale, scaleY: 0.84 * scale, rotation },
  });
  board.production.setExposure(resting.group.id, { startFrame: frame, endFrame: frame + 20 });
  const carried = insect(p, 609, 340, 0.84, false, false, hand.id);
  board.production.setExposure(carried.group.id, {
    startFrame: frame + 20,
    endFrame: frame + duration,
  });
  for (const [offset, dx, dy, angle] of [
    [0, -165, 115, rotation],
    [12, -38, 28, rotation],
    [20, 0, 0, rotation],
    [26, 0, 0, rotation],
    [40, -70, -160, -0.04],
    [47, -78, -164, -0.04],
  ])
    board.production.addLayerKeyframe(hand.id, frame + offset!, {
      transform: { x: x + dx!, y: y + dy!, rotation: angle! },
      easing: "ease-in-out",
    });
  board.production.addLayerKeyframe(shadow.id, frame, { opacity: 0.65, easing: "hold" });
  board.production.addLayerKeyframe(shadow.id, frame + 26, {
    opacity: 0.65,
    easing: "ease-in-out",
  });
  board.production.addLayerKeyframe(shadow.id, frame + 40, { opacity: 0 });
}
