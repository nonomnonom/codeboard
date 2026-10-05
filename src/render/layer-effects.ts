import { Canvas } from "skia-canvas";
import type { Layer, LayerEffect } from "../model/types/layers.js";

import { evaluateEffectStack } from "../animation/effects.js";
import { CodeboardError } from "../model/errors.js";

// Skia's unit parser does not accept exponent notation for lengths or angles.
const filterNumber = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  maximumSignificantDigits: 21,
}).format;

/** Resolve animation and sampling footprint before allocating the layer surface. */
export function prepareLayerEffects(layer: Layer, frame: number, resolution: number) {
  const resolved = evaluateEffectStack(layer.effects ?? [], layer.keyframes, frame);
  return prepareEffectStack(resolved, resolution, { layerId: layer.id, frame });
}

/** Shared backend preparation for layer stacks and frame compositing nodes. */
export function prepareEffectStack(
  effects: readonly LayerEffect[],
  resolution: number,
  details: Readonly<Record<string, unknown>>,
) {
  let padding = 0;
  const filters = effects.map((effect, index) => {
    const value = effect.kind === "hue-rotate" ? effect.degrees : effect.amount;
    switch (effect.kind) {
      case "blur":
      case "shadow": {
        const sigma = value * resolution;
        if (!Number.isFinite(sigma) || sigma > 512)
          throw new CodeboardError(
            "RESOURCE_LIMIT",
            "Blur exceeds the 512-pixel surface radius budget",
            {
              details: { ...details, effectIndex: index, sigma, resolution },
            },
          );
        if (effect.kind === "shadow") {
          const x = effect.offsetX * resolution;
          const y = effect.offsetY * resolution;
          const opacity = effect.opacity;
          if (![x, y].every(Number.isFinite) || Math.max(Math.abs(x), Math.abs(y)) > 4096)
            throw new CodeboardError(
              "RESOURCE_LIMIT",
              "Shadow exceeds the 4096-pixel surface offset budget",
              {
                details: { ...details, effectIndex: index, x, y, resolution },
              },
            );
          padding += Math.ceil(Math.max(Math.abs(x), Math.abs(y)) + 4 * sigma);
          const { r, g, b } = effect.color;
          return `drop-shadow(${filterNumber(x)}px ${filterNumber(y)}px ${filterNumber(sigma)}px rgba(${r},${g},${b},${filterNumber(opacity)}))`;
        }
        // Sum supports across the ordered stack; groups add their own support recursively.
        padding += Math.ceil(4 * sigma);
        return `blur(${filterNumber(sigma)}px)`;
      }
      case "brightness":
        return `brightness(${value})`;
      case "contrast":
        return `contrast(${value})`;
      case "saturation":
        return `saturate(${value})`;
      case "hue-rotate":
        // Skia's angle parser drops a leading minus sign; use the equivalent positive angle.
        return `hue-rotate(${filterNumber(value < 0 ? value + 360 : value)}deg)`;
    }
    const unsupported: never = effect;
    throw new Error(`Unsupported layer effect: ${JSON.stringify(unsupported)}`);
  });
  return { filters, padding };
}

/** Apply each slot separately: Skia's CSS parser collapses repeated filter names. */
export function applyLayerEffects(source: Canvas, filters: readonly string[]): Canvas {
  let current = source;
  const intermediates: Canvas[] = [];
  try {
    for (const filter of filters) {
      const filtered = new Canvas(source.width, source.height);
      intermediates.push(filtered);
      const context = filtered.getContext("2d");
      context.filter = filter;
      context.drawImage(current, 0, 0);
      current = filtered;
    }
  } catch (error) {
    for (const canvas of intermediates) canvas.getContext("2d").reset();
    throw error;
  }
  for (const canvas of intermediates) if (canvas !== current) canvas.getContext("2d").reset();
  return current;
}
