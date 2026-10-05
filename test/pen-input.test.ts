import { Canvas } from "skia-canvas";
import {
  catmullRom,
  line,
  cubic,
  brushes,
  customizeBrush,
  type RasterStroke,
} from "../src/index.js";
import { drawRasterStroke, sampleDabs } from "../src/render/brush-engine.js";

it("retains authored time and tilt while crossing the stylus angle seam", () => {
  const points = catmullRom(
    [
      { x: 0, y: 0, time: 0, tiltX: 10, tiltY: 20, rotation: 3.1 },
      { x: 100, y: 40, time: 100, tiltX: 30, tiltY: 40, rotation: -3.1 },
      { x: 200, y: 0, time: 400, tiltX: 50, tiltY: 60, rotation: -3 },
    ],
    10,
  );
  expect(points[10]!.time).toBe(100);
  expect(points.at(-1)!.time).toBe(400);
  expect(points[5]!.tiltX).toBe(20);
  expect(points[5]!.tiltY).toBe(30);
  expect(Math.cos(points[5]!.rotation!)).toBeLessThan(-0.99);
  const straight = line({ x: 0, y: 0, rotation: 3.1 }, { x: 100, y: 0, rotation: -3.1 }, 5);
  expect(Math.cos(straight[2]!.rotation!)).toBeLessThan(-0.99);
  expect(straight.map((p) => p.time)).toEqual([0, 8, 16, 24, 32]);
  expect(
    cubic(
      { x: 0, y: 0, time: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 30, y: 0, time: 300 },
      5,
    )[2]!.time,
  ).toBe(150);
});

it("uses tilt orientation when rotation was omitted on a multi-sample stroke", () => {
  const brush = customizeBrush(brushes.cleanInk, {
    size: 30,
    flow: 1,
    hardness: 1,
    taperStart: 0,
    taperEnd: 0,
    tip: { kind: "chisel", aspect: 0.2, angle: 0, rotationMode: "stylus" },
  });
  const point = { x: 40, y: 40, pressure: 1, tiltX: 0, tiltY: 60 };
  const stroke: RasterStroke = {
    id: "s",
    kind: "raster-stroke",
    points: [point],
    brush,
    color: "black",
    opacity: 1,
    visible: true,
    erase: false,
    seed: 1,
  };
  const render = (s: RasterStroke) => {
    const c = new Canvas(80, 80);
    drawRasterStroke(c.getContext("2d"), s);
    return Buffer.from(c.getContext("2d").getImageData(0, 0, 80, 80).data);
  };
  expect(
    render({ ...stroke, points: [point, { ...point }] }).equals(
      render({
        ...stroke,
        points: [
          { ...point, rotation: Math.PI / 2 },
          { ...point, rotation: Math.PI / 2 },
        ],
      }),
    ),
  ).toBe(true);
  const seam = {
    ...stroke,
    points: [
      { x: 10, y: 40, rotation: 3.1 },
      { x: 70, y: 40, rotation: -3.1 },
    ],
  };
  expect(sampleDabs(seam).every((p) => Math.cos(p.rotation!) < -0.99)).toBe(true);
});

it("renders authored pen speed independently of curve geometry", () => {
  const brush = customizeBrush(brushes.cleanInk, {
    size: 20,
    taperStart: 0,
    taperEnd: 0,
    dynamics: { speedSize: 1, speedOpacity: 0 },
  });
  const render = (duration: number) => {
    const points = catmullRom(
      [
        { x: 25, y: 60, time: 0 },
        { x: 80, y: 25, time: duration / 2 },
        { x: 135, y: 60, time: duration },
      ],
      12,
    );
    const stroke: RasterStroke = {
      id: "speed",
      kind: "raster-stroke",
      points,
      brush,
      color: "black",
      opacity: 1,
      visible: true,
      erase: false,
      seed: 7,
    };
    const canvas = new Canvas(160, 90),
      ctx = canvas.getContext("2d");
    drawRasterStroke(ctx, stroke);
    const pixels = ctx.getImageData(0, 0, 160, 90).data;
    return {
      points,
      alpha: pixels.reduce((sum, value, index) => sum + (index % 4 === 3 ? value : 0), 0),
    };
  };
  const fast = render(40),
    slow = render(2000);
  expect(fast.points.map(({ x, y }) => [x, y])).toEqual(slow.points.map(({ x, y }) => [x, y]));
  expect(fast.alpha).toBeGreaterThan(slow.alpha * 1.3);
  expect(() =>
    catmullRom([
      { x: 0, y: 0, time: 100 },
      { x: 10, y: 0, time: 90 },
    ]),
  ).toThrow(/nondecreasing/);
  expect(line({ x: 0, y: 0 }, { x: 10, y: 0 }).every((p) => p.rotation === undefined)).toBe(true);
});
