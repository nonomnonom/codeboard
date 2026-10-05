import { Canvas } from "skia-canvas";
import type { Transition } from "../model/types.js";

/** Inputs remain owned by the caller. */
export function compositeTransition(
  current: Canvas,
  incoming: Canvas,
  type: Transition["type"],
  progress: number,
): Canvas {
  const output = new Canvas(current.width, current.height);
  try {
    const ctx = output.getContext("2d");
    if (type === "dissolve") {
      ctx.globalAlpha = 1 - progress;
      ctx.drawImage(current, 0, 0);
      ctx.globalAlpha = progress;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(incoming, 0, 0);
    } else {
      ctx.drawImage(current, 0, 0);
      const width = current.width * progress,
        left = type === "wipe-left" ? current.width - width : 0;
      ctx.clearRect(left, 0, width, current.height);
      ctx.save();
      try {
        ctx.beginPath();
        ctx.rect(left, 0, width, current.height);
        ctx.clip();
        ctx.drawImage(incoming, 0, 0);
      } finally {
        ctx.restore();
      }
    }
    return output;
  } catch (error) {
    output.getContext("2d").reset();
    throw error;
  }
}
