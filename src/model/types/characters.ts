import type { Transform } from "./primitives.js";

export interface CharacterInstanceOptions {
  id: string;
  targetAnimationId: string;
  rootLayerId: string;
  name?: string;
  parentLayerId?: string;
  /** Required when the destination has a composite graph; identifies its receiving source node. */
  compositeSourceId?: string;
  frameOffset?: number;
  /** Additional placement around the copied character; source pose keys stay intact. */
  transform?: Partial<Transform>;
}

export interface CharacterInstanceResult {
  instanceId: string;
  sourceAnimationId: string;
  targetAnimationId: string;
  sourceRootLayerId: string;
  identities: { sourceId: string; copyId: string }[];
}
