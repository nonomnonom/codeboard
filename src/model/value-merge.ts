import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { CodeboardError } from "./errors.js";
import { boundQueryResponse } from "./query.js";

export interface ValueMergeOptions {
  /** JSON Pointer paths from a previous conflict report, with explicit choices. */
  resolutions?: Record<string, "local" | "incoming">;
}
export interface ValueMergeConflict {
  path: string;
  kind: "value" | "structure" | "timing";
  resolution: "unresolved" | "local" | "incoming";
}
export interface ValueMergeReport {
  conflicts: ValueMergeConflict[];
  incomingChanges: string[];
  retainedLocalChanges: string[];
}

const optionsSchema = z
  .object({
    resolutions: z.record(z.string().max(16384), z.enum(["local", "incoming"])).default({}),
  })
  .strict();
const equal = isDeepStrictEqual;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !ArrayBuffer.isView(value);
const pointer = (path: string, key: string) =>
  `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
function identities(value: unknown[]): string[] | undefined {
  if (!value.every((item) => record(item) && typeof item.id === "string")) return undefined;
  return value.map((item) => (item as { id: string }).id);
}

/** Merge shared-identity values; the domain caller validates inputs and resulting invariants. */
export function mergeValueSnapshots<T>(
  base: T,
  local: T,
  incoming: T,
  options: ValueMergeOptions = {},
  rootConflict?: ValueMergeConflict["kind"],
): ValueMergeReport & { value: T | null } {
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success) throw new CodeboardError("INVALID_ARGUMENT", "Invalid merge options");
  const resolutions = parsed.data.resolutions;
  const report: ValueMergeReport = { conflicts: [], incomingChanges: [], retainedLocalChanges: [] };
  const used = new Set<string>();
  function conflict(
    path: string,
    kind: ValueMergeConflict["kind"],
    localValue: unknown,
    incomingValue: unknown,
  ) {
    const resolution = resolutions[path] ?? "unresolved";
    if (resolution !== "unresolved") used.add(path);
    report.conflicts.push({ path, kind, resolution });
    if (resolution === "incoming") report.incomingChanges.push(path);
    else if (resolution === "local") report.retainedLocalChanges.push(path);
    return resolution === "incoming" ? incomingValue : localValue;
  }
  function merge(
    baseValue: unknown,
    localValue: unknown,
    incomingValue: unknown,
    path: string,
  ): unknown {
    if (equal(localValue, incomingValue)) {
      if (!equal(baseValue, localValue)) report.retainedLocalChanges.push(path);
      return localValue;
    }
    if (equal(baseValue, localValue)) {
      report.incomingChanges.push(path);
      return incomingValue;
    }
    if (equal(baseValue, incomingValue)) {
      report.retainedLocalChanges.push(path);
      return localValue;
    }
    if (Array.isArray(baseValue) && Array.isArray(localValue) && Array.isArray(incomingValue)) {
      const ids = identities(baseValue);
      if (ids && equal(ids, identities(localValue)) && equal(ids, identities(incomingValue)))
        return baseValue.map((value, index) =>
          merge(value, localValue[index], incomingValue[index], pointer(path, String(index))),
        );
      // Order, insertion and removal affect drawing/exposure semantics. Never guess their placement.
      return conflict(path, "structure", localValue, incomingValue);
    }
    if (record(baseValue) && record(localValue) && record(incomingValue)) {
      if (baseValue.kind !== localValue.kind || baseValue.kind !== incomingValue.kind)
        return conflict(path, "structure", localValue, incomingValue);
      const result: Record<string, unknown> = {};
      for (const key of new Set([
        ...Object.keys(baseValue),
        ...Object.keys(localValue),
        ...Object.keys(incomingValue),
      ])) {
        const value = merge(
          baseValue[key],
          localValue[key],
          incomingValue[key],
          pointer(path, key),
        );
        if (value !== undefined)
          Object.defineProperty(result, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
          });
      }
      return result;
    }
    return conflict(path, "value", localValue, incomingValue);
  }
  const merged = rootConflict
    ? conflict("", rootConflict, local, incoming)
    : merge(base, local, incoming, "");
  for (const path of Object.keys(resolutions))
    if (!used.has(path))
      throw new CodeboardError("INVALID_ARGUMENT", "Resolution does not match a current conflict", {
        details: { path },
      });
  boundQueryResponse(report, "Merge report");
  return {
    ...report,
    value: report.conflicts.some((entry) => entry.resolution === "unresolved")
      ? null
      : structuredClone(merged as T),
  };
}
