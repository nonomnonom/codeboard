import type { CanvasRenderingContext2D } from "skia-canvas";
import type { Panel } from "../model/types.js";
import { assertDrawingColors } from "../drawing/color.js";

export function drawMotionAnnotations(ctx: CanvasRenderingContext2D, panel: Panel): void {
  for (const motion of panel.motion) {
    assertDrawingColors(motion);
    ctx.save();
    try {
      ctx.strokeStyle = motion.color;
      ctx.fillStyle = motion.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(motion.from.x, motion.from.y);
      ctx.lineTo(motion.to.x, motion.to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const angle = Math.atan2(motion.to.y - motion.from.y, motion.to.x - motion.from.x);
      ctx.beginPath();
      ctx.moveTo(motion.to.x, motion.to.y);
      ctx.lineTo(
        motion.to.x - 16 * Math.cos(angle - 0.45),
        motion.to.y - 16 * Math.sin(angle - 0.45),
      );
      ctx.lineTo(
        motion.to.x - 16 * Math.cos(angle + 0.45),
        motion.to.y - 16 * Math.sin(angle + 0.45),
      );
      ctx.closePath();
      ctx.fill();
      ctx.font = "600 18px sans-serif";
      ctx.fillText(motion.label, motion.from.x + 8, motion.from.y - 10);
    } finally {
      ctx.restore();
    }
  }
}
