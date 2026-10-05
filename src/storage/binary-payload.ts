// These byte layouts are part of the persisted container format.
export function encodePath(value: (Record<string, unknown> & { op: string })[]): Buffer {
  const fields: Record<string, string[]> = {
    M: ["x", "y"],
    L: ["x", "y"],
    C: ["x1", "y1", "x2", "y2", "x", "y"],
    Q: ["x1", "y1", "x", "y"],
    Z: [],
  };
  const ops = Object.keys(fields),
    bytes = Buffer.alloc(value.reduce((n, c) => n + 1 + fields[c.op]!.length * 8, 0));
  let at = 0;
  for (const command of value) {
    bytes[at++] = ops.indexOf(command.op);
    for (const field of fields[command.op]!) {
      bytes.writeDoubleLE(command[field] as number, at);
      at += 8;
    }
  }
  return bytes;
}

export function encodeNumbers(value: number[], byte: boolean): Buffer {
  const buffer = Buffer.alloc(value.length * (byte ? 1 : 8));
  value.forEach((n, i) => {
    byte ? buffer.writeUInt8(n, i) : buffer.writeDoubleLE(n, i * 8);
  });
  return buffer;
}

export function encodePoints(value: Record<string, number | undefined>[], keys: string[]): Buffer {
  const bytes = Buffer.alloc(value.length * keys.length * 9);
  value.forEach((p, i) => {
    keys.forEach((k, j) => {
      const at = (i * keys.length + j) * 9;
      if (p[k] !== undefined) {
        bytes[at] = 1;
        bytes.writeDoubleLE(p[k], at + 1);
      }
    });
  });
  return bytes;
}

export function decodePath(bytes: Buffer): Record<string, unknown>[] {
  const fields = [
      ["x", "y"],
      ["x", "y"],
      ["x1", "y1", "x2", "y2", "x", "y"],
      ["x1", "y1", "x", "y"],
      [],
    ],
    ops = ["M", "L", "C", "Q", "Z"],
    commands = [];
  let at = 0;
  while (at < bytes.length) {
    const op = bytes[at++]!;
    if (!fields[op] || at + fields[op]!.length * 8 > bytes.length)
      throw new Error("Corrupt path payload");
    const command: Record<string, unknown> = { op: ops[op] };
    for (const field of fields[op]!) {
      command[field] = bytes.readDoubleLE(at);
      at += 8;
    }
    commands.push(command);
  }
  return commands;
}

export function decodeNumbers(bytes: Buffer, kind: string): number[] {
  if (kind === "u8") return [...bytes];
  if (bytes.length % 8) throw new Error("Invalid Float64 payload length");
  return Array.from({ length: bytes.length / 8 }, (_, i) => bytes.readDoubleLE(i * 8));
}

export function decodePoints(bytes: Buffer, keys: string[]): Record<string, number>[] {
  const stride = keys.length * 9;
  if (!stride || bytes.length % stride) throw new Error("Invalid point payload length");
  return Array.from({ length: bytes.length / stride }, (_, i) =>
    Object.fromEntries(
      keys.flatMap((k, j) =>
        bytes[i * stride + j * 9] ? [[k, bytes.readDoubleLE(i * stride + j * 9 + 1)]] : [],
      ),
    ),
  );
}
