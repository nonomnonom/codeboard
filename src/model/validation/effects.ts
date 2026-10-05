import type { LayerEffect } from "../types/layers.js";
import type { LayerEffectValue } from "../types/animation.js";
import { CodeboardError } from "../errors.js";

export function validateEffectValues(
  effects: readonly LayerEffect[],
  values: readonly LayerEffectValue[],
  details: Readonly<Record<string, unknown>>,
): void {
  for (const entry of values) {
    const effect = effects[entry.index];
    let minimum = 0,
      maximum = 10;
    let supported = entry.channel === undefined;
    if (entry.channel !== undefined) {
      supported = effect?.kind === "shadow";
      minimum = entry.channel === "opacity" ? 0 : -4096;
      maximum = entry.channel === "opacity" ? 1 : 4096;
    } else if (effect?.kind === "hue-rotate") {
      minimum = -360;
      maximum = 360;
    } else if (effect?.kind === "blur" || effect?.kind === "shadow") maximum = 128;
    if (!effect || !supported || entry.value < minimum || entry.value > maximum)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Effect key requires an existing effect, supported channel and value within its range",
        {
          details: {
            ...details,
            effectIndex: entry.index,
            channel: entry.channel ?? "value",
            value: entry.value,
          },
        },
      );
  }
}
