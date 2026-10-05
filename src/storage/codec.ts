import {
  encodePath,
  decodePath,
  encodeNumbers,
  decodeNumbers,
  encodePoints,
  decodePoints,
} from "./binary-payload.js";
import { createHash } from "node:crypto";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import type { DatabaseSync } from "node:sqlite";

export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Payload references are internal tagged tuples; user objects are always escaped. */
export class PayloadCodec {
  private select: ReturnType<DatabaseSync["prepare"]>;
  private exists: ReturnType<DatabaseSync["prepare"]>;
  private reading = 0;
  private decoded = new Map<string, unknown>();
  private raw = new Map<string, Buffer>();
  constructor(private db: DatabaseSync) {
    this.select = db.prepare("SELECT kind,codec,raw_size,data FROM payloads WHERE hash=?");
    this.exists = db.prepare("SELECT 1 FROM payloads WHERE hash=?");
  }

  put(kind: string, bytes: Buffer): string {
    const hash = digest(Buffer.concat([Buffer.from(`${kind}\0`), bytes]));
    if (!this.exists.get(hash)) {
      const compressed = brotliCompressSync(bytes, {
        params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
      });
      const codec = compressed.length < bytes.length ? "br" : "raw";
      this.db
        .prepare("INSERT INTO payloads VALUES(?,?,?,?,?)")
        .run(hash, kind, codec, bytes.length, codec === "br" ? compressed : bytes);
      if (kind === "tree") {
        const visit = (node: unknown): void => {
          if (!Array.isArray(node)) return;
          const child =
            node[0] === "$ref" || node[0] === "$commands" || node[0] === "$bytes"
              ? node[1]
              : node[0] === "$numbers" || node[0] === "$points"
                ? node[2]
                : undefined;
          if (child)
            this.db.prepare("INSERT OR IGNORE INTO payload_links VALUES(?,?)").run(hash, child);
          else for (const item of node) visit(item);
        };
        visit(JSON.parse(bytes.toString()));
      }
    }
    return hash;
  }

  get(hash: string, kind?: string): Buffer {
    const cacheKey = `${kind ?? ""}:${hash}`;
    if (this.reading && this.raw.has(cacheKey)) return this.raw.get(cacheKey)!;
    const row = this.select.get(hash);
    if (!row || (kind && row.kind !== kind)) throw new Error(`Missing or invalid payload ${hash}`);
    const data = Buffer.from(row.data as Uint8Array);
    const raw =
      row.codec === "br"
        ? brotliDecompressSync(data, { maxOutputLength: Number(row.raw_size) })
        : data;
    if (
      raw.length !== row.raw_size ||
      digest(Buffer.concat([Buffer.from(`${row.kind}\0`), raw])) !== hash
    )
      throw new Error(`Corrupt payload ${hash}`);
    if (this.reading) this.raw.set(cacheKey, raw);
    return raw;
  }

  write(value: unknown): string {
    return this.put("tree", Buffer.from(JSON.stringify(this.encode(value))));
  }

  retain(parent: string, children: Iterable<string>): void {
    const insert = this.db.prepare("INSERT OR IGNORE INTO payload_links VALUES(?,?)");
    for (const child of children) insert.run(parent, child);
  }

  read<T>(hash: string): T {
    this.reading++;
    try {
      if (this.decoded.has(hash)) return structuredClone(this.decoded.get(hash)) as T;
      const value = this.decode(JSON.parse(this.get(hash, "tree").toString()));
      this.decoded.set(hash, value);
      return value as T;
    } finally {
      if (--this.reading === 0) {
        this.decoded.clear();
        this.raw.clear();
      }
    }
  }

  /** Read one escaped root-object field without decoding sibling resources or artwork. */
  readObjectField<T>(hash: string, field: string): T | undefined {
    this.reading++;
    try {
      const encoded: unknown = JSON.parse(this.get(hash, "tree").toString());
      if (!Array.isArray(encoded) || encoded[0] !== "$object" || !Array.isArray(encoded[1]))
        throw new Error("Selected payload must be an object");
      let selected: unknown,
        found = false;
      for (const pair of encoded[1]) {
        if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string")
          throw new Error("Invalid payload object entry");
        if (pair[0] !== field) continue;
        if (found) throw new Error("Duplicate selected payload field");
        selected = pair[1];
        found = true;
      }
      return found ? (this.decode(selected) as T) : undefined;
    } finally {
      if (--this.reading === 0) {
        this.decoded.clear();
        this.raw.clear();
      }
    }
  }

  private encode(value: unknown, key = ""): unknown {
    if (value instanceof Uint8Array) {
      const blocks = [];
      for (let offset = 0; offset < value.length; offset += 65536)
        blocks.push([
          "$bytes",
          this.put("bytes", Buffer.from(value.subarray(offset, offset + 65536))),
        ]);
      return ["$byteChunks", value.length, blocks];
    }
    if (Array.isArray(value)) {
      if (key === "elements") {
        // Small blocks keep local edits bounded without a database row for every mark.
        const blocks = [];
        for (let i = 0; i < value.length; i += 32)
          blocks.push(["$ref", this.write(value.slice(i, i + 32))]);
        return ["$ref", this.put("tree", Buffer.from(JSON.stringify(["$elementChunks", blocks])))];
      }
      if (key === "commands" && value.length) {
        const bytes = encodePath(value);
        return ["$commands", this.put("path-f64", bytes)];
      }
      if (value.length && value.every((v) => typeof v === "number" && Number.isFinite(v))) {
        // Alpha masks are bytes only when every source value is exactly representable.
        const byte =
          key === "alpha" && value.every((v) => Number.isInteger(v) && v >= 0 && v <= 255);
        const buffer = encodeNumbers(value, byte);
        return ["$numbers", byte ? "u8" : "f64", this.put(byte ? "u8" : "f64", buffer)];
      }
      if (key === "points" && value.length) {
        const keys = [...new Set(value.flatMap((p) => Object.keys(p)))].sort();
        if (value.every((p) => keys.every((k) => p[k] === undefined || typeof p[k] === "number"))) {
          const bytes = encodePoints(value, keys);
          return ["$points", keys, this.put("points-f64", bytes)];
        }
      }
      return ["$array", value.map((v) => this.encode(v))];
    }
    if (value && typeof value === "object") {
      const pairs = Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, this.encode(v, k)]);
      if (key === "brush" || key === "tip" || key === "paperTexture")
        return ["$ref", this.put("tree", Buffer.from(JSON.stringify(["$object", pairs])))];
      return ["$object", pairs];
    }
    return Object.is(value, -0) ? ["$negativeZero"] : value;
  }

  private decode(value: unknown): unknown {
    if (!Array.isArray(value)) return value;
    if (value[0] === "$negativeZero") return -0;
    if (value[0] === "$bytes") return new Uint8Array(this.get(value[1], "bytes"));
    if (value[0] === "$byteChunks") {
      const length = value[1];
      if (!Number.isSafeInteger(length) || length < 0 || length > 128 * 1024 * 1024)
        throw new Error("Invalid byte surface length");
      const result = new Uint8Array(length);
      let offset = 0;
      for (const block of value[2]) {
        const bytes = this.decode(block);
        if (!(bytes instanceof Uint8Array) || offset + bytes.length > length)
          throw new Error("Invalid byte block");
        result.set(bytes, offset);
        offset += bytes.length;
      }
      if (offset !== length) throw new Error("Truncated byte surface");
      return result;
    }
    if (value[0] === "$commands") {
      return decodePath(this.get(value[1], "path-f64"));
    }
    if (value[0] === "$ref") return this.read(value[1]);
    if (value[0] === "$elementChunks") return value[1].flatMap((v: unknown) => this.decode(v));
    if (value[0] === "$array") return value[1].map((v: unknown) => this.decode(v));
    if (value[0] === "$object")
      return Object.fromEntries(value[1].map(([k, v]: [string, unknown]) => [k, this.decode(v)]));
    if (value[0] === "$numbers") {
      return decodeNumbers(this.get(value[2], value[1]), value[1]);
    }
    if (value[0] === "$points") {
      return decodePoints(this.get(value[2], "points-f64"), value[1]);
    }
    throw new Error("Unknown payload tag");
  }
}
