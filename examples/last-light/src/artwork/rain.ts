import type { PanelHandle, StoryboardProject } from "codeboard-studio";
import { stroke } from "./marks.ts";
import { paper } from "./palette.ts";
export const rainTile = { period: 15, height: 240, drift: -96 };
export function rain(
  p: PanelHandle,
  board: StoryboardProject,
  start: number,
  duration: number,
  intensity = 80,
) {
  const l = p.addVectorLayer("Rain / foreground streaks", { depth: 0.7, opacity: 0.35 });
  const { height: tileHeight, drift: tileDrift } = rainTile;
  const count = Math.ceil((((intensity * tileHeight) / 720) * 2200) / 1280);
  for (let i = 0; i < count; i++) {
    const x = ((i * 173) % 2200) - 400,
      y = ((i * 97) % tileHeight) - 60;
    for (let band = -2; band <= 4; band++) {
      const xx = x + band * tileDrift,
        yy = y + band * tileHeight;
      stroke(
        l,
        [
          [xx, yy],
          [xx - 24, yy + 60],
        ],
        i % 5 === 0 ? 1.6 : 0.8,
        paper,
      );
    }
  }
  timeRain(board, l.id, start, duration);
}
export function timeRain(
  board: StoryboardProject,
  layerId: string,
  start: number,
  duration: number,
) {
  const { period, height: tileHeight, drift: tileDrift } = rainTile;
  for (const key of board.production.layer(layerId).keyframes)
    board.production.removeLayerKeyframe(layerId, key.id);
  const offsets = new Set([0, duration - 1]);
  for (let frame = 0; frame < duration; frame += period) {
    offsets.add(frame);
    if (frame + period - 1 < duration) offsets.add(frame + period - 1);
  }
  for (const offset of [...offsets].sort((a, b) => a - b)) {
    const phase = offset % period;
    board.production.addLayerKeyframe(layerId, start + offset, {
      transform: { x: (tileDrift * phase) / period, y: (tileHeight * phase) / period },
      easing: phase === period - 1 ? "hold" : "linear",
    });
  }
}
