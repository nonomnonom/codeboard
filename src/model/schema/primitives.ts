import { z } from "zod";
import { isDrawingColor } from "../../drawing/css-color.js";

export const finite = z.number().finite();

export const color = z
  .string()
  .refine(isDrawingColor, "Invalid drawing color; use a supported CSS color or transparent");

export const point = z.object({
  x: finite,
  y: finite,
  pressure: finite.min(0).max(1).optional(),
  time: finite.min(0).optional(),
  tiltX: finite.min(-90).max(90).optional(),
  tiltY: finite.min(-90).max(90).optional(),
  rotation: finite.optional(),
});

export const transform = z.object({
  x: finite,
  y: finite,
  scaleX: finite,
  scaleY: finite,
  rotation: finite,
});

export const elementMatrix = z.tuple([finite, finite, finite, finite, finite, finite]);

export const unitInterval = finite.min(0).max(1);
