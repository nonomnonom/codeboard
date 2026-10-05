import { CodeboardError } from "../../model/errors.js";
import type { BlendMode } from "../../model/types.js";
import { validateDimensions } from "../../model/validation/pixels.js";
import type { PSDImportLoss } from "./contract.js";
import type { PSDChannel } from "./channels.js";
import { PSDReader, psdError } from "./reader.js";

export interface PSDRecord {
  sourceId: number | undefined;
  path: string;
  index: number;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  blendMode: BlendMode;
  divider: number;
  channels: PSDChannel[];
}
const modes: Record<string, BlendMode> = {
  norm: "source-over",
  mul: "multiply",
  scrn: "screen",
  over: "overlay",
  dark: "darken",
  lite: "lighten",
};
function blend(key: string, path: string): BlendMode {
  const value = modes[key.trim()];
  if (!value) psdError(path, `Blend mode ${key}`, true);
  return value;
}

/** Validate all section boundaries and expanded dimensions before decoding any channel. */
export function parsePSD(bytes: Buffer) {
  const reader = new PSDReader(bytes, "/");
  if (reader.text(4) !== "8BPS" || reader.u16() !== 1)
    psdError("/header", "Expected PSD version 1", true);
  if (reader.take(6).some((value) => value !== 0)) psdError("/header", "Nonzero reserved bytes");
  const channels = reader.u16(),
    height = reader.u32(),
    width = reader.u32();
  if (reader.u16() !== 8 || reader.u16() !== 3 || (channels !== 3 && channels !== 4))
    psdError("/header", "Only 8-bit RGB PSD with 3 or 4 composite channels is supported", true);
  validateDimensions(width, height);
  if (reader.section("/colorModeData").remaining)
    psdError("/colorModeData", "Color mode data", true);
  const losses: PSDImportLoss[] = [];
  const resources = reader.section("/resources");
  let resourceCount = 0;
  while (resources.remaining) {
    if (++resourceCount > 256)
      throw new CodeboardError("RESOURCE_LIMIT", "PSD exceeds 256 image resources");
    if (resources.text(4) !== "8BIM") psdError(resources.path, "Invalid resource signature");
    const id = resources.u16(),
      path = `/resources/${id}`;
    const nameLength = resources.u8();
    resources.take(nameLength + ((nameLength + 1) % 2));
    const data = resources.section(path);
    if (data.bytes.length % 2) resources.take(1);
    if (id === 1039)
      psdError(path, "Tagged ICC profiles require conversion before PSD import", true);
    if (![1005, 1024, 1026, 1033, 1036, 1057, 1060, 1061, 1072].includes(id))
      psdError(path, `Image resource ${id}`, true);
    losses.push({ path, reason: `Image resource ${id} metadata is not retained` });
  }
  const section = reader.section("/layerAndMask");
  const info = section.section("/layerAndMask/layers");
  const count = Math.abs(info.i16());
  if (!count || count > 256)
    throw new CodeboardError("RESOURCE_LIMIT", "PSD requires 1–256 layer records");
  const records: PSDRecord[] = [];
  const lengths: number[][] = [];
  let totalPixels = 0;
  for (let index = 0; index < count; index++) {
    const path = `/layers/${index}`;
    const top = info.i32(),
      left = info.i32(),
      bottom = info.i32(),
      right = info.i32();
    const w = right - left,
      h = bottom - top;
    if (w < 0 || h < 0 || w > 30000 || h > 30000 || (w === 0) !== (h === 0))
      psdError(path, "Invalid layer rectangle");
    if (w && h) validateDimensions(w, h);
    totalPixels += w * h;
    if (totalPixels > 32 * 1024 * 1024)
      throw new CodeboardError("RESOURCE_LIMIT", "PSD decoded layers exceed 32 megapixels");
    const channelCount = info.u16();
    if (channelCount > 4) psdError(path, "Mask or extra channels", true);
    const layerChannels: PSDChannel[] = [],
      channelLengths: number[] = [];
    for (let channel = 0; channel < channelCount; channel++) {
      const id = info.i16(),
        length = info.u32();
      if (![-1, 0, 1, 2].includes(id) || layerChannels.some((value) => value.id === id))
        psdError(path, "Unsupported or duplicate channel", true);
      layerChannels.push({ id, data: Buffer.alloc(0) });
      channelLengths.push(length);
    }
    if (w && ![0, 1, 2].every((id) => layerChannels.some((channel) => channel.id === id)))
      psdError(path, "Layer must contain all RGB channels");
    if (info.text(4) !== "8BIM") psdError(path, "Invalid blend signature");
    let blendMode = blend(info.text(4), `${path}/blendMode`);
    const opacity = info.u8() / 255,
      clipping = info.u8(),
      flags = info.u8();
    if (clipping) psdError(`${path}/clipping`, "PSD clipping groups are not yet mapped", true);
    if (flags & 0xc0) psdError(`${path}/flags`, "Reserved layer flags", true);
    if (flags & 1)
      losses.push({
        path: `${path}/transparencyProtected`,
        reason: "Transparency protection is not retained",
      });
    if (info.u8() !== 0) psdError(path, "Nonzero reserved layer byte");
    const extra = info.section(`${path}/extra`);
    if (extra.section(`${path}/mask`).remaining) psdError(`${path}/mask`, "Layer masks", true);
    const ranges = extra.section(`${path}/blendingRanges`);
    if (ranges.remaining % 8) psdError(ranges.path, "Invalid blend ranges");
    for (const [at, value] of ranges.bytes.entries())
      if (value !== (at % 4 < 2 ? 0 : 255)) psdError(ranges.path, "Blend If ranges", true);
    const nameLength = extra.u8(),
      nameBytes = extra.take(nameLength);
    extra.take((4 - ((nameLength + 1) % 4)) % 4);
    let sourceId: number | undefined;
    const keys = new Set<string>();
    let name = nameBytes.toString("latin1"),
      unicode = false,
      divider = 0;
    let blocks = 0;
    while (extra.remaining > 3) {
      if (++blocks > 32)
        throw new CodeboardError("RESOURCE_LIMIT", "PSD layer exceeds 32 additional blocks");
      if (extra.text(4) !== "8BIM") psdError(extra.path, "Invalid additional block signature");
      const key = extra.text(4),
        data = extra.section(`${path}/${key}`);
      if (
        keys.has(key) ||
        ((key === "lsct" || key === "lsdk") && (keys.has("lsct") || keys.has("lsdk")))
      )
        psdError(data.path, "Duplicate layer feature block");
      keys.add(key);
      if (data.bytes.length % 2) extra.take(1);
      if (key === "luni") {
        const length = data.u32();
        if (length > 4096)
          throw new CodeboardError("RESOURCE_LIMIT", "PSD layer name exceeds 4096 characters");
        name = Array.from({ length }, () => String.fromCharCode(data.u16())).join("");
        unicode = true;
        data.padding();
      } else if (key === "lyid") {
        sourceId = data.u32();
        data.padding(0);
      } else if (key === "lsct" || key === "lsdk") {
        divider = data.u32();
        if (divider > 3) psdError(data.path, "Unknown section divider", true);
        if (data.remaining) {
          if (data.text(4) !== "8BIM") psdError(data.path, "Invalid group blend signature");
          blendMode = blend(data.text(4), data.path);
        }
        if (data.remaining && data.u32() !== 0) psdError(data.path, "Animation scene group", true);
        data.padding(0);
      } else psdError(data.path, `Additional layer feature ${key}`, true);
    }
    extra.padding();
    if (flags & 0x10 && divider === 0)
      psdError(`${path}/flags`, "Layer pixels do not define its appearance", true);
    if (!unicode && nameBytes.some((value) => value >= 128))
      psdError(`${path}/name`, "Non-ASCII name without Unicode declaration", true);
    records.push({
      sourceId,
      path,
      index,
      name,
      top,
      left,
      width: w,
      height: h,
      opacity,
      visible: !(flags & 2),
      blendMode,
      divider,
      channels: layerChannels,
    });
    lengths.push(channelLengths);
  }
  for (const record of records)
    for (const [index, channel] of record.channels.entries())
      channel.data = info.take(lengths[record.index]![index]!);
  const ids = new Set<number>();
  for (const record of records) {
    if (record.divider && record.channels.some((channel) => channel.data.length > 2))
      psdError(record.path, "Group divider has pixel channel data", true);
    if (record.divider === 3 || record.sourceId === undefined) continue;
    if (ids.has(record.sourceId)) psdError(record.path, "Duplicate PSD layer ID");
    ids.add(record.sourceId);
  }
  info.padding();
  if (section.section("/globalMask").remaining) psdError("/globalMask", "Global layer mask", true);
  section.padding();
  if (reader.remaining < 2) psdError("/composite", "Missing composite image header");
  return { width, height, records, losses };
}
