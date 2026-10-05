import type { PixelBuffer, PixelSelection } from "../model/types.js";
import { validatePixels, validateSelection } from "../model/validation/pixels.js";

export type PixelColor = readonly [number, number, number, number];

/** Apply coverage without flattening the source surface or its later paint strokes. */
export function fillPixels(
  image: PixelBuffer,
  color: PixelColor,
  options: {
    selection?: PixelSelection;
    mode?: "source-over" | "copy" | "destination-out" | "source-atop";
  } = {},
): void {
  validatePixels(image);
  const rgba = Array.from(color);
  if (rgba.length !== 4 || rgba.some((c) => !Number.isInteger(c) || c < 0 || c > 255))
    throw new Error("Fill color must contain four RGBA8 channel values");
  if (options.selection) validateSelection(options.selection, image.width, image.height);
  const mode = options.mode ?? "source-over";
  if (!["source-over", "copy", "destination-out", "source-atop"].includes(mode))
    throw new Error("Unsupported pixel fill mode");
  const mask = options.selection?.coverage;
  const selected = mask?.buffer === image.pixels.buffer ? mask.slice() : mask;
  for (let i = 0; i < image.width * image.height; i++) {
    const coverage = (selected?.[i] ?? 255) / 255;
    if (!coverage) continue;
    const at = i * 4,
      da = image.pixels[at + 3]! / 255,
      sa = rgba[3]! / 255;
    if (mode === "destination-out") {
      image.pixels[at + 3] = Math.round(255 * da * (1 - sa * coverage));
      continue;
    }
    if (mode === "source-atop") {
      if (!da) continue;
      for (let c = 0; c < 3; c++)
        image.pixels[at + c] = Math.round(
          rgba[c]! * sa * coverage + image.pixels[at + c]! * (1 - sa * coverage),
        );
      continue;
    }
    if (mode === "copy" && coverage === 1) {
      image.pixels.set(rgba, at);
      continue;
    }
    const source = sa * coverage,
      destination = da * (mode === "copy" ? 1 - coverage : 1 - source),
      alpha = source + destination;
    if (alpha)
      for (let c = 0; c < 3; c++)
        image.pixels[at + c] = Math.round(
          (rgba[c]! * source + image.pixels[at + c]! * destination) / alpha,
        );
    image.pixels[at + 3] = Math.round(alpha * 255);
  }
}
