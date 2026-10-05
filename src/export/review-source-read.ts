import { resolve } from "node:path";
import { ProjectStore } from "../storage/store.js";

/** Materialize one saved head or named revision before asynchronous review work. */
export function readReviewSourceDocument(projectPath: string, revision?: string) {
  const store = ProjectStore.open(resolve(projectPath));
  try {
    return revision === undefined ? store.readDocument() : store.readRevision(revision);
  } finally {
    store.close();
  }
}
