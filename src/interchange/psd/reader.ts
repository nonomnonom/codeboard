import { CodeboardError } from "../../model/errors.js";

export function psdError(path: string, reason: string, unsupported = false): never {
  throw new CodeboardError("INVALID_ARGUMENT", `PSD ${path}: ${reason}`, {
    details: {
      path,
      reason: unsupported ? "PSD_UNSUPPORTED_FEATURE" : "PSD_INVALID_DATA",
      feature: reason,
    },
  });
}

/** A section cannot read into its sibling, even when its declared sizes are corrupt. */
export class PSDReader {
  position = 0;
  constructor(
    readonly bytes: Buffer,
    readonly path: string,
  ) {}
  get remaining() {
    return this.bytes.length - this.position;
  }
  take(size: number): Buffer {
    if (!Number.isSafeInteger(size) || size < 0 || size > this.remaining)
      psdError(this.path, "Truncated or oversized section");
    const result = this.bytes.subarray(this.position, this.position + size);
    this.position += size;
    return result;
  }
  u8() {
    return this.take(1).readUInt8();
  }
  u16() {
    return this.take(2).readUInt16BE();
  }
  i16() {
    return this.take(2).readInt16BE();
  }
  u32() {
    return this.take(4).readUInt32BE();
  }
  i32() {
    return this.take(4).readInt32BE();
  }
  text(size: number) {
    return this.take(size).toString("ascii");
  }
  section(path: string) {
    return new PSDReader(this.take(this.u32()), path);
  }
  padding(max = 3) {
    if (this.remaining > max || this.take(this.remaining).some((value) => value !== 0))
      psdError(this.path, "Unexpected trailing data");
  }
}
