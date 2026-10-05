import type { CoordinateOptions } from "../coordinates.js";
import type { ObjectPageQuery, ObjectPage } from "../../model/types.js";
import type { Id, ObjectQuery, PageOptions } from "../../model/types.js";
import type { ProductionHost } from "./host.js";

type Host = Pick<
  ProductionHost,
  | "_coordinates"
  | "_findObjects"
  | "_inspectProject"
  | "_queryObjects"
  | "_readChanges"
  | "_summarizeProject"
>;

export function find(host: Host, query: ObjectQuery = {}) {
  return host._findObjects(query);
}

export function query(host: Host, query: ObjectPageQuery = {}): ObjectPage {
  return host._queryObjects(query);
}

export function summary(host: Host) {
  return host._summarizeProject();
}

export function coordinates(host: Host, targetId: Id, options: CoordinateOptions = {}) {
  return host._coordinates(targetId, options);
}

export function inspect(host: Host) {
  return host._inspectProject();
}

export function changesSince(host: Host, version: number, options: PageOptions = {}) {
  return host._readChanges(version, options);
}
