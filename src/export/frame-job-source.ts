import { resolve } from "node:path";
import { ProjectStore } from "../storage/store.js";
import { CodeboardError } from "../model/errors.js";
import { fingerprint } from "../core/edit-plan/fingerprint.js";
import type { FrameJobManifest } from "./frame-job-contract.js";

export function readJobSource(path: string) {
  const store = ProjectStore.open(path);
  try {
    return store.readDocument();
  } finally {
    store.close();
  }
}

export function matchingJobSource(manifest: FrameJobManifest, sourcePath?: string) {
  const document = readJobSource(resolve(sourcePath ?? manifest.source.path));
  if (
    document.id !== manifest.source.projectId ||
    document.version !== manifest.source.version ||
    fingerprint(document) !== manifest.source.documentHash
  )
    throw new CodeboardError("REVISION_CONFLICT", "Frame job source content differs");
  return document;
}
