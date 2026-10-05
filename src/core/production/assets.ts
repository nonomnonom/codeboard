import type { Asset, Id } from "../../model/types.js";
import type { ProductionHost, MutationOptions } from "./host.js";

type Host = Pick<ProductionHost, "_applyProduction">;

export function addAsset(
  host: Host,
  asset: Omit<Asset, "id"> & { id?: Id },
  options: MutationOptions = {},
): Id {
  let id = "";
  host._applyProduction("add asset", [], options.expectedVersion, (document, nextId) => {
    id = asset.id ?? nextId("asset");
    document.assets.push({ ...asset, id });
  });
  return id;
}

export function updateAsset(
  host: Host,
  id: Id,
  changes: Partial<Omit<Asset, "id">>,
  options: MutationOptions = {},
): void {
  host._applyProduction("update asset", [id], options.expectedVersion, (document) => {
    const asset = document.assets.find((a) => a.id === id);
    if (!asset) throw new Error(`Asset not found: ${id}`);
    Object.assign(asset, structuredClone(changes));
  });
}
