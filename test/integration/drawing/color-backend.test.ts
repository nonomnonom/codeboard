import { expect, it } from "vitest";
import { Canvas, ImageData } from "skia-canvas";
import sharp from "sharp";

const floats = (bytes: Uint8Array) => new Float32Array(Uint8Array.from(bytes).buffer);
const raw = { width: 1, height: 1, channels: 4 as const };
const composite = (background: number[], foreground: number[], space: "srgb" | "scrgb") =>
  sharp(Buffer.from(background), { raw })
    .pipelineColourspace(space)
    .composite([{ input: Buffer.from(foreground), raw, blend: "over" }]);

it("measures the installed Canvas float readback without mistaking it for a float working surface", async () => {
  const canvas = new Canvas(1024, 1),
    context = canvas.getContext("2d");
  for (let i = 0; i < 1024; i++) {
    context.fillStyle = `rgb(${(i / 1023) * 100}%,0%,0%)`;
    context.fillRect(i, 0, 1, 1);
  }
  const values = floats(await canvas.toBuffer("raw", { colorType: "RGBAF32" }));
  expect(new Set(values.filter((_, i) => i % 4 === 0)).size).toBe(256);
  const pixel = new Canvas(1, 1),
    target = pixel.getContext("2d");
  target.putImageData(
    new ImageData(Buffer.from(new Float32Array([2, 0.25, -0.1, 0.5]).buffer), 1, 1, {
      colorType: "RGBAF32",
    }),
    0,
    0,
  );
  const hdr = floats(await pixel.toBuffer("raw", { colorType: "RGBAF32" }));
  // Float readback can unpremultiply saturated 8-bit red above 1 on some backends.
  expect(hdr[0]).toBeGreaterThanOrEqual(1);
  expect(hdr[0]).toBeLessThanOrEqual(2);
  expect(hdr[2]).toBe(0);
  expect(hdr[3]).toBeCloseTo(128 / 255, 6);
  expect(await pixel.toBuffer("png", { colorType: "RGBAF32" })).toEqual(
    await pixel.toBuffer("png"),
  );
  expect((await sharp(await pixel.toBuffer("png")).metadata()).bitsPerSample).toBe(8);
  const pngPixels = await sharp(await pixel.toBuffer("png"))
    .raw()
    .toBuffer();
  expect(pngPixels[0]).toBe(255);
  expect(pngPixels[2]).toBe(0);
  expect(pngPixels[3]).toBe(128);
});

it("distinguishes encoded sRGB compositing from linear-light compositing", async () => {
  const background = [0, 0, 0, 255],
    foreground = [255, 255, 255, 128];
  expect([
    ...(await composite(background, foreground, "srgb").toColourspace("srgb").raw().toBuffer()),
  ]).toEqual([128, 128, 128, 255]);
  expect([
    ...(await composite(background, foreground, "scrgb").toColourspace("srgb").raw().toBuffer()),
  ]).toEqual([188, 188, 188, 255]);
  const linear = floats(
    await composite(background, foreground, "scrgb")
      .toColourspace("scrgb")
      .raw({ depth: "float" })
      .toBuffer(),
  );
  expect(linear[0]).toBeCloseTo(128 / 255, 6);
  expect(linear[3]).toBe(1);
});

it("keeps straight alpha separate from linear RGB and exports actual 16-bit samples with an ICC profile", async () => {
  const pipeline = () => composite([0, 0, 255, 128], [255, 0, 0, 128], "scrgb");
  const data = floats(await pipeline().toColourspace("scrgb").raw({ depth: "float" }).toBuffer());
  const sourceAlpha = 128 / 255,
    alpha = sourceAlpha + sourceAlpha * (1 - sourceAlpha);
  expect(data[0]).toBeCloseTo(sourceAlpha / alpha, 6);
  expect(data[1]).toBe(0);
  expect(data[2]).toBeCloseTo((sourceAlpha * (1 - sourceAlpha)) / alpha, 6);
  expect(data[3]).toBeCloseTo(alpha, 6);
  const master = await pipeline().toColourspace("rgb16").withIccProfile("srgb").png().toBuffer();
  const metadata = await sharp(master).metadata();
  expect(metadata).toMatchObject({
    bitsPerSample: 16,
    depth: "ushort",
    hasProfile: true,
    hasAlpha: true,
  });
  // Inspect stored samples separately from the decoder's automatic ICC conversion.
  const bytes = await sharp(master, { ignoreIcc: true })
    .toColourspace("rgb16")
    .raw({ depth: "ushort" })
    .toBuffer();
  const samples = new Uint16Array(Uint8Array.from(bytes).buffer);
  const encode = (linear: number) =>
    linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  expect(Math.abs(samples[0]! - encode(sourceAlpha / alpha) * 65535)).toBeLessThan(3);
  expect(
    Math.abs(samples[2]! - encode((sourceAlpha * (1 - sourceAlpha)) / alpha) * 65535),
  ).toBeLessThan(3);
  expect(Math.abs(samples[3]! - alpha * 65535)).toBeLessThan(1);
  expect(samples[0]! % 257).not.toBe(0);
  const preserved = await sharp(master)
    .keepIccProfile()
    .pipelineColourspace("rgb16")
    .toColourspace("rgb16")
    .raw({ depth: "ushort" })
    .toBuffer();
  expect(preserved).toEqual(bytes);
  const restored = floats(
    await sharp(master)
      .keepIccProfile()
      .pipelineColourspace("scrgb")
      .toColourspace("scrgb")
      .raw({ depth: "float" })
      .toBuffer(),
  );
  // Known sRGB input: allow only the error introduced by 16-bit encoding.
  for (let channel = 0; channel < 4; channel++) {
    expect(Math.abs(restored[channel]! - data[channel]!)).toBeLessThan(0.00002);
  }
  // Sharp 0.35.5 chooses P3 processing coordinates for ICC-tagged RGB16 input.
  const managed = await sharp(master).toColourspace("rgb16").raw({ depth: "ushort" }).toBuffer();
  expect(managed).not.toEqual(bytes);
  const review = await pipeline().toColourspace("srgb").withIccProfile("srgb").png().toBuffer();
  expect((await sharp(review).metadata()).bitsPerSample).toBe(8);
});
