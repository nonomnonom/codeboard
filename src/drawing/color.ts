import { isDrawingColor } from "./css-color.js";
import { isVectorFill } from "./gradient-fill.js";
export { isDrawingColor } from "./css-color.js";
export { isVectorFill } from "./gradient-fill.js";

export function assertDrawingColors(value: object): void {
  for (const key of ["color", "fill", "stroke"]) {
    const color = (value as Record<string, unknown>)[key];
    const valid =
      key === "fill" && (value as { kind?: string }).kind === "vector-path"
        ? isVectorFill(color)
        : isDrawingColor(color);
    if (color !== undefined && !valid)
      throw new Error(`Invalid drawing ${key}; use a supported CSS color or valid vector gradient`);
  }
}
