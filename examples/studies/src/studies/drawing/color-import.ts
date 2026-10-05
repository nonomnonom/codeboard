import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { decodePixels, readPixelRegion, renderFramePNG, StoryboardProject } from "codeboard-studio";
import { make, rect, save, text } from "../../shared.ts";
import { report } from "../../shared/artifacts.ts";

const expected = [
  255, 0, 0, 255, 0, 255, 0, 192, 0, 0, 255, 128, 124, 151, 201, 64, 128, 128, 128, 0, 255, 255,
  255, 255,
];

export async function render(output: string): Promise<void> {
  const project = make("ICC artwork import", 640, 370);
  const panel = project
    .addScene("Color")
    .addShot("Normalized inputs")
    .addPanel({ durationFrames: 1 });
  const backdrop = panel.addVectorLayer("Light and dark alpha backdrops");
  const labels = panel.addVectorLayer("Input profile labels");
  text(labels, "sRGB RGBA8 after import", 20, 30, 22);
  const records = [];
  for (const [row, name] of ["srgb-8", "srgb-16", "p3-8", "p3-16"].entries()) {
    const input = await readFile(new URL(`../../fixtures/color/${name}.png`, import.meta.url));
    const decoded = await decodePixels(input);
    for (const [index, value] of decoded.pixels.entries()) {
      const delta = Math.abs(value - expected[index]!);
      assert.ok(delta <= (index % 4 === 3 ? 0 : 3), `${name}: channel ${index}`);
    }
    const y = 55 + row * 72;
    text(labels, name, 20, y + 28, 18);
    const layer = panel.addRasterLayer(name);
    for (let column = 0; column < 6; column++) {
      const x = 150 + column * 76;
      rect(backdrop, x, y, 68, 24, "#ffffff");
      rect(backdrop, x, y + 24, 68, 24, "#222222");
      layer.rasterSurface(readPixelRegion(decoded, { x: column, y: 0, width: 1, height: 1 }), {
        matrix: [68, 0, 0, 48, x, y],
      });
    }
    records.push({
      input: name,
      sha256: createHash("sha256").update(input).digest("hex"),
      rgba: [...decoded.pixels],
    });
  }
  const png = await renderFramePNG(project, 0);
  await save(output, "color-import", project, png);
  const reopened = await StoryboardProject.open(join(output, "color-import.cboard"));
  assert.deepEqual(reopened.toJSON(), project.toJSON());
  assert.deepEqual(await renderFramePNG(reopened, 0), png);
  const invalid = await readFile(
    new URL("../../fixtures/color/invalid-profile.png", import.meta.url),
  );
  await assert.rejects(decodePixels(invalid), { code: "INVALID_ARGUMENT" });
  await report(output, "color-import", {
    output: "sRGB RGBA8",
    records,
    invalidProfileRejected: true,
    limits:
      "ICC import normalization only; original profile and 16-bit precision are not retained in editable pixels.",
  });
}
