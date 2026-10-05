import { StoryboardProject, catmullRom } from "codeboard-studio";
import { join } from "node:path";
import { amber, dry, paper, rain, reed } from "../artwork/art.ts";
import { attachSound } from "../audio/audio.ts";
import { makeBrushResource } from "../artwork/brush-resource.ts";
import { config } from "../config.ts";
import { draw as drawClosing } from "../scenes/closing.ts";
import { draw as drawDamagedWing } from "../scenes/damaged-wing.ts";
import { draw as drawDarkness } from "../scenes/darkness.ts";
import { draw as drawFlight } from "../scenes/flight.ts";
import { draw as drawLift } from "../scenes/lift.ts";
import { draw as drawOpening } from "../scenes/opening.ts";
import { draw as drawPickup } from "../scenes/pickup.ts";
import { draw as drawPuddle } from "../scenes/puddle.ts";
import { draw as drawReaction } from "../scenes/reaction.ts";
import { draw as drawRelay } from "../scenes/relay.ts";
import { draw as drawRepair } from "../scenes/repair.ts";
import { draw as drawSpark } from "../scenes/spark.ts";
import type { SceneContext } from "../scenes/types.ts";
import { draw as drawWalk } from "../scenes/walk.ts";
const drawings = [
  drawOpening,
  drawWalk,
  drawPuddle,
  drawPickup,
  drawDamagedWing,
  drawRepair,
  drawReaction,
  drawSpark,
  drawDarkness,
  drawReaction,
  drawLift,
  drawFlight,
  drawRelay,
  drawClosing,
];
export async function author(output: string): Promise<StoryboardProject> {
  const imported = await makeBrushResource(join(output, "brushes"));
  const board = StoryboardProject.create({ ...config, background: paper });
  const scene = board.addScene("The city without power", "scene:city");
  const specifications: [string, string, number, string][] = [
    [
      "A single light",
      "A keeper crosses the drowned city. One lantern remains.",
      72,
      "Extreme wide / slow approach",
    ],
    [
      "Against the rain",
      "He leans into the wind, shielding the last flame.",
      48,
      "Medium profile / tracking",
    ],
    [
      "Something in the water",
      "A broken mechanical firefly catches beneath his boot.",
      36,
      "Ground insert / rack of attention",
    ],
    [
      "A sheltering hand",
      "He sets down the lantern and releases its handle. His other hand slides beneath the machine, pauses, then lifts it from the water.",
      48,
      "Low insert / placement, contact, lift",
    ],
    [
      "A fragile machine",
      "Bent brass wings lie across his open palm. The left edge is chipped.",
      48,
      "Macro / damaged wing and exposed escapement",
    ],
    ["Repair", "A fine tool reconnects the tiny escapement.", 72, "Extreme close-up / hands"],
    ["The price", "He looks from the mechanism to his last light.", 36, "Close profile / hold"],
    ["First spark", "Amber travels into the etched wings.", 36, "Insert / tiny ignition"],
    [
      "The lantern dies",
      "The keeper gives the last flame. Darkness returns.",
      48,
      "Lantern close-up",
    ],
    ["Wait", "Nothing happens. He waits, refusing to close his hand.", 48, "Close-up / stillness"],
    [
      "It lives",
      "The wings unfold. The little machine lifts from his palm.",
      48,
      "Hand close-up / lift",
    ],
    [
      "Flight",
      "The firefly climbs between the wet facades.",
      48,
      "Low angle / climb between roof planes",
    ],
    [
      "A city remembers",
      "The firefly touches a street lamp. Its light answers, then the windows follow.",
      60,
      "Close-up / lamp relay and cascading windows",
    ],
    [
      "Light carried onward",
      "The keeper watches a thousand reflections take his place.",
      72,
      "Extreme wide / settle",
    ],
  ];
  let frame = 0;
  const state: SceneContext["state"] = {};
  const ids: string[] = [];
  for (let i = 0; i < specifications.length; i++) {
    const [title, action, duration, camera] = specifications[i]!;
    board.transaction(`Author panel ${i + 1}: ${title}`, () => {
      const shot = scene.addShot(title, `shot:${i + 1}`);
      const p = shot.addPanel({
        id: `panel:${String(i + 1).padStart(2, "0")}`,
        number: String(i + 1).padStart(2, "0"),
        title,
        action,
        durationFrames: duration,
        camera,
      });
      ids.push(p.id);
      const draw = drawings[i];
      if (!draw) throw new Error("Missing shot drawing");
      draw({ project: board, panel: p, frame, duration, index: i, state });
      if (![4, 5, 7, 8, 10].includes(i)) rain(p, board, frame, duration, i === 9 ? 22 : 70);
      if ([0, 1, 3, 13].includes(i)) {
        const accents = p.addRasterLayer("Imported feather / worn pavement");
        if (i === 13)
          for (const [offset, opacity] of [
            [0, 0],
            [28, 0],
            [38, 1],
          ])
            board.production.addLayerKeyframe(accents.id, frame + offset!, {
              opacity: opacity!,
              easing: "linear",
            });
        for (let j = 0; j < 5; j++)
          accents.rasterStroke(
            catmullRom(
              [
                { x: 850 + j * 35, y: 585 + j * 21, pressure: 0.1 },
                { x: 920 + j * 35, y: 578 + j * 21, pressure: 0.5 },
                { x: 1130 + j * 12, y: 593 + j * 21, pressure: 0.1 },
              ],
              7,
            ),
            { ...imported, size: 18, flow: 0.18 },
            { color: i === 13 ? amber : paper, seed: 12 + j },
          );
      }
      board.production.addCameraKeyframe(shot.id, frame, {
        x: i === 4 ? -31 : 0,
        y: i === 4 ? -20 : 0,
        zoom: i === 4 ? 3 : 1,
        rotation: 0,
        easing: "ease-in-out",
      });
      board.production.addCameraKeyframe(shot.id, frame + duration - 1, {
        x: i === 4 ? -31 : i === 11 ? 20 : i === 1 ? 90 : 0,
        y: i === 4 ? -20 : 0,
        zoom: i === 4 ? 3.08 : [0, 5, 6, 7].includes(i) ? 1.045 : 1,
        rotation: 0,
        easing: "linear",
      });
    });
    frame += duration;
    console.log(`Authored ${i + 1}/14`);
  }
  board.transaction("Register authored brushes and credits", () => {
    for (const b of [reed, dry, imported]) board.production.createBrush(b);
    board.setMetadata(
      "artwork",
      "Original code-authored contours, hatching and bitmap painting. No generated or stock illustration.",
    );
    board.setMetadata(
      "sound",
      "Original synthesized rain, mechanism, first-spark transient and harmonic light; examples/last-light/sound.ts. CC0-1.0.",
    );
  });
  await attachSound(board, output, frame);
  return board;
}
