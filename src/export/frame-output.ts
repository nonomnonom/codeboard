import sharp from "sharp";
import type { FrameOutputProfile } from "./frame-job-contract.js";

/** Apply a validated job profile to the renderer's encoded 8-bit PNG. */
export async function frameOutput(bytes: Buffer, profile?: FrameOutputProfile): Promise<Buffer> {
  if (!profile) return bytes;
  const background =
    profile.alpha === "flatten"
      ? { ...profile.background, alpha: 1 }
      : { r: 0, g: 0, b: 0, alpha: 0 };
  const image = sharp(bytes, { limitInputPixels: 32 * 1024 * 1024 });
  if (profile.alpha === "flatten") image.flatten({ background });
  return image
    .resize({
      width: profile.width,
      height: profile.height,
      fit: profile.fit,
      position: "centre",
      kernel: "lanczos3",
      background,
    })
    .png({ palette: false })
    .toBuffer();
}
