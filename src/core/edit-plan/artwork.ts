import { z } from "zod";
import { drawingElementSchema, localDrawingElementSchema } from "../../model/schema/artwork.js";
import type { DrawingElement, RasterSurface, PixelBuffer } from "../../model/types.js";
import { validatePixels } from "../../model/validation/pixels.js";
import { CodeboardError } from "../../model/errors.js";

export type PlanDrawingElement =
  | Exclude<DrawingElement, RasterSurface>
  | (Omit<RasterSurface, "pixels"> & { pixelsBase64: string });

export function planDrawingElement(element: DrawingElement): PlanDrawingElement {
  return encodeElement(element, drawingElementSchema);
}

export function planShotElement(element: DrawingElement): PlanDrawingElement {
  return encodeElement(element, localDrawingElementSchema);
}

function encodeElement(element: DrawingElement, schema: z.ZodType): PlanDrawingElement {
  const parsed = schema.parse(element) as DrawingElement;
  if (!parsed.id || parsed.id.length > 4096)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Plan artwork requires a stable ID of 1–4096 characters",
    );
  if (parsed.kind !== "raster-surface") return parsed;
  const { pixels, ...fields } = parsed;
  return { ...fields, pixelsBase64: Buffer.from(pixels).toString("base64") };
}

export function decodePlanPixels(width: number, height: number, value: string): PixelBuffer {
  if (typeof value !== "string" || value.length > 1024 * 1024)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Pixel data must be a base64 string within the plan budget",
    );
  const pixels = Buffer.from(value, "base64");
  if (pixels.toString("base64") !== value)
    throw new CodeboardError("INVALID_ARGUMENT", "Pixel data requires canonical padded base64");
  const image = { width, height, pixels: new Uint8Array(pixels) };
  validatePixels(image);
  return image;
}

export function readPlanElement(input: unknown): DrawingElement {
  return decodeElement(input, drawingElementSchema);
}
export function readPlanShotElement(input: unknown): DrawingElement {
  return decodeElement(input, localDrawingElementSchema);
}

function decodeElement(input: unknown, schema: z.ZodType): DrawingElement {
  let value = input;
  if (value && typeof value === "object" && "kind" in value && value.kind === "raster-surface") {
    if ("pixels" in value)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Raster plan elements use pixelsBase64, not pixels",
      );
    const { pixelsBase64, ...fields } = value as Record<string, unknown>;
    value = {
      ...fields,
      ...decodePlanPixels(fields.width as number, fields.height as number, pixelsBase64 as string),
    };
  }
  return schema.parse(value) as DrawingElement;
}

export const planElementSchema = z
  .unknown()
  .transform((value, ctx): PlanDrawingElement | typeof z.NEVER => {
    try {
      return planDrawingElement(readPlanElement(value));
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : String(error),
      });
      return z.NEVER;
    }
  });

export const planShotElementSchema = z
  .unknown()
  .transform((value, ctx): PlanDrawingElement | typeof z.NEVER => {
    try {
      return planShotElement(readPlanShotElement(value));
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : String(error),
      });
      return z.NEVER;
    }
  });
