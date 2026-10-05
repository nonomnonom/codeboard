import type { LayerEffect } from "../model/types/layers.js";
import type { LayerKeyframe, LayerEffectChannel } from "../model/types/animation.js";
import { evaluateKeyedNumber } from "./evaluate.js";

type EffectKey = Pick<LayerKeyframe, "frame" | "easing" | "effectValues">;

/** Sample each numeric effect channel without changing source effects or keys. */
export function evaluateEffectStack(
  effects: readonly LayerEffect[],
  keys: readonly EffectKey[],
  frame: number,
): LayerEffect[] {
  return effects.map((effect, index): LayerEffect => {
    const resolve = (fallback: number, channel?: LayerEffectChannel) => {
      const entry = (key: EffectKey) =>
        key.effectValues?.find((value) => value.index === index && value.channel === channel);
      return evaluateKeyedNumber(
        keys,
        frame,
        (key) => entry(key)?.value,
        (key) => entry(key)?.easing ?? key.easing,
        fallback,
      );
    };
    if (effect.kind === "hue-rotate") return { ...effect, degrees: resolve(effect.degrees) };
    const amount = resolve(effect.amount);
    if (effect.kind === "shadow")
      return {
        ...effect,
        amount,
        offsetX: resolve(effect.offsetX, "offsetX"),
        offsetY: resolve(effect.offsetY, "offsetY"),
        opacity: resolve(effect.opacity, "opacity"),
      };
    return { ...effect, amount };
  });
}
