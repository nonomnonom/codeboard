import { open, mkdir, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { StoryboardProject } from "./project.js";
import { ProjectStore } from "../storage/store.js";
import { CodeboardError } from "../model/errors.js";
import { fingerprint } from "./edit-plan/fingerprint.js";
import { createHash } from "node:crypto";

export interface ProjectMigrationReport {
  format: "codeboard-project-migration/1";
  source: string;
  target: string;
  sourceContainerVersion: number;
  targetSchemaVersion: number;
  version: number;
  documentHash: string;
  snapshotHash: string;
  preserved: { projectId: string; boardTiming: true; artworkIds: true; embeddedAssets: number };
  warnings: string[];
}

/** Copy the current saved document; never replaces a source or existing destination. */
export async function migrateProject(
  sourcePath: string,
  targetPath: string,
  options: { expectedVersion?: number } = {},
): Promise<ProjectMigrationReport> {
  const expectedVersion = options.expectedVersion;
  if (
    expectedVersion !== undefined &&
    (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Expected version must be a nonnegative safe integer",
    );
  const source = resolve(sourcePath),
    target = resolve(targetPath);
  if (source === target)
    throw new CodeboardError("INVALID_ARGUMENT", "Migration requires a new destination path");
  const store = ProjectStore.open(source);
  const sourceContainerVersion = (() => {
    try {
      return store.inspect().formatVersion;
    } finally {
      store.close();
    }
  })();
  const project = await StoryboardProject.open(source);
  if (expectedVersion !== undefined && project.version !== expectedVersion)
    throw new CodeboardError("REVISION_CONFLICT", "Snapshot source differs from expected version", {
      details: { expected: expectedVersion, actual: project.version },
    });
  const documentHash = fingerprint(project.toJSON());
  await mkdir(dirname(target), { recursive: true });
  const reservation = await open(target, "wx");
  await reservation.close();
  try {
    await project.save(target);
    const document = project.toJSON();
    const copy = ProjectStore.open(target);
    const snapshotHash = (() => {
      try {
        if (fingerprint(copy.readDocument()) !== documentHash)
          throw new Error("Copied snapshot differs from its captured document");
        const assets = document.assets.map((asset) => ({
          id: asset.id,
          sha256: createHash("sha256")
            .update(copy.readAsset(asset.id, { expectedVersion: document.version }))
            .digest("hex"),
        }));
        return fingerprint({ documentHash, assets });
      } finally {
        copy.close();
      }
    })();
    return {
      format: "codeboard-project-migration/1",
      source,
      target,
      sourceContainerVersion,
      targetSchemaVersion: document.schemaVersion,
      version: document.version,
      documentHash,
      snapshotHash,
      preserved: {
        projectId: document.id,
        boardTiming: true,
        artworkIds: true,
        embeddedAssets: document.assets.length,
      },
      warnings: [
        "This migrates the document envelope and retains the board timeline; it does not automatically convert panels into shot-local animation.",
        "Named checkpoints and request receipts remain in the original file; only the current document and its embedded media are copied.",
        "Keep the original file until visual, audio and persistence qualification is complete.",
      ],
    };
  } catch (error) {
    try {
      await unlink(target);
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        `Migration failed; inspect incomplete destination ${target}`,
      );
    }
    throw error;
  }
}
