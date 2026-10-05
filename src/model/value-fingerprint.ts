import { createHash } from "node:crypto";
import { CodeboardError } from "./errors.js";

/** Stable across object key order, including exact raster bytes in project fingerprints. */
export function fingerprint(value: unknown): string {
  const hash = createHash("sha256"),
    ancestors = new Set<object>();
  const token = (text: string) => {
    hash.update(`${Buffer.byteLength(text)}:`);
    hash.update(text);
  };
  const visit = (item: unknown, depth: number): void => {
    if (depth > 256) throw new CodeboardError("RESOURCE_LIMIT", "Value nesting exceeds 256 levels");
    if (item === null) {
      token("null");
      return;
    }
    if (typeof item === "string" || typeof item === "boolean") {
      token(typeof item);
      token(String(item));
      return;
    }
    if (typeof item === "number" && Number.isFinite(item)) {
      token("number");
      token(String(item));
      return;
    }
    if (typeof item !== "object" || item === null)
      throw new CodeboardError("INVALID_ARGUMENT", "Plans require finite JSON data");
    if (ancestors.has(item))
      throw new CodeboardError("INVALID_ARGUMENT", "Cyclic data is not supported");
    ancestors.add(item);
    if (item instanceof Uint8Array) {
      token("bytes");
      token(String(item.byteLength));
      hash.update(item);
    } else if (Array.isArray(item)) {
      token("array");
      token(String(item.length));
      for (const child of item) visit(child, depth + 1);
    } else {
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null)
        throw new CodeboardError("INVALID_ARGUMENT", "Plans require plain objects");
      const keys = Object.keys(item)
        .filter((key) => (item as Record<string, unknown>)[key] !== undefined)
        .sort();
      token("object");
      token(String(keys.length));
      for (const key of keys) {
        token(key);
        visit((item as Record<string, unknown>)[key], depth + 1);
      }
    }
    ancestors.delete(item);
  };
  visit(value, 0);
  return hash.digest("hex");
}
