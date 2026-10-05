import { CodeboardError } from "../model/errors.js";

export function integerArgument(value: string, label: string, signed = false): number {
  const parsed = (signed ? /^-?\d+$/ : /^\d+$/).test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed))
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      `${label} must be a ${signed ? "signed" : "nonnegative"} safe integer`,
    );
  return parsed;
}
