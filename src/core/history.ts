type EditBase = {
  path: string[];
  hadBefore: boolean;
  hasAfter: boolean;
};
type Edit = EditBase &
  (
    | { before: unknown; after: unknown; byteOffset?: never }
    | { before: Uint8Array; after: Uint8Array; byteOffset: number }
  );
export type Revision = Edit[];

/** Retain changed values, not 32 complete copies of every drawing and bitmap tip. */
export function difference(before: unknown, after: unknown): Revision {
  const edits: Revision = [];
  const visit = (
    a: unknown,
    b: unknown,
    path: string[],
    hadBefore = true,
    hasAfter = true,
  ): void => {
    if (Object.is(a, b) && hadBefore === hasAfter) return;
    if (a instanceof Uint8Array || b instanceof Uint8Array) {
      if (a instanceof Uint8Array && b instanceof Uint8Array && a.length === b.length) {
        for (let start = 0; start < a.length; start += 65536) {
          const end = Math.min(start + 65536, a.length);
          let first = start,
            last = end - 1;
          while (first < end && a[first] === b[first]) first++;
          if (first === end) continue;
          while (last > first && a[last] === b[last]) last--;
          edits.push({
            path,
            before: new Uint8Array(a.subarray(first, last + 1)),
            after: new Uint8Array(b.subarray(first, last + 1)),
            hadBefore,
            hasAfter,
            byteOffset: first,
          });
        }
      } else
        edits.push({
          path,
          before: structuredClone(a),
          after: structuredClone(b),
          hadBefore,
          hasAfter,
        });
      return;
    }
    if (
      hadBefore &&
      hasAfter &&
      a &&
      b &&
      typeof a === "object" &&
      typeof b === "object" &&
      Array.isArray(a) === Array.isArray(b)
    ) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys)
        visit(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          [...path, key],
          Object.hasOwn(a, key),
          Object.hasOwn(b, key),
        );
      if (Array.isArray(a) && a.length !== (b as unknown[]).length)
        visit(a.length, (b as unknown[]).length, [...path, "length"]);
    } else
      edits.push({
        path,
        before: structuredClone(a),
        after: structuredClone(b),
        hadBefore,
        hasAfter,
      });
  };
  visit(before, after, []);
  return edits;
}

export function applyRevision<T>(document: T, edits: Revision, direction: "before" | "after"): T {
  const owned = new WeakSet<object>();
  const copy = (value: unknown): object => {
    if (!value || typeof value !== "object")
      throw new Error("Revision path does not address an object");
    if (owned.has(value)) return value;
    const result =
      value instanceof Uint8Array
        ? new Uint8Array(value)
        : Array.isArray(value)
          ? value.slice()
          : { ...value };
    owned.add(result);
    return result;
  };
  const set = (owner: object, key: string, value: unknown) =>
    Object.defineProperty(owner, key, {
      value,
      writable: true,
      enumerable: key !== "length" || !Array.isArray(owner),
      configurable: key !== "length" || !Array.isArray(owner),
    });
  let result: unknown = document;
  for (const edit of direction === "before" ? [...edits].reverse() : edits) {
    if (!edit.path.length) {
      if (edit.byteOffset !== undefined) {
        result = copy(result);
        if (!(result instanceof Uint8Array))
          throw new Error("Byte revision must address a pixel buffer");
        result.set(edit[direction], edit.byteOffset);
      } else result = structuredClone(edit[direction]);
      continue;
    }
    let owner = copy(result);
    result = owner;
    for (const key of edit.path.slice(0, edit.byteOffset === undefined ? -1 : undefined)) {
      const child = copy((owner as Record<string, unknown>)[key]);
      set(owner, key, child);
      owner = child;
    }
    if (edit.byteOffset !== undefined) {
      if (!(owner instanceof Uint8Array))
        throw new Error("Byte revision must address a pixel buffer");
      owner.set(edit[direction], edit.byteOffset);
      continue;
    }
    const key = edit.path.at(-1)!;
    if (direction === "before" ? edit.hadBefore : edit.hasAfter)
      set(owner, key, structuredClone(edit[direction]));
    else delete (owner as Record<string, unknown>)[key];
  }
  return result as T;
}
