import type { PageOptions } from "./types.js";
import { CodeboardError } from "./errors.js";

/** Reject oversized inspection responses without silently dropping or truncating detail records. */
export function boundQueryResponse<T>(value: T, label = "Query response"): T {
  const bytes = Buffer.byteLength(JSON.stringify(value));
  if (bytes > 262144)
    throw new CodeboardError(
      "RESOURCE_LIMIT",
      `${label} exceeds 256 KiB; reduce the limit or narrow the query`,
      { details: { bytes, maxBytes: 262144 } },
    );
  return value;
}

export function pageBounds(options: PageOptions = {}) {
  const limit = options.limit ?? 50,
    offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Query limit must be a positive safe integer and offset a nonnegative safe integer",
    );
  return { limit: Math.min(200, limit), offset };
}
