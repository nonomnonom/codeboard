import { createHash } from "node:crypto";
import { extname } from "node:path";
import sharp from "sharp";
import type { BrushTip } from "../../model/types.js";
import { Reader, readGBR, readABR, type Sample } from "./binary.js";
import type { BrushImportReport, ImportOptions } from "./types.js";

export function createResourceLoader(
  report: BrushImportReport,
  options: ImportOptions,
  max: number,
) {
  const addSample = async (sample: Sample, originName: string, role: "tip" | "texture" = "tip") => {
    const { data: pixels, info } = await sharp(sample.alpha, {
      raw: { width: sample.width, height: sample.height, channels: 1 },
    })
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const checksum = createHash("sha256")
      .update(`mask:${sample.width}x${sample.height}:`)
      .update(sample.alpha)
      .digest("hex");
    const importedChecksum = createHash("sha256")
      .update(`${checksum}:${info.width}x${info.height}:`)
      .update(pixels)
      .digest("hex");
    const id = `resource:${importedChecksum}:${role}`;
    const tip: Extract<BrushTip, { kind: "bitmap" }> = {
      kind: "bitmap",
      width: info.width,
      height: info.height,
      alpha: Array.from(pixels, (v) => v / 255),
      angle: 0,
      rotationMode: "stroke",
      sourceAssetId: id,
    };
    if (!report.resources.some((r) => r.id === id))
      report.resources.push({
        id,
        name: originName,
        role,
        tip,
        originalWidth: sample.width,
        originalHeight: sample.height,
        checksum,
        origin: options.origin,
      });
    if (info.width !== sample.width || info.height !== sample.height)
      report.warnings.push(
        `${originName}: resampled ${sample.width}x${sample.height} to ${info.width}x${info.height}`,
      );
    return id;
  };
  const image = async (bytes: Buffer, entry: string, role: "tip" | "texture" = "tip") => {
    const { data: pixels, info } = await sharp(bytes, { limitInputPixels: 16 * 1024 * 1024 })
      .toColourspace("srgb")
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const mode = role === "texture" ? "luminance" : (options.maskMode ?? "alpha");
    const alpha = Uint8Array.from({ length: info.width * info.height }, (_, i) => {
      const a = pixels[i * 4 + 3]! / 255,
        l = 0.2126 * pixels[i * 4]! + 0.7152 * pixels[i * 4 + 1]! + 0.0722 * pixels[i * 4 + 2]!;
      return Math.round(mode === "alpha" ? a * 255 : (mode === "luminance" ? l : 255 - l) * a);
    });
    if (mode === "alpha" && alpha.every((v) => v === 255))
      report.warnings.push(
        `${entry}: alpha is fully opaque; choose inverse-luminance for black-on-white tips`,
      );
    return addSample({ name: entry, width: info.width, height: info.height, alpha }, entry, role);
  };
  const load = async (
    bytes: Buffer,
    entry: string,
    role: "tip" | "texture" = "tip",
  ): Promise<string[]> => {
    const extension = extname(entry).toLowerCase();
    if (extension === ".png") return [await image(bytes, entry, role)];
    if (extension === ".gbr") {
      const s = readGBR(new Reader(bytes));
      const id = await addSample(s, entry, role);
      report.mapped.push(`${entry}: bitmap alpha; native spacing ${s.spacing}`);
      return [id];
    }
    if (extension === ".gih") {
      const r = new Reader(bytes),
        line = () => {
          const end = bytes.indexOf(10, r.offset);
          if (end < 0 || end - r.offset > 4096) throw new Error("Invalid GIH header");
          return r
            .take(end - r.offset + 1)
            .toString()
            .trim();
        };
      line();
      const header = line(),
        count = Number(header.split(/\s/)[0]);
      if (!Number.isInteger(count) || count < 1 || count > 4096)
        throw new Error("Invalid GIH brush count");
      const ids = [];
      for (let i = 0; i < count; i++) ids.push(await addSample(readGBR(r), `${entry}#${i}`, role));
      report.unsupported.push(
        `${entry}: image-pipe selection dynamics are not emulated (${header}); cells are separate tips`,
      );
      return ids;
    }
    if (extension === ".abr") {
      const result = readABR(bytes);
      report.unsupported.push(...result.unsupported);
      const ids = [];
      for (const s of result.samples) ids.push(await addSample(s, `${entry}/${s.name}`, role));
      return ids;
    }
    report.unsupported.push(`${entry}: resource encoding ${extension} is not decoded`);
    return [];
  };
  return load;
}
