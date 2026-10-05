import sharp from "sharp";
import { StoryboardProject, pathCommands, renderPanelPNG } from "../src/index.js";

it("places cross-group masks in their own ancestor coordinates and follows ancestor exposure", async () => {
  const project = StoryboardProject.create({
    title: "Mask placement",
    width: 96,
    height: 64,
    background: "#ffffff",
  });
  const panel = project.addScene("S").addShot("A").addPanel();
  const masks = panel.addGroup("Mask source", {
    transform: { x: 20 },
    opacity: 0.5,
    visible: false,
  });
  const mask = panel.addVectorLayer("Mask", {}, masks.id);
  mask.path(pathCommands("M 0 0 L 40 0 L 40 64 L 0 64 Z"), { fill: "black", strokeWidth: 0 });
  project.production.setExposure(masks.id, { startFrame: 0, endFrame: 4 });
  const artwork = panel.addGroup("Artwork", { transform: { x: 40 } });
  const paint = panel.addVectorLayer("Paint", { maskLayerId: mask.id }, artwork.id);
  paint.path(pathCommands("M 0 0 L 40 0 L 40 64 L 0 64 Z"), { fill: "#ff0000", strokeWidth: 0 });
  const pixel = async (frame: number, x: number) =>
    Array.from(
      await sharp(await renderPanelPNG(project, panel.id, { frame, annotations: false }))
        .extract({ left: x, top: 32, width: 1, height: 1 })
        .ensureAlpha()
        .raw()
        .toBuffer(),
    );
  expect(await pixel(0, 70)).toEqual([255, 255, 255, 255]);
  const inside = await pixel(0, 50);
  expect(inside[0]).toBe(255);
  expect(Math.abs(inside[1]! - 128)).toBeLessThanOrEqual(2);
  expect(inside[2]).toBe(inside[1]);
  expect(await pixel(4, 50)).toEqual([255, 255, 255, 255]);
});

it("applies a shared parent opacity once when a sibling supplies the mask", async () => {
  const project = StoryboardProject.create({
    title: "Shared mask parent",
    width: 64,
    height: 64,
    background: "#ffffff",
  });
  const panel = project.addScene("S").addShot("A").addPanel(),
    group = panel.addGroup("Fade", { opacity: 0.5, transform: { x: 10 } });
  const shape = pathCommands("M 0 0 L 40 0 L 40 64 L 0 64 Z");
  const mask = panel.addVectorLayer("Hidden mask", { visible: false }, group.id);
  mask.path(shape, { fill: "black", strokeWidth: 0 });
  panel
    .addVectorLayer("Paint", { maskLayerId: mask.id }, group.id)
    .path(shape, { fill: "#ff0000", strokeWidth: 0 });
  const bytes = await sharp(await renderPanelPNG(project, panel.id, { annotations: false }))
    .extract({ left: 30, top: 32, width: 1, height: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer();
  expect(bytes[0]).toBe(255);
  expect(Math.abs(bytes[1]! - 128)).toBeLessThanOrEqual(2);
  expect(bytes[2]).toBe(bytes[1]);
});
