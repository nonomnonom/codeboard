import { createHash } from "node:crypto";
import { CodeboardError } from "../../model/errors.js";
import { layerBase } from "../../model/layers.js";
import type { Layer } from "../../model/types.js";
import { decodePSDChannels } from "./channels.js";
import { parsePSD } from "./parse.js";
import { psdError } from "./reader.js";
import { psdOptions, type PSDImportOptions, type PSDImportResult } from "./contract.js";

/** Import a bounded RGB8 pixel-layer PSD without mutating a project or using its merged preview. */
export function importPSD(input: Uint8Array, options: PSDImportOptions): PSDImportResult {
  const settings = psdOptions(options);
  if (!(input instanceof Uint8Array)) psdError("/", "Expected PSD bytes");
  if (input.byteLength > 64 * 1024 * 1024)
    throw new CodeboardError("RESOURCE_LIMIT", "PSD exceeds 64 MiB");
  const bytes = Buffer.from(input);
  const { width, height, records, losses } = parsePSD(bytes);
  if (losses.length && settings.lossPolicy === "reject")
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "PSD import would omit metadata; inspect losses before permitting report policy",
      {
        details: { reason: "PSD_IMPORT_LOSS", losses },
      },
    );
  const layers: Layer[] = [],
    stack: Layer[][] = [layers];
  for (const record of [...records].reverse()) {
    if (record.divider === 3) {
      if (stack.length === 1) psdError(record.path, "Unmatched group terminator");
      stack.pop();
      continue;
    }
    const identity =
      record.sourceId === undefined ? `record:${record.index}` : `source:${record.sourceId}`;
    const id = `${settings.namespace}:layer:${identity}`;
    const base = layerBase(id, record.name, {
      opacity: record.opacity,
      visible: record.visible,
      blendMode: record.blendMode,
    });
    if (record.divider === 1 || record.divider === 2) {
      if (record.width || record.height) psdError(record.path, "Group pixel data", true);
      const children: Layer[] = [];
      stack[stack.length - 1]!.unshift({ ...base, kind: "group", children });
      stack.push(children);
      if (stack.length > 17)
        throw new CodeboardError("RESOURCE_LIMIT", "PSD groups exceed depth 16");
    } else {
      const pixels = decodePSDChannels(record.channels, record.width, record.height, record.path);
      stack[stack.length - 1]!.unshift({
        ...base,
        kind: "raster",
        elements: record.width
          ? [
              {
                id: `${settings.namespace}:pixels:${identity}`,
                kind: "raster-surface",
                width: record.width,
                height: record.height,
                pixels,
                matrix: [1, 0, 0, 1, record.left, record.top],
                opacity: 1,
                visible: true,
              },
            ]
          : [],
      });
    }
  }
  if (stack.length !== 1) psdError("/layers", "Unclosed group");
  return {
    width,
    height,
    layers,
    losses,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
