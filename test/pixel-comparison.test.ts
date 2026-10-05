import { createPixels, comparePixels } from "../src/index.js";
it("bounds visible changes and ignores hidden transparent RGB without mutating either image", () => {
  const before = createPixels(5, 4),
    after = createPixels(5, 4);
  after.pixels[0] = 255;
  expect(comparePixels(before, after)).toMatchObject({
    changedPixels: 0,
    maxChannelDelta: 0,
    bounds: null,
  });
  after.pixels.set([200, 0, 0, 128], (1 * 5 + 2) * 4);
  after.pixels.set([0, 0, 0, 20], (3 * 5 + 4) * 4);
  const result = comparePixels(before, after);
  expect(result).toMatchObject({
    changedPixels: 2,
    maxChannelDelta: 128,
    bounds: { x: 2, y: 1, width: 3, height: 3 },
  });
  expect(comparePixels(before, after, { threshold: 20 })).toMatchObject({
    changedPixels: 1,
    bounds: { x: 2, y: 1, width: 1, height: 1 },
  });
  expect(comparePixels(after, before)).toEqual(result);
  expect(comparePixels(before, after, { threshold: 128 })).toMatchObject({
    changedPixels: 0,
    bounds: null,
    maxChannelDelta: 128,
  });
  expect(before.pixels.every((v) => v === 0)).toBe(true);
  expect(after.pixels[0]).toBe(255);
  expect(() => comparePixels(before, createPixels(4, 4))).toThrow(/dimensions/);
  for (const threshold of [-1, 256, NaN, Infinity])
    expect(() => comparePixels(before, after, { threshold })).toThrow(/threshold/);
});
