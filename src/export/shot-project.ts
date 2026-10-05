import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, dirname, basename, join } from "node:path";
import { ProjectStore } from "../storage/store.js";
import { createShotSubset, type ShotSubsetOptions } from "../model/shot-subset.js";
import { collectShotDependencies } from "../model/shot-dependencies.js";
import { fingerprint } from "../model/value-fingerprint.js";
import { CodeboardError } from "../model/errors.js";
import type { CopyProjectOptions } from "../storage/copy.js";

/** Publish a single-shot native project at a new path, using pinned embedded media. */
export async function exportShotProject(
  sourcePath: string,
  animationId: string,
  destination: string,
  options: CopyProjectOptions & ShotSubsetOptions,
) {
  const { projectId, title, expectedVersion, maxBytes = 1024 * 1024 * 1024, signal } = options;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Shot export requires a nonnegative expected version",
    );
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 * 1024 * 1024)
    throw new CodeboardError("INVALID_ARGUMENT", "Shot export budget must be 1 byte to 1 GiB");
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new CodeboardError("INVALID_ARGUMENT", "Shot export signal must be an AbortSignal");
  const cancelled = () => {
    if (signal?.aborted) throw new CodeboardError("CANCELLED", "Shot project export cancelled");
  };
  cancelled();
  const target = resolve(destination),
    parent = dirname(target);
  if (target === resolve(sourcePath))
    throw new CodeboardError("INVALID_ARGUMENT", "Shot export requires a different destination");
  const source = ProjectStore.open(resolve(sourcePath));
  let directory: string | undefined;
  let failure: unknown;
  try {
    const document = source.readDocument();
    if (document.version !== expectedVersion)
      throw new CodeboardError("REVISION_CONFLICT", "Source project version differs", {
        details: { expected: expectedVersion, actual: document.version },
      });
    const subset = createShotSubset(document, animationId, {
      projectId,
      ...(title === undefined ? {} : { title }),
    });
    const sourceHash = fingerprint(document);
    subset.metadata["shotSubset.sourceDocumentHash"] = sourceHash;
    const dependencies = collectShotDependencies(subset, animationId);
    cancelled();
    await mkdir(parent, { recursive: true });
    directory = await mkdtemp(join(parent, ".codeboard-shot-"));
    const store = ProjectStore.create(join(directory, "shot.cboard"));
    try {
      const version = store.save(subset, {
        readAsset: (id) => {
          cancelled();
          return source.readAsset(id, { expectedVersion });
        },
      });
      cancelled();
      store.verify();
      const published = await store.copyTo(target, {
        expectedVersion: version,
        maxBytes,
        ...(signal === undefined ? {} : { signal }),
      });
      return {
        ...published,
        animationId,
        source: { projectId: document.id, version: document.version, documentHash: sourceHash },
        dependencyHash: dependencies.dependencyHash,
        externalFonts: dependencies.items
          .filter((entry) => entry.kind === "font")
          .map((entry) => entry.id),
      };
    } finally {
      store.close();
    }
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    source.close();
    if (
      directory &&
      dirname(directory) === parent &&
      basename(directory).startsWith(".codeboard-shot-")
    ) {
      try {
        await rm(directory, { recursive: true, force: true });
      } catch (cleanup) {
        // biome-ignore lint/correctness/noUnsafeFinally: Retain cleanup failure together with the export failure.
        throw new AggregateError(
          failure === undefined ? [cleanup] : [failure, cleanup],
          `Shot export cleanup failed: ${directory}`,
        );
      }
    }
  }
}
