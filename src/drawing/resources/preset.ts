import { basename } from "node:path";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { Reader } from "./binary.js";
import type { BrushImportReport, ImportedPreset } from "./types.js";
import type { createResourceLoader } from "./bitmap.js";

const list = (x: unknown): unknown[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
function node(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Invalid preset XML ${label}: expected one element`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, fallback = ""): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new Error(`Invalid preset XML ${label}: expected text`);
  return value;
}
const xml = (text: string) => {
  text = text.replace(/<!DOCTYPE\s+[A-Za-z_:][\w:.-]*\s*>/g, "");
  if (text.length > 8 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error("XML entities/DOCTYPE or oversized XML are not allowed");
  const valid = XMLValidator.validate(text);
  if (valid !== true) throw new Error(`Invalid preset XML: ${valid.err.msg}`);
  return node(
    new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      attributeNamePrefix: "@",
    }).parse(text),
    "document",
  );
};

function pngText(data: Buffer): Record<string, string> {
  if (data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    throw new Error("KPP must be a PNG container");
  const r = new Reader(data);
  r.take(8);
  const fields: Record<string, string> = Object.create(null);
  while (r.offset < data.length) {
    const length = r.u32(),
      type = r.take(4).toString(),
      chunk = r.take(length);
    r.take(4);
    if (!["tEXt", "zTXt", "iTXt"].includes(type)) continue;
    const zero = chunk.indexOf(0);
    if (zero < 1) throw new Error("Invalid PNG text keyword");
    const key = chunk.subarray(0, zero).toString();
    let value: Buffer;
    if (type === "tEXt") value = chunk.subarray(zero + 1);
    else if (type === "zTXt") {
      if (chunk[zero + 1] !== 0) throw new Error("Unknown PNG text compression");
      value = inflateSync(chunk.subarray(zero + 2), { maxOutputLength: 8 * 1024 * 1024 });
    } else {
      const compressed = chunk[zero + 1],
        method = chunk[zero + 2];
      let offset = zero + 3;
      for (let i = 0; i < 2; i++) {
        const end = chunk.indexOf(0, offset);
        if (end < 0) throw new Error("Invalid international PNG text");
        offset = end + 1;
      }
      if (method !== 0 || !(compressed === 0 || compressed === 1))
        throw new Error("Unknown international PNG text compression");
      value = compressed
        ? inflateSync(chunk.subarray(offset), { maxOutputLength: 8 * 1024 * 1024 })
        : chunk.subarray(offset);
    }
    fields[key] = value.toString("utf8");
  }
  return fields;
}

export async function importPreset(
  bytes: Buffer,
  entry: string,
  dependencies: Record<string, Buffer>,
  report: BrushImportReport,
  load: ReturnType<typeof createResourceLoader>,
): Promise<void> {
  const fields = pngText(bytes);
  if (!fields.preset)
    throw new Error(`${entry}: missing preset metadata; preview is never used as a tip`);
  const rawRoot = xml(fields.preset).Preset;
  if (!rawRoot) throw new Error(`${entry}: missing Preset XML root`);
  const root = node(rawRoot, "Preset");
  const parameters: Record<string, string> = Object.create(null);
  for (const item of list(root.param)) {
    const param = node(item, "param"),
      name = text(param["@name"], "param name");
    if (!name) throw new Error("Invalid preset XML param: missing name");
    parameters[name] = text(param["#text"], `param ${name}`);
  }
  const result: ImportedPreset = {
    name: text(root["@name"], "Preset name", entry),
    engine: text(root["@paintopid"], "paintopid", "unknown"),
    parameters,
    resourceIds: [],
    mapped: {},
    missingDependencies: [],
    unsupported: [],
  };
  const deps: Record<string, Buffer> = Object.assign(Object.create(null), dependencies);
  const resources =
    root.resources === undefined || root.resources === ""
      ? undefined
      : node(root.resources, "resources");
  for (const item of list(resources?.resource)) {
    const resource = node(item, "resource");
    const file = text(resource["@filename"], "resource filename");
    if (!file) continue;
    const decoded = Buffer.from(text(resource["#text"], `resource ${file}`), "base64");
    if (decoded.length > 16 * 1024 * 1024) throw new Error("Embedded resource exceeds 16 MB");
    const expected = text(resource["@md5sum"], "resource checksum");
    if (expected && createHash("md5").update(decoded).digest("hex") !== expected)
      throw new Error(`Embedded resource checksum mismatch: ${file}`);
    deps[file] = decoded;
  }
  const refs: { name: string; role: "tip" | "texture" }[] = [];
  if (parameters.brush_definition) {
    const rawBrush = xml(parameters.brush_definition).Brush;
    const brushDefinition =
      rawBrush === undefined || rawBrush === "" ? undefined : node(rawBrush, "Brush");
    const walk = (valueNode: unknown) => {
      if (!valueNode || typeof valueNode !== "object") return;
      for (const [key, value] of Object.entries(valueNode)) {
        if (key === "@filename") refs.push({ name: text(value, "brush filename"), role: "tip" });
        else if (typeof value === "object") walk(value);
      }
    };
    walk(brushDefinition);
    const rawSpacing =
        brushDefinition?.["@spacing"] === undefined
          ? undefined
          : text(brushDefinition["@spacing"], "brush spacing"),
      spacing = Number(rawSpacing);
    if (rawSpacing !== undefined) {
      if (String(rawSpacing).trim() && Number.isFinite(spacing) && spacing >= 0.02 && spacing <= 4)
        result.mapped.spacing = spacing;
      else
        result.unsupported.push(`Unmapped brush spacing: ${rawSpacing} (supported range 0.02..4)`);
    }
  }
  for (const [key, value] of Object.entries(parameters)) {
    if (/Texture\/Pattern\/.*(?:FileName|Filename)$/i.test(key) && value)
      refs.push({ name: value, role: "texture" });
    if (key === "OpacityValue" || key === "FlowValue") {
      const v = Number(value);
      if (value.trim() && Number.isFinite(v) && v >= 0 && v <= 1)
        result.mapped[key === "OpacityValue" ? "opacity" : "flow"] = v;
      else result.unsupported.push(`Unmapped parameter: ${key} = ${value} (supported range 0..1)`);
    }
  }
  let resolvedTip = false;
  for (const ref of refs) {
    const matches = Object.hasOwn(deps, ref.name)
      ? [ref.name]
      : Object.keys(deps).filter((k) => basename(k) === basename(ref.name));
    if (matches.length !== 1) {
      result.missingDependencies.push(`${ref.name}${matches.length > 1 ? " (ambiguous)" : ""}`);
      continue;
    }
    const ids = await load(deps[matches[0]!]!, ref.name, ref.role);
    result.resourceIds.push(...ids);
    if (ref.role === "tip" && ids.length) resolvedTip = true;
  }
  if (!resolvedTip)
    result.unsupported.push(
      "No explicit bitmap tip reference resolved; auto/procedural/masked brush definitions are not translated",
    );
  result.unsupported.push(
    `Krita engine '${result.engine}' is not emulated; sensors, mixing, masked brush and texture mode require explicit reauthoring`,
  );
  result.unsupported.push(
    ...Object.keys(parameters)
      .filter((k) => !["brush_definition", "OpacityValue", "FlowValue", "paintop"].includes(k))
      .map((k) => `Unmapped parameter: ${k}`),
  );
  report.presets.push(result);
  report.missingDependencies.push(...result.missingDependencies);
  report.unsupported.push(...result.unsupported);
  report.mapped.push(...Object.entries(result.mapped).map(([k, v]) => `${entry}: ${k} = ${v}`));
}
