import type { Id } from "./primitives.js";

export interface PageOptions {
  limit?: number;
  offset?: number;
}

export interface ObjectQuery extends PageOptions {
  name?: string;
  kind?: string;
  panelId?: Id;
  parentId?: Id;
  id?: Id;
}

export interface ObjectSummary {
  id: Id;
  kind: string;
  name: string;
  panelId?: Id;
  parentId?: Id;
  nameTruncated?: true;
}

export interface ObjectPageQuery extends Omit<ObjectQuery, "offset"> {
  cursor?: string;
}

export interface ObjectPage {
  version: number;
  items: ObjectSummary[];
  nextCursor?: string;
}
