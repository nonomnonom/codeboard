import type { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import type { Asset } from "../model/types.js";
import { CodeboardError } from "../model/errors.js";
import { digest, type PayloadCodec } from "./codec.js";
import type { SaveOptions } from "./types.js";
import { readRevisionRecord } from "./revisions.js";

/** Metadata edits may reuse embedded bytes; a changed source declaration must be resolved again. */
export function sameAssetSource(original: Asset | undefined, asset: Asset): boolean {
  return (
    original !== undefined &&
    original.path === asset.path &&
    original.checksum === asset.checksum &&
    original.kind === asset.kind &&
    original.mimeType === asset.mimeType
  );
}
/** Read under the caller's snapshot or write transaction. */
export function readEmbeddedAsset(
  db: DatabaseSync,
  codec: PayloadCodec,
  id: string,
  revision?: string,
): Buffer {
  const row = revision
    ? readRevisionRecord(db, codec, revision).assets.find((a) => a.id === id)
    : db.prepare("SELECT hash FROM assets WHERE id=?").get(id);
  if (!row) throw new Error(`Asset not embedded: ${id}`);
  return codec.get(String(row.hash), "asset");
}
/** Save owns the transaction; a failed source read or checksum rolls it back. */
export function embedAssets(
  db: DatabaseSync,
  codec: PayloadCodec,
  containerPath: string,
  assets: readonly Asset[],
  priorAssets: readonly Asset[] | undefined,
  options: SaveOptions,
): void {
  for (const row of db.prepare("SELECT id FROM assets").all())
    if (!assets.some((a) => a.id === row.id))
      db.prepare("DELETE FROM assets WHERE id=?").run(row.id!);
  for (const asset of assets) {
    const source = resolve(options.assetRoot ?? dirname(containerPath), asset.path);
    const previous = db.prepare("SELECT hash FROM assets WHERE id=?").get(asset.id);
    const original = priorAssets?.find((a) => a.id === asset.id);
    const unchanged = sameAssetSource(original, asset);
    if (
      previous &&
      !options.overwrite &&
      !options.readAsset &&
      options.assetRoot === undefined &&
      unchanged
    )
      continue;
    const portable = options.assetRoot === undefined ? options.readAsset?.(asset.id) : undefined;
    const bytes = portable ?? (existsSync(source) ? readFileSync(source) : undefined);
    if (!bytes)
      throw new CodeboardError("ASSET_MISSING", `Missing asset ${asset.id}: ${source}`, {
        details: { assetId: asset.id, path: source },
      });
    if (asset.checksum) {
      const actual = digest(bytes);
      if (actual !== asset.checksum)
        throw new CodeboardError(
          "ASSET_CHECKSUM_MISMATCH",
          `Asset checksum mismatch: ${asset.id}`,
          { details: { assetId: asset.id, expected: asset.checksum, actual } },
        );
    }
    db.prepare(
      "INSERT INTO assets VALUES(?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash WHERE hash<>excluded.hash",
    ).run(asset.id, codec.put("asset", bytes));
  }
}
export function extractEmbeddedAssets(
  directory: string,
  assets: readonly Asset[],
  readAsset: (id: string) => Buffer,
): void {
  const root = resolve(directory);
  for (const asset of assets) {
    const target = resolve(root, asset.path),
      rel = relative(root, target);
    if (!rel || rel.startsWith("..") || isAbsolute(rel))
      throw new Error(`Unsafe asset path: ${asset.path}`);
    const bytes = readAsset(asset.id);
    mkdirSync(dirname(target), { recursive: true });
    if (existsSync(target)) {
      if (digest(readFileSync(target)) !== digest(bytes))
        throw new Error(`Refusing to replace a different extracted asset: ${target}`);
    } else writeFileSync(target, bytes, { flag: "wx" });
  }
}
