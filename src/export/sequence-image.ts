import sharp from "sharp";
import { CodeboardError } from "../model/errors.js";
import { validateDimensions } from "../model/validation/pixels.js";

/** Decode one PNG through the installed backend and inspect its RGBA8 coverage. */
export async function inspectSequenceImage(
  bytes: Buffer,
  file: string,
  expected: { width: number; height: number } | undefined,
  opaque: boolean,
) {
  try {
    const image = sharp(bytes, { limitInputPixels: 32 * 1024 * 1024, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== "png" || (metadata.pages ?? 1) !== 1)
      throw new CodeboardError("INVALID_ARGUMENT", "Sequence entries must be single-frame PNGs");
    if (metadata.depth !== "uchar")
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Sequence image inspection requires 8-bit PNG channels",
      );
    validateDimensions(metadata.width, metadata.height);
    if (expected && (metadata.width !== expected.width || metadata.height !== expected.height))
      throw new CodeboardError("INVALID_ARGUMENT", "Sequence frame dimensions differ", {
        details: { expected, actual: { width: metadata.width, height: metadata.height } },
      });
    const { data, info } = await image
      .toColourspace("srgb")
      .ensureAlpha()
      .raw({ depth: "uchar" })
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 4 || info.width !== metadata.width || info.height !== metadata.height)
      throw new CodeboardError("INVALID_ARGUMENT", "Decoded sequence frame layout differs");
    let transparent = false;
    for (let index = 3; index < data.length; index += 4)
      if (data[index] !== 255) {
        transparent = true;
        break;
      }
    if (opaque && transparent)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Flattened output profile contains transparent pixels",
      );
    return { width: info.width, height: info.height, transparent };
  } catch (cause) {
    if (cause instanceof CodeboardError)
      throw new CodeboardError(cause.code, cause.message, {
        details: { ...cause.details, file },
        cause,
      });
    throw new CodeboardError("INVALID_ARGUMENT", "Sequence PNG decoding failed", {
      details: { file },
      cause,
    });
  }
}
