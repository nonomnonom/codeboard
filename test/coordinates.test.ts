afterEach(() => jest.restoreAllMocks());

import {
  StoryboardProject,
  multiplyMatrices,
  invertMatrix,
  matrixFromTransform,
  transformPoint,
  renderPanelPNG,
  decodePixels,
  pathCommands,
} from "../src/index.js";

it("composes and inverts finite affine transforms, including reflection and shear", () => {
  const a = matrixFromTransform({ x: 20, y: -4, rotation: 0.4, scaleX: -2, scaleY: 0.5 }),
    b = [1, 0.2, 0.3, 1, 8, 12];
  const combined = multiplyMatrices(a, b),
    point = { x: 7, y: 9 };
  const actual = transformPoint(combined, point),
    sequential = transformPoint(a, transformPoint(b, point));
  expect(actual.x).toBeCloseTo(sequential.x, 12);
  expect(actual.y).toBeCloseTo(sequential.y, 12);
  const restored = transformPoint(invertMatrix(combined), actual);
  expect(restored.x).toBeCloseTo(7, 12);
  expect(restored.y).toBeCloseTo(9, 12);
  expect(() => invertMatrix([1, 2, 2, 4, 0, 0])).toThrow(/singular/);
  expect(() => multiplyMatrices([1, 2], [1, 0, 0, 1, 0, 0])).toThrow(/six/);
  expect(() => matrixFromTransform({ rotation: Infinity })).toThrow(/finite/);
  expect(() => transformPoint(a, { x: NaN, y: 0 })).toThrow(/finite/);
});

it.each([true, false])(
  "maps nested animated drawing coordinates onto rendered pixels with camera=%s",
  async (camera) => {
    const p = StoryboardProject.create({
      title: "Coordinates",
      width: 160,
      height: 120,
      background: "transparent",
    });
    const shot = p.addScene("s").addShot("s"),
      panel = shot.addPanel(),
      root = panel.addGroup("Root", {
        pivot: { x: 6, y: 8 },
        depth: 2,
        transform: { x: 50, y: 40, rotation: 0.3, scaleX: 1.2, scaleY: 0.8 },
      });
    const child = panel.addGroup(
      "Child",
      {
        pivot: { x: -2, y: 3 },
        depth: 0.3,
        transform: { x: 8, y: 3, rotation: -0.2, scaleX: 1, scaleY: 1 },
      },
      root.id,
    );
    const ink = panel.addVectorLayer("Ink", {}, child.id),
      id = ink.path(pathCommands("M -5 -5 L 5 -5 L 5 5 L -5 5 Z"), { fill: "#ff0000" });
    ink.edit(id, (e) => ({ ...e, matrix: [1, 0.2, 0.1, 1, 5, 4] }));
    p.production.addLayerKeyframe(child.id, 0, { transform: { x: 8, y: 3 } });
    p.production.addLayerKeyframe(child.id, 10, { transform: { x: 16, y: 9 } });
    p.production.addCameraKeyframe(shot.id, 0, {
      x: -18,
      y: -10,
      zoom: 1.7,
      rotation: 0.18,
      easing: "hold",
    });
    const frame = 5,
      full = jest.spyOn(p, "toJSON").mockImplementation(() => {
        throw new Error("Unexpected full snapshot");
      });
    const space = p.production.coordinates(id, { frame, camera });
    full.mockRestore();
    expect(space).toMatchObject({
      panelId: panel.id,
      layerId: ink.id,
      rootLayerId: root.id,
      targetId: id,
      frame,
    });
    const pixel = transformPoint(space.localToFrame, { x: 0, y: 0 }),
      restored = transformPoint(space.frameToLocal!, pixel);
    expect(restored.x).toBeCloseTo(0, 10);
    expect(restored.y).toBeCloseTo(0, 10);
    const pixels = await decodePixels(
      await renderPanelPNG(p, panel.id, { frame, camera, annotations: false }),
    );
    const at = (Math.floor(pixel.y) * 160 + Math.floor(pixel.x)) * 4;
    expect([...pixels.pixels.slice(at, at + 4)]).toEqual([255, 0, 0, 255]);
    space.localToFrame[4] = 999;
    expect(p.production.coordinates(id, { frame, camera }).localToFrame[4]).not.toBe(999);
    expect(() => p.production.coordinates(id, { frame: -1 })).toThrow(/frame/i);
    expect(() => p.production.coordinates("missing")).toThrow(/Coordinate target/);
    root.set({ transform: { x: 50, y: 40, rotation: 0, scaleX: 0, scaleY: 1 } });
    expect(p.production.coordinates(id, { frame, camera }).frameToLocal).toBeNull();
  },
);
