import type { Layer } from "./layers.js";
export interface ComponentOrigin {
  instanceId: string;
  componentId: string;
  version: number;
  source: Layer[];
  identities: { sourceId: string; copyId: string }[];
  sha256: string;
}
