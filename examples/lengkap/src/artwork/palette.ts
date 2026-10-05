import { brushes, brushTipFromFunction, customizeBrush } from "codeboard-studio";

export const paper = "#f3eddf",
  ink = "#191916",
  red = "#b73824";
export const grain = Array.from({ length: 128 * 128 }, (_, i) => {
  const x = i % 128,
    y = Math.floor(i / 128);
  let h = Math.imul(x + 19, 374761393) ^ Math.imul(y + 71, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const n = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  const patch = (Math.sin(x * 0.37 + y * 0.15) + Math.sin(x * 0.11 - y * 0.41) + 2) / 4;
  return n > 0.91 && patch > 0.44 ? 0.06 : n > 0.72 ? 0.76 : 1;
});
export const rough = customizeBrush(brushes.cleanInk, {
  id: "brush:rough-ink",
  name: "Rough ink / broken perimeter",
  hardness: 1,
  spacing: 0.055,
  flow: 1,
  taperStart: 0.04,
  taperEnd: 0.1,
  texture: "dry-brush",
  textureStrength: 0.04,
  paperTexture: { width: 128, height: 128, alpha: grain, scale: 0.55, strength: 0.15 },
  tip: brushTipFromFunction(96, 96, (x, y) => {
    const a = Math.atan2(y, x),
      r = Math.hypot(x, y);
    const edge = 0.92 + 0.027 * Math.sin(a * 17) + 0.018 * Math.cos(a * 29);
    return r < edge ? (r > 0.79 && Math.sin(x * 81 + y * 137) > 0.77 ? 0.25 : 1) : 0;
  }),
  dynamics: { pressureSize: 0.85, pressureOpacity: 0, speedSize: 0, rotationJitter: 0 },
});
export const dry = customizeBrush(rough, {
  id: "brush:dry-ink",
  name: "Dry ink / broken broad sweep",
  spacing: 0.045,
  taperStart: 0.025,
  taperEnd: 0.09,
  textureStrength: 0.12,
  tip: brushTipFromFunction(96, 96, (x, y) => {
    const edge = 0.57 + 0.18 * Math.sin(y * 39) + 0.11 * Math.cos(y * 87);
    if (Math.abs(x) > edge || Math.abs(y) > 0.92) return 0;
    for (const [center, width] of [
      [-0.84, 0.028],
      [-0.69, 0.025],
      [0.61, 0.022],
      [0.81, 0.034],
    ])
      if (Math.abs(y - center!) < width!) return 0;
    return 1;
  }),
});
export const fine = customizeBrush(brushes.cleanInk, {
  id: "brush:pen",
  name: "Pena / firm pressure line",
  spacing: 0.065,
  taperStart: 0.035,
  taperEnd: 0.1,
  hardness: 1,
  flow: 1,
  dynamics: { pressureSize: 1, pressureOpacity: 0.12, speedSize: 0 },
});
export const speck = (x: number, y: number) => {
  let h = Math.imul(x + 131, 374761393) ^ Math.imul(y + 317, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
export const tooth = Array.from({ length: 128 * 128 }, (_, i) => {
  const x = i % 128,
    y = Math.floor(i / 128),
    gx = Math.floor(x / 8),
    gy = Math.floor(y / 8);
  const u = (x % 8) / 8,
    v = (y % 8) / 8,
    s = u * u * (3 - 2 * u),
    t = v * v * (3 - 2 * v);
  const top = speck(gx, gy) * (1 - s) + speck((gx + 1) % 16, gy) * s;
  const bottom = speck(gx, (gy + 1) % 16) * (1 - s) + speck((gx + 1) % 16, (gy + 1) % 16) * s;
  const n = speck(x + 1000, y + 1000),
    clump = top * (1 - t) + bottom * t;
  return n > 0.985 ? 0.22 : Math.min(1, 0.65 + clump * 0.12 + n * 0.2);
});
export const charcoal = customizeBrush(rough, {
  id: "brush:charcoal-mass",
  name: "Arang / compressed dark mass",
  texture: "charcoal",
  textureStrength: 0.32,
  paperTexture: { width: 128, height: 128, alpha: tooth, scale: 0.62, strength: 0.67 },
  spacing: 0.075,
  taperStart: 0.025,
  taperEnd: 0.06,
  hardness: 0.96,
  dynamics: { pressureSize: 0.72, pressureOpacity: 0.1, rotationJitter: 0.025 },
});
export const pastel = customizeBrush(rough, {
  id: "brush:soft-pastel",
  name: "Pastel / broad powder edge",
  texture: "charcoal",
  textureStrength: 0.17,
  opacity: 0.9,
  flow: 0.45,
  hardness: 0.86,
  spacing: 0.09,
  taperStart: 0.025,
  taperEnd: 0.07,
  paperTexture: { width: 128, height: 128, alpha: tooth, scale: 0.39, strength: 0.86 },
  tip: brushTipFromFunction(96, 96, (x, y) => {
    const edge = 0.79 + 0.07 * Math.sin(y * 21) + 0.045 * Math.sin(y * 57);
    return Math.abs(x) < edge && Math.abs(y) < 0.86 ? Math.min(1, (0.89 - Math.abs(y)) * 12) : 0;
  }),
  dynamics: { pressureSize: 0.42, pressureOpacity: 0.25, rotationJitter: 0.02 },
});
export const pencil = customizeBrush(brushes.roughPencil, {
  id: "brush:graphite-pencil",
  name: "Pensil / searching graphite line",
  hardness: 0.88,
  opacity: 0.73,
  flow: 0.52,
  spacing: 0.1,
  taperStart: 0.045,
  taperEnd: 0.14,
  paperTexture: { width: 128, height: 128, alpha: tooth, scale: 0.32, strength: 0.62 },
  dynamics: { pressureSize: 0.8, pressureOpacity: 0.4, speedSize: 0, speedOpacity: 0 },
});
export const stampInk = customizeBrush(rough, {
  id: "brush:stamp-ink",
  name: "Stamp / porous impression",
  taperStart: 0.025,
  taperEnd: 0.045,
  paperTexture: { width: 128, height: 128, alpha: grain, scale: 0.65, strength: 0.78 },
});
