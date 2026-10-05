import { mkdir, mkdtemp, rm, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { decodePixels, encodePixels, StoryboardProject, renderPanelPNG } from "../src/index.js";

const rgba = Buffer.from([
  255, 0, 0, 255, 0, 255, 0, 192, 0, 0, 255, 128, 124, 151, 201, 64, 128, 128, 128, 0, 255, 255,
  255, 255,
]);
const raw = { width: 6, height: 1, channels: 4 as const };

it("interprets untagged RGB16 as sRGB without assigning a P3 source profile", async () => {
  const encoded = await sharp(rgba, { raw }).toColourspace("rgb16").png().toBuffer();
  expect((await sharp(encoded).metadata()).hasProfile).toBe(false);
  expect((await decodePixels(encoded)).pixels).toEqual(new Uint8Array(rgba));
});

for (const profile of ["srgb", "p3"] as const) {
  for (const depth of [8, 16] as const) {
    it(`normalizes ${depth}-bit ${profile} ICC artwork into editable sRGB RGBA8`, async () => {
      const encoded = await readFile(`examples/studies/src/fixtures/color/${profile}-${depth}.png`);
      expect(await sharp(encoded).metadata()).toMatchObject({
        hasProfile: true,
        bitsPerSample: depth,
        hasAlpha: true,
      });
      const decoded = await decodePixels(encoded);
      expect(decoded.width).toBe(raw.width);
      expect(decoded.height).toBe(raw.height);
      for (const [index, channel] of decoded.pixels.entries()) {
        if (index % 4 === 3) expect(channel).toBe(rgba[index]);
        else expect(Math.abs(channel - rgba[index]!)).toBeLessThanOrEqual(3);
      }
      expect(await decodePixels(await encodePixels(decoded))).toEqual(decoded);

      await mkdir(resolve(".preview"), { recursive: true });
      const directory = await mkdtemp(resolve(".preview/pixel-color-"));
      try {
        const project = StoryboardProject.create({
          title: "Normalized paint",
          width: 24,
          height: 16,
          background: "transparent",
        });
        const panel = project.addScene("Scene").addShot("Shot").addPanel();
        const id = panel.addRasterLayer("Imported color").rasterSurface(decoded);
        const file = join(directory, "color.cboard");
        await project.save(file);
        const reopened = await StoryboardProject.open(file);
        const stored = reopened.production.element(id);
        if (stored.kind !== "raster-surface") throw new Error("Expected pixel artwork");
        expect(stored.pixels).toEqual(decoded.pixels);
        expect(await renderPanelPNG(reopened, panel.id)).toEqual(
          await renderPanelPNG(project, panel.id),
        );
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}

it("rejects a damaged ICC profile instead of silently substituting untagged color", async () => {
  const bytes = await readFile("examples/studies/src/fixtures/color/invalid-profile.png");
  await expect(decodePixels(bytes)).rejects.toMatchObject({
    code: "INVALID_ARGUMENT",
    details: { reason: "IMAGE_DECODE_WARNING" },
  });
});
