import sharp from "sharp";
import type { PixelBuffer } from "../model/types.js";
import { validatePixels } from "../model/validation/pixels.js";
import { CodeboardError } from "../model/errors.js";

export async function decodePixels(bytes: Uint8Array): Promise<PixelBuffer> {
  let warning: string | undefined;
  const { data, info } = await sharp(bytes, { limitInputPixels: 32 * 1024 * 1024 })
    .on("warning", (message: string) => {
      warning ??= message.slice(0, 512);
    })
    // Keep both tagged and untagged input in the RGBA8 surface's sRGB working space.
    .pipelineColourspace("srgb")
    .toColourspace("srgb")
    .withIccProfile("srgb", { attach: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (warning !== undefined)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Image decoding reported an unsupported or damaged input",
      {
        details: { reason: "IMAGE_DECODE_WARNING", warning },
      },
    );
  const result = { width: info.width, height: info.height, pixels: new Uint8Array(data) };
  validatePixels(result);
  return result;
}

export async function encodePixels(image: PixelBuffer): Promise<Buffer> {
  validatePixels(image);
  return sharp(image.pixels, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png()
    .toBuffer();
}
