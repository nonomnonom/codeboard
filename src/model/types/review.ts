import type { Id } from "./primitives.js";

export interface ReviewComment {
  id: Id;
  author: string;
  body: string;
  status: "open" | "resolved";
  anchor: { panelId?: Id; layerId?: Id; elementId?: Id; frame?: number; x?: number; y?: number };
  createdAt: string;
  resolvedAt?: string;
}

export interface ProjectLock {
  id: Id;
  targetType: "project" | "panel" | "layer";
  targetId: Id;
  owner: string;
  reason: string;
  createdAt: string;
}

export interface ChangeEntry {
  id: Id;
  version: number;
  actor: string;
  operation: string;
  targetIds: Id[];
  timestamp: string;
}
