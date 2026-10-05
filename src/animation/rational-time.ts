import { z } from "zod";
import { CodeboardError } from "../model/errors.js";

export interface RationalRate {
  numerator: number;
  denominator: number;
}
export type TimeRounding = "nearest" | "floor" | "ceil" | "exact";
export interface TimeConversion {
  value: number;
  exact: boolean;
  /** Rounded value minus the exact position, in destination ticks. */
  error: { numerator: string; denominator: string };
}

const rateSchema = z.union([
  z.number().finite().positive(),
  z
    .object({
      numerator: z.number().int().positive().safe(),
      denominator: z.number().int().positive().safe(),
    })
    .strict(),
]);
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
};
function reduce(n: bigint, d: bigint): [bigint, bigint] {
  const divisor = gcd(n, d);
  return [n / divisor, d / divisor];
}

function fraction(input: number | RationalRate): [bigint, bigint] {
  const parsed = rateSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Time rates must be positive finite numbers or positive safe integer fractions",
      { details: { issues: parsed.error.issues } },
    );
  const value = parsed.data;
  if (typeof value !== "number") return reduce(BigInt(value.numerator), BigInt(value.denominator));
  // Preserve the stored decimal value; do not guess a broadcast rate such as 24000/1001.
  const [mantissa, exponent = "0"] = String(value).split("e");
  const [whole, decimal = ""] = mantissa!.split(".");
  const scale = decimal.length - Number(exponent),
    n = BigInt(whole! + decimal);
  return scale >= 0 ? reduce(n, 10n ** BigInt(scale)) : reduce(n * 10n ** BigInt(-scale), 1n);
}

export function normalizeRate(value: number | RationalRate): RationalRate {
  const [n, d] = fraction(value),
    numerator = Number(n),
    denominator = Number(d);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator))
    throw new CodeboardError(
      "RESOURCE_LIMIT",
      "Rate cannot be represented by safe integer numerator/denominator",
    );
  return { numerator, denominator };
}

/** Scale a time by a duration ratio without quantizing it onto a frame/sample grid. */
export function scaleTimeByDuration(
  time: { ticks: number; rate: RationalRate },
  before: { ticks: number; rate: RationalRate },
  after: { ticks: number; rate: RationalRate },
): { ticks: number; rate: RationalRate } {
  if (
    ![time.ticks, before.ticks, after.ticks].every(Number.isSafeInteger) ||
    before.ticks <= 0 ||
    after.ticks <= 0
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Time scaling requires safe ticks and positive duration spans",
    );
  const [tn, td] = fraction(time.rate),
    [bn, bd] = fraction(before.rate),
    [an, ad] = fraction(after.rate);
  const factorN = BigInt(after.ticks) * ad * bn;
  const factorD = BigInt(before.ticks) * bd * an;
  if (factorN === factorD || time.ticks === 0)
    return { ticks: time.ticks, rate: normalizeRate(time.rate) };
  const [n, d] = reduce(BigInt(time.ticks) * td * factorN, tn * factorD);
  const ticks = Number(n),
    clock = Number(d);
  if (!Number.isSafeInteger(ticks) || !Number.isSafeInteger(clock))
    throw new CodeboardError("RESOURCE_LIMIT", "Scaled time exceeds the safe rational range");
  return { ticks, rate: { numerator: clock, denominator: 1 } };
}

/** Internal exact time addition; use a reduced integer clock without quantizing either operand. */
export function addTime(
  leftTicks: number,
  leftRate: number | RationalRate,
  rightTicks: number,
  rightRate: number | RationalRate,
): { ticks: number; rate: RationalRate } {
  if (!Number.isSafeInteger(leftTicks) || !Number.isSafeInteger(rightTicks))
    throw new CodeboardError("INVALID_ARGUMENT", "Time positions must be safe integers");
  const [ln, ld] = fraction(leftRate),
    [rn, rd] = fraction(rightRate);
  const [numerator, denominator] = reduce(
    BigInt(leftTicks) * ld * rn + BigInt(rightTicks) * rd * ln,
    ln * rn,
  );
  const ticks = Number(numerator),
    clock = Number(denominator);
  if (!Number.isSafeInteger(ticks) || !Number.isSafeInteger(clock))
    throw new CodeboardError("RESOURCE_LIMIT", "Combined time exceeds the safe rational range", {
      details: { reason: "TIME_SUM_RANGE" },
    });
  return { ticks, rate: { numerator: clock, denominator: 1 } };
}

/** Integer tick conversion with exact intermediate arithmetic; nearest ties round toward +infinity. */
export function rescaleTime(
  value: number,
  sourceRate: number | RationalRate,
  targetRate: number | RationalRate,
  rounding: TimeRounding = "nearest",
): TimeConversion {
  return createTimeMapper(sourceRate, targetRate, rounding)(value);
}

/** Internal batch mapper parses the rates once for a whole project/export. */
export function createTimeMapper(
  sourceRate: number | RationalRate,
  targetRate: number | RationalRate,
  rounding: TimeRounding = "nearest",
): (value: number) => TimeConversion {
  if (!["nearest", "floor", "ceil", "exact"].includes(rounding))
    throw new CodeboardError("INVALID_ARGUMENT", "Unknown time rounding policy");
  const [sn, sd] = fraction(sourceRate),
    [tn, td] = fraction(targetRate);
  const [scale, denominator] = reduce(tn * sd, td * sn);
  return (value) => {
    if (!Number.isSafeInteger(value))
      throw new CodeboardError("INVALID_ARGUMENT", "Time position must be a safe integer");
    const numerator = BigInt(value) * scale;
    let floor = numerator / denominator;
    if (numerator % denominator < 0n) floor--;
    const remainder = numerator - floor * denominator,
      exact = remainder === 0n;
    if (rounding === "exact" && !exact)
      throw new CodeboardError("INVALID_ARGUMENT", "Time conversion requires quantization", {
        details: { value, sourceRate, targetRate },
      });
    const ticks =
      rounding === "ceil" && !exact
        ? floor + 1n
        : rounding === "nearest" && 2n * remainder >= denominator
          ? floor + 1n
          : floor;
    const result = Number(ticks);
    if (!Number.isSafeInteger(result))
      throw new CodeboardError("RESOURCE_LIMIT", "Converted time exceeds the safe integer range");
    const [en, ed] = reduce(ticks * denominator - numerator, denominator);
    return { value: result, exact, error: { numerator: String(en), denominator: String(ed) } };
  };
}
