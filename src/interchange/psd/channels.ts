import { inflateSync } from "node:zlib";
import { PSDReader, psdError } from "./reader.js";

export interface PSDChannel {
  id: number;
  data: Buffer;
}

function channelBytes(channel: PSDChannel, width: number, height: number, path: string): Buffer {
  const reader = new PSDReader(channel.data, path),
    compression = reader.u16();
  const size = width * height;
  if (!size) {
    reader.padding(0);
    return Buffer.alloc(0);
  }
  if (compression === 0) {
    const result = reader.take(size);
    reader.padding(0);
    return result;
  }
  if (compression === 2 || compression === 3) {
    let result: Buffer;
    try {
      result = inflateSync(reader.take(reader.remaining), { maxOutputLength: size });
    } catch (cause) {
      psdError(
        path,
        `Invalid or oversized ZIP channel: ${cause instanceof Error ? cause.message : "decode failed"}`,
      );
    }
    if (result.length !== size) psdError(path, "ZIP channel size differs from layer dimensions");
    if (compression === 3)
      for (let row = 0; row < height; row++)
        for (let x = 1; x < width; x++) {
          const index = row * width + x;
          result[index] = (result[index]! + result[index - 1]!) & 255;
        }
    return result;
  }
  if (compression !== 1) psdError(path, `Compression ${compression}`, true);
  const lengths = Array.from({ length: height }, () => reader.u16());
  const result = Buffer.alloc(size);
  for (const [row, length] of lengths.entries()) {
    const line = new PSDReader(reader.take(length), `${path}/rows/${row}`);
    let x = 0;
    while (line.remaining) {
      const control = line.u8();
      if (control === 128) continue;
      const count = control < 128 ? control + 1 : 257 - control;
      if (x + count > width) psdError(line.path, "RLE run exceeds row width");
      if (control < 128) line.take(count).copy(result, row * width + x);
      else result.fill(line.u8(), row * width + x, row * width + x + count);
      x += count;
    }
    if (x !== width) psdError(line.path, "RLE row is incomplete");
  }
  reader.padding(0);
  return result;
}

export function decodePSDChannels(
  channels: PSDChannel[],
  width: number,
  height: number,
  path: string,
) {
  const pixels = new Uint8Array(width * height * 4);
  for (let at = 3; at < pixels.length; at += 4) pixels[at] = 255;
  for (const channel of channels) {
    const data = channelBytes(channel, width, height, `${path}/channels/${channel.id}`);
    const offset = channel.id === -1 ? 3 : channel.id;
    for (let index = 0; index < data.length; index++) pixels[index * 4 + offset] = data[index]!;
  }
  return pixels;
}
