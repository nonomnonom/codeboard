import type { BrushPreset, Id } from "../../model/types.js";
import { parseBrushDefinition } from "../../model/validation/brushes.js";
import type { ProductionHost, MutationOptions } from "./host.js";

type Host = Pick<ProductionHost, "_applyProduction" | "_readBrush">;

export function brush(host: Host, id: Id): BrushPreset {
  return host._readBrush(id);
}

export function createBrush(
  host: Host,
  definition: Omit<BrushPreset, "id" | "version"> & { id?: Id },
  options: MutationOptions = {},
): Id {
  let id = "";
  host._applyProduction("create brush", [], options.expectedVersion, (document, nextId) => {
    const proposed = parseBrushDefinition({
      ...definition,
      id: definition.id ?? "brush:pending",
      version: 1,
    });
    id = definition.id ?? nextId("brush");
    document.brushes.push({ ...proposed, id });
  });
  return id;
}

export function reviseBrush(
  host: Host,
  id: Id,
  changes: Partial<Omit<BrushPreset, "id" | "version">>,
  options: MutationOptions = {},
): number {
  let version = 0;
  host._applyProduction("revise brush", [id], options.expectedVersion, (document) => {
    const index = document.brushes.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error(`Brush not found: ${id}`);
    const current = document.brushes[index]!;
    version = current.version + 1;
    const proposed = parseBrushDefinition({ ...current, ...changes, id, version });
    document.brushes[index] = proposed;
  });
  return version;
}

export function duplicateBrush(
  host: Host,
  id: Id,
  name: string,
  options: MutationOptions = {},
): Id {
  const source = brush(host, id);
  const { id: _id, version: _version, ...definition } = source;
  return createBrush(host, { ...definition, name }, options);
}
