import { catmullRom, type PanelHandle } from "codeboard-studio";
import { paper, amber, reed, dry } from "./palette.ts";
import { stroke } from "./marks.ts";
import { coat } from "./keeper/coat.ts";
import { head } from "./keeper/head.ts";
import { arms } from "./keeper/arms.ts";
import { legs } from "./keeper/legs.ts";
import type { KeeperPose } from "./keeper/types.ts";
export function walkingTorso(phase: number) {
  const index = phase % 8;
  const rotation = [0.08, 0.105, 0.12, 0.1, 0.075, 0.055, 0.06, 0.07][index]!;
  return {
    rotation,
    settle: [0, 3, 5, 1, -3, -6, -7, -3][index]!,
    headRotation: (0.08 - rotation) * 0.5,
  };
}
export function keeper(
  p: PanelHandle,
  x: number,
  y: number,
  s: number,
  pose: KeeperPose = "walk",
  lit = true,
  gait?: number,
  parentId?: string,
) {
  const g = p.addGroup(
    "Keeper / coat, face, hands",
    { transform: { x, y, scaleX: s, scaleY: s, rotation: 0 } },
    parentId,
  );
  if (lit && pose === "walk") {
    const reflected = p.addVectorLayer("Lantern / ground reflection", { opacity: 0.5 }, g.id);
    for (let row = 0; row < 17; row++) {
      const yy = (gait === undefined ? 638 : 615) + row * 10,
        xx = 243 + Math.sin(row * 1.3) * 5,
        half = 8 + row * 0.9;
      stroke(
        reflected,
        [
          [xx - half, yy],
          [xx - 2, yy + 0.6],
        ],
        1.7 + (row % 3) * 0.5,
        row % 4 === 0 ? paper : amber,
      );
      if (row % 3 !== 0)
        stroke(
          reflected,
          [
            [xx + 3, yy],
            [xx + half * 0.8, yy - 1],
          ],
          1.4,
          amber,
        );
    }
  }
  let l = p.addVectorLayer("Keeper boots and legs", {}, g.id);
  legs(l, pose, gait);
  const gaitPose = gait === undefined ? undefined : walkingTorso(gait);
  const angle = pose === "bend" ? 0.32 : (gaitPose?.rotation ?? 0);
  const settle = gaitPose?.settle ?? 0;
  const torso = p.addGroup(
    "Keeper torso / hip pivot",
    { pivot: { x: 130, y: 430 }, transform: { y: settle, rotation: angle } },
    g.id,
  );
  l = p.addVectorLayer("Keeper coat, face and hands", {}, torso.id);
  coat(l, pose, gait);
  const headAngle = pose === "look-up" ? -0.18 : (gaitPose?.headRotation ?? 0);
  head(p, torso, headAngle, pose);
  arms(p, torso, l, pose, gait, lit);
  const texture = p.addRasterLayer("Keeper dry seams", {}, torso.id);
  for (let i = 0; i < 8; i++)
    texture.rasterStroke(
      catmullRom(
        [
          { x: 75 + i * 4, y: 252 + i * 5, pressure: 0.35 },
          { x: 64 + i * 5, y: 331, pressure: 0.7 },
          { x: 43 + i * 7, y: 411, pressure: 0.15 },
        ],
        8,
      ),
      dry,
      { color: "#11191c", seed: 70 + i },
    );
  texture.rasterStroke(
    catmullRom(
      [
        { x: 153, y: 175, pressure: 0.1 },
        { x: 163, y: 230, pressure: 0.7 },
        { x: 155, y: 286, pressure: 0.3 },
      ],
      8,
    ),
    reed,
    { color: paper, seed: 4 },
  );
  return g;
}
