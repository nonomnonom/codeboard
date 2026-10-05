import { brushes, brushTipFromFunction, customizeBrush } from "codeboard-studio";

export const ink = "#171c20",
  paper = "#e8e0cd",
  amber = "#edb65d",
  grey = "#68706f";
export const reed = customizeBrush(brushes.cleanInk, {
  id: "brush:keeper-reed",
  name: "Keeper / split reed",
  size: 5,
  tip: brushTipFromFunction(
    24,
    24,
    (x, y) => Math.max(0, 1 - x * x - y * y) * (Math.abs(x - 0.22) < 0.1 ? 0.12 : 1),
  ),
  spacing: 0.12,
  hardness: 0.86,
  taperEnd: 0.22,
});
export const dry = customizeBrush(brushes.shadeBrush, {
  id: "brush:rain-worn",
  name: "Rain-worn bristles",
  size: 22,
  flow: 0.24,
  tip: brushTipFromFunction(
    32,
    16,
    (x, y) => (Math.cos(x * 38) > 0.1 ? 1 : 0.08) * Math.max(0, 1 - x * x - y * y),
  ),
  textureStrength: 0.25,
  spacing: 0.22,
});
