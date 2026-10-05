import { createHash } from "node:crypto";
import { mkdir, mkdtemp, open, lstat, realpath, writeFile, rename, rm } from "node:fs/promises";
import { resolve, dirname, basename, join, extname } from "node:path";
import { ProjectStore } from "../storage/store.js";
import { CodeboardError } from "../model/errors.js";
import { iterateLayers } from "../model/layers.js";
import type { StoryboardDocument } from "../model/types.js";
import { fingerprint } from "../core/edit-plan/fingerprint.js";
import { renderIdentity } from "../runtime/render-identity.js";
import {
  parseProjectPublishManifest,
  MAX_PUBLISH_MANIFEST_BYTES,
  type ProjectPublishManifest,
} from "./project-publish-manifest.js";
import type { CopyProjectOptions } from "../storage/copy.js";
import { readPinnedFonts } from "../storage/font-files.js";
import type { FontFileDependency } from "../model/schema/font-files.js";

export interface PublishProjectOptions extends CopyProjectOptions {
  fontFiles?: FontFileDependency[];
}

function checkSignal(signal?: AbortSignal) {
  if (signal !== undefined && !(signal instanceof AbortSignal))
    throw new CodeboardError("INVALID_ARGUMENT", "Publish signal must be an AbortSignal");
  if (signal?.aborted) throw new CodeboardError("CANCELLED", "Project publish operation cancelled");
}
function fonts(document: StoryboardDocument): string[] {
  const values = new Set<string>();
  for (const owner of [...document.panels, ...document.components, ...document.studio.animations])
    for (const layer of iterateLayers(owner.layers))
      if (layer.kind !== "group")
        for (const element of layer.elements) if (element.kind === "text") values.add(element.font);
  return [...values].sort();
}
async function hashFile(path: string, maxBytes: number, signal?: AbortSignal) {
  if (!(await lstat(path)).isFile())
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Publish entries must be regular files, not links",
    );
  const file = await open(path, "r");
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size > maxBytes)
      throw new CodeboardError("RESOURCE_LIMIT", "Publish file exceeds byte budget");
    const hash = createHash("sha256"),
      buffer = Buffer.allocUnsafe(65536);
    let bytes = 0;
    while (true) {
      checkSignal(signal);
      const { bytesRead } = await file.read(buffer);
      if (!bytesRead) break;
      bytes += bytesRead;
      if (bytes > maxBytes)
        throw new CodeboardError("RESOURCE_LIMIT", "Publish file grew beyond byte budget");
      hash.update(buffer.subarray(0, bytesRead));
    }
    const after = await file.stat();
    if (bytes !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs)
      throw new CodeboardError("REVISION_CONFLICT", "Publish file changed during verification");
    return { bytes, sha256: hash.digest("hex") };
  } finally {
    await file.close();
  }
}

/** Publish a complete pinned native container; manifest.json is the completion marker. */
export async function publishProject(
  projectPath: string,
  outputRoot: string,
  options: PublishProjectOptions,
) {
  checkSignal(options.signal);
  const pinnedFonts =
    options.fontFiles === undefined ? undefined : readPinnedFonts(projectPath, options.fontFiles);
  const root = resolve(outputRoot);
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "publish-"));
  try {
    const projectFile = join(directory, "project.cboard");
    const sourceStore = ProjectStore.open(projectPath);
    let source: { projectId: string; version: number; documentHash: string };
    try {
      const { path: _path, ...identity } = await sourceStore.copyTo(projectFile, options);
      source = identity;
    } finally {
      sourceStore.close();
    }
    checkSignal(options.signal);
    const fontFiles: FontFileDependency[] = [];
    if (pinnedFonts?.length) await mkdir(join(directory, "fonts"));
    for (const [index, font] of (pinnedFonts ?? []).entries()) {
      checkSignal(options.signal);
      const path = `fonts/${index}${extname(font.path)}`;
      await writeFile(join(directory, path), font.bytes, { flag: "wx" });
      fontFiles.push({ family: font.family, path, sha256: font.sha256 });
    }
    const copy = ProjectStore.open(projectFile);
    let externalFonts: string[];
    try {
      externalFonts = fonts(copy.readDocument());
    } finally {
      copy.close();
    }
    const manifest: ProjectPublishManifest = parseProjectPublishManifest({
      format: "codeboard-project-publish/1",
      source,
      file: {
        name: "project.cboard",
        ...(await hashFile(projectFile, options.maxBytes ?? 1024 * 1024 * 1024, options.signal)),
      },
      engine: renderIdentity(),
      externalFonts,
      ...(pinnedFonts === undefined ? {} : { fontFiles }),
    });
    const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
    if (Buffer.byteLength(serialized) > MAX_PUBLISH_MANIFEST_BYTES)
      throw new CodeboardError("RESOURCE_LIMIT", "Project publish manifest exceeds 256 KiB");
    await writeFile(join(directory, "manifest.pending"), serialized, { flag: "wx" });
    checkSignal(options.signal);
    await rename(join(directory, "manifest.pending"), join(directory, "manifest.json"));
    return {
      directory,
      projectFile,
      manifest,
      manifestHash: createHash("sha256").update(serialized).digest("hex"),
    };
  } catch (error) {
    if (dirname(directory) === root && basename(directory).startsWith("publish-")) {
      try {
        await rm(directory, { recursive: true, force: true });
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], `Incomplete publish remains: ${directory}`);
      }
    }
    throw error;
  }
}

/** Verify bytes, native integrity and source identity. Fonts and renderer dependencies are not installed. */
export async function verifyProjectPublish(
  directory: string,
  options: { expectedManifestHash?: string; signal?: AbortSignal } = {},
) {
  checkSignal(options.signal);
  if (
    options.expectedManifestHash !== undefined &&
    !/^[a-f0-9]{64}$/.test(options.expectedManifestHash)
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Expected publish manifest hash must be SHA-256");
  const root = await realpath(directory),
    manifestFile = join(root, "manifest.json");
  const identity = await hashFile(manifestFile, MAX_PUBLISH_MANIFEST_BYTES, options.signal);
  if (
    options.expectedManifestHash !== undefined &&
    options.expectedManifestHash !== identity.sha256
  )
    throw new CodeboardError("ASSET_CHECKSUM_MISMATCH", "Published manifest differs from its pin");
  const file = await open(manifestFile, "r");
  let manifest: ProjectPublishManifest;
  try {
    const buffer = Buffer.alloc(MAX_PUBLISH_MANIFEST_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      checkSignal(options.signal);
      const { bytesRead } = await file.read(buffer, total, buffer.length - total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    const bytes = buffer.subarray(0, total);
    if (total > MAX_PUBLISH_MANIFEST_BYTES)
      throw new CodeboardError("RESOURCE_LIMIT", "Publish manifest exceeds 256 KiB");
    if (createHash("sha256").update(bytes).digest("hex") !== identity.sha256)
      throw new CodeboardError("REVISION_CONFLICT", "Publish manifest changed during verification");
    let input: unknown;
    try {
      input = JSON.parse(bytes.toString("utf8"));
    } catch (cause) {
      throw new CodeboardError("INVALID_ARGUMENT", "Publish manifest is not valid JSON", { cause });
    }
    manifest = parseProjectPublishManifest(input);
  } finally {
    await file.close();
  }
  const projectFile = join(root, manifest.file.name);
  if (manifest.fontFiles !== undefined) readPinnedFonts(projectFile, manifest.fontFiles);
  const actual = await hashFile(projectFile, manifest.file.bytes, options.signal);
  if (actual.bytes !== manifest.file.bytes || actual.sha256 !== manifest.file.sha256)
    throw new CodeboardError("ASSET_CHECKSUM_MISMATCH", "Published container checksum differs");
  const store = ProjectStore.open(projectFile);
  try {
    store.verify();
    const document = store.readDocument();
    if (
      document.id !== manifest.source.projectId ||
      document.version !== manifest.source.version ||
      fingerprint(document) !== manifest.source.documentHash
    )
      throw new CodeboardError("REVISION_CONFLICT", "Published project identity differs");
    if (JSON.stringify(fonts(document)) !== JSON.stringify(manifest.externalFonts))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Publish font declarations differ from the project",
      );
  } finally {
    store.close();
  }
  const after = await hashFile(projectFile, manifest.file.bytes, options.signal);
  if (after.sha256 !== actual.sha256)
    throw new CodeboardError("REVISION_CONFLICT", "Published project changed during verification");
  const runtimeMatches = JSON.stringify(renderIdentity()) === JSON.stringify(manifest.engine);
  return { directory: root, projectFile, manifest, manifestHash: identity.sha256, runtimeMatches };
}
