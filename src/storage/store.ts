import { rollbackAfterFailure } from "./transaction.js";
import {
  readStoredHeader,
  listStoredPanels,
  readStoredPanel,
  readStoredDocument,
  readStoredFrame,
} from "./document-read.js";
import { writeDocument, writePanelUpdate } from "./document-write.js";
import { verifyContainer } from "./integrity.js";
import { parseHeader } from "./header.js";
import { openContainer, FORMAT_VERSION } from "./container.js";
import { readEmbeddedAsset, extractEmbeddedAssets, sameAssetSource } from "./assets.js";
import {
  readRevisionRecord,
  writeRevisionRecord,
  listRevisionRecords,
  readRevisionDocument,
} from "./revisions.js";
import type { Header, PanelInfo, SaveOptions, SavedRevision } from "./types.js";
import { queryCatalog } from "./catalog-query.js";
import { queryBoardPanels } from "./board-query.js";
import { queryEditorialClips } from "./editorial-query.js";
import { pageBounds } from "../model/query.js";
import { CodeboardError } from "../model/errors.js";
import { copyProjectContainer, type CopyProjectOptions } from "./copy.js";
import { fingerprint } from "../core/edit-plan/fingerprint.js";
import type { DatabaseSync } from "node:sqlite";
import type { Panel, StoryboardDocument, ObjectQuery, Asset } from "../model/types.js";
import { objectQuerySchema } from "../model/inspection/objects.js";
import { PayloadCodec } from "./codec.js";
import { randomUUID } from "node:crypto";
import { assertRenderFrame } from "../animation/frame.js";
import { parsePlan } from "../core/edit-plan/schema.js";
import { readReceipt } from "./receipts.js";
import { writePlanCommit } from "./plan-commit.js";
import type { EditPlan, CommitReceipt, CommitResult } from "../core/edit-plan/types.js";

/** SQLite owns atomic commits; immutable payloads own numeric and resource bytes. */
export class ProjectStore {
  private db: DatabaseSync;
  private codec: PayloadCodec;
  private constructor(
    readonly path: string,
    create: boolean,
  ) {
    this.db = openContainer(path, create);
    try {
      this.codec = new PayloadCodec(this.db);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  static open(path: string): ProjectStore {
    return new ProjectStore(path, false);
  }
  static create(path: string): ProjectStore {
    return new ProjectStore(path, true);
  }
  close(): void {
    this.db.close();
  }
  [Symbol.dispose](): void {
    this.close();
  }

  private snapshot<T>(work: () => T): T {
    this.db.exec("SAVEPOINT read_snapshot");
    try {
      const result = work();
      this.db.exec("RELEASE read_snapshot");
      return result;
    } catch (error) {
      rollbackAfterFailure(this.db, error, "read-snapshot");
    }
  }

  readHeader(): Header {
    return this.snapshot(() => readStoredHeader(this.db, this.codec));
  }
  private assertWritable(): void {
    if (Number(this.db.prepare("PRAGMA user_version").get()!.user_version) !== FORMAT_VERSION)
      throw new CodeboardError(
        "SCHEMA_MIGRATION_REQUIRED",
        "Legacy containers are read-only; save a migrated copy to a new path",
      );
  }
  get version(): number {
    return this.readHeader().version;
  }

  listPanels(): PanelInfo[] {
    return listStoredPanels(this.db);
  }

  /** Page saved board timing without decoding panel artwork; legacy catalogs read the header. */
  boardPanels(
    query: { limit?: number; offset?: number } = {},
    options: { expectedVersion?: number } = {},
  ) {
    const { limit, offset } = pageBounds(query);
    const expected = options.expectedVersion;
    if (expected !== undefined && (!Number.isSafeInteger(expected) || expected < 0))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Expected version must be a nonnegative safe integer",
      );
    return this.snapshot(() =>
      queryBoardPanels(this.db, limit, offset, expected, () =>
        readStoredHeader(this.db, this.codec),
      ),
    );
  }
  /** Page saved editorial clips while leaving sibling shot artwork/resources encoded. */
  editorialClips(
    sequenceId: string,
    query: { limit?: number; offset?: number } = {},
    options: { expectedVersion?: number } = {},
  ) {
    if (typeof sequenceId !== "string" || !sequenceId || sequenceId.length > 4096)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Editorial sequence ID must contain 1–4096 characters",
      );
    const { limit, offset } = pageBounds(query);
    const expected = options.expectedVersion;
    if (expected !== undefined && (!Number.isSafeInteger(expected) || expected < 0))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Expected version must be a nonnegative safe integer",
      );
    return this.snapshot(() =>
      queryEditorialClips(this.db, this.codec, sequenceId, limit, offset, expected),
    );
  }

  findObjects(
    query: { panelId?: string; name?: string; kind?: string; limit?: number; offset?: number } = {},
  ) {
    const { limit, offset } = pageBounds(query);
    return this.db
      .prepare(
        "SELECT id,panel_id AS panelId,name,kind FROM objects WHERE (? IS NULL OR panel_id=?) AND (? IS NULL OR instr(lower(name),lower(?))>0) AND (? IS NULL OR kind=?) ORDER BY panel_id,id LIMIT ? OFFSET ?",
      )
      .all(
        query.panelId ?? null,
        query.panelId ?? null,
        query.name ?? null,
        query.name ?? null,
        query.kind ?? null,
        query.kind ?? null,
        limit,
        offset,
      );
  }

  /** Saved metadata, ordered by ID. Legacy/stale catalogs fall back without modifying the file. */
  query(query: ObjectQuery = {}, options: { expectedVersion?: number } = {}) {
    const parsed = objectQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new CodeboardError("INVALID_ARGUMENT", "Invalid object query", {
        details: { issues: parsed.error.issues },
      });
    const expected = options.expectedVersion;
    if (expected !== undefined && (!Number.isSafeInteger(expected) || expected < 0))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Expected version must be a nonnegative safe integer",
      );
    const { limit, offset } = pageBounds(query);
    return this.snapshot(() =>
      queryCatalog(this.db, query, expected, limit, offset, () => this.readDocument()),
    );
  }
  readPanel(id: string, options: { revision?: string } = {}): Panel {
    return this.snapshot(() => readStoredPanel(this.db, this.codec, id, options));
  }
  /** Render context contains one decoded panel, plus timeline and small project metadata. */
  panelDocument(id: string, options: { revision?: string } = {}): StoryboardDocument {
    return this.snapshot(() => ({
      ...(options.revision
        ? parseHeader(this.codec.read(this.revision(options.revision).documentHash))
        : this.readHeader()),
      panels: [this.readPanel(id, options)],
      components: [],
      changes: [],
      studio: { animations: [], editorial: [] },
    }));
  }
  readDocument(): StoryboardDocument {
    return this.snapshot(() => readStoredDocument(this.db, this.codec));
  }
  /** Copy the entire current container, including checkpoints, receipts and embedded assets. Never overwrites. */
  async copyTo(path: string, options: CopyProjectOptions) {
    if (!Number.isSafeInteger(options.expectedVersion) || options.expectedVersion < 0)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Project copy requires a nonnegative expected version",
      );
    const document = this.readDocument();
    if (document.version !== options.expectedVersion)
      throw new CodeboardError(
        "REVISION_CONFLICT",
        "Project copy source differs from expected version",
        {
          details: { expected: options.expectedVersion, actual: document.version },
        },
      );
    return copyProjectContainer(
      this.db,
      path,
      {
        projectId: document.id,
        version: document.version,
        documentHash: fingerprint(document),
      },
      options,
    );
  }
  readAsset(id: string, options: { expectedVersion?: number; revision?: string } = {}): Buffer {
    return this.snapshot(() => {
      if (options.expectedVersion !== undefined && this.version !== options.expectedVersion)
        throw new CodeboardError(
          "REVISION_CONFLICT",
          "Embedded asset source changed since open; reopen the project before reading its assets",
          { details: { expected: options.expectedVersion, actual: this.version } },
        );
      return readEmbeddedAsset(this.db, this.codec, id, options.revision);
    });
  }
  /** Read a saved-head asset at the expected version, optionally requiring the same source declaration. */
  readAssetIfPresent(
    id: string,
    options: { expectedVersion: number; asset?: Asset },
  ): Buffer | undefined {
    if (!Number.isSafeInteger(options.expectedVersion) || options.expectedVersion < 0)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Expected asset source version must be a nonnegative safe integer",
      );
    return this.snapshot(() => {
      const header = readStoredHeader(this.db, this.codec);
      if (header.version !== options.expectedVersion)
        throw new CodeboardError(
          "REVISION_CONFLICT",
          "Embedded asset source changed since open; reopen before saving a copy",
          { details: { expected: options.expectedVersion, actual: header.version } },
        );
      const original = header.assets.find((asset) => asset.id === id);
      return original && (options.asset === undefined || sameAssetSource(original, options.asset))
        ? readEmbeddedAsset(this.db, this.codec, id)
        : undefined;
    });
  }

  /** Extract one saved snapshot using the asset writer's path and overwrite checks. */
  extractAssets(
    directory: string,
    options: { expectedVersion?: number; revision?: string } = {},
  ): void {
    if (
      options.expectedVersion !== undefined &&
      (!Number.isSafeInteger(options.expectedVersion) || options.expectedVersion < 0)
    )
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Expected extraction version must be a nonnegative safe integer",
      );
    this.snapshot(() => {
      const revision = options.revision === undefined ? undefined : this.revision(options.revision);
      const header = revision
        ? parseHeader(this.codec.read(revision.documentHash))
        : readStoredHeader(this.db, this.codec);
      if (revision && revision.version !== header.version)
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Extraction revision version differs from its header",
        );
      if (options.expectedVersion !== undefined && header.version !== options.expectedVersion)
        throw new CodeboardError(
          "REVISION_CONFLICT",
          "Asset extraction source differs from expected version",
          {
            details: { expected: options.expectedVersion, actual: header.version },
          },
        );
      extractEmbeddedAssets(directory, header.assets, (id) =>
        readEmbeddedAsset(this.db, this.codec, id, options.revision),
      );
    });
  }

  save(document: StoryboardDocument, options: SaveOptions = {}): number {
    this.assertWritable();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const version = writeDocument(this.db, this.codec, this.path, document, options);
      this.db.exec("COMMIT");
      return version;
    } catch (error) {
      rollbackAfterFailure(this.db, error);
    }
  }

  /** Receipts survive later saves, named revision restores and compaction. */
  readReceipt(requestId: string): CommitReceipt | null {
    return this.snapshot(() => readReceipt(this.db, this.codec, requestId));
  }

  _commitPlan(document: StoryboardDocument, input: EditPlan, requestId: string): CommitResult {
    this.assertWritable();
    const plan = parsePlan(input);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = writePlanCommit(this.db, this.codec, this.path, document, plan, requestId);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      rollbackAfterFailure(this.db, error);
    }
  }

  /** Targeted artwork revision. Topology and timeline edits use the full authoring session. */
  updatePanel(panel: Panel, options: { expectedVersion: number; actor?: string }): void {
    this.assertWritable();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      writePanelUpdate(this.db, this.codec, panel, options);
      this.db.exec("COMMIT");
    } catch (error) {
      rollbackAfterFailure(this.db, error);
    }
  }

  inspect() {
    return this.snapshot(() => {
      const formatVersion = Number(this.db.prepare("PRAGMA user_version").get()!.user_version);
      return {
        format: "Codeboard SQLite",
        formatVersion,
        writable: formatVersion === FORMAT_VERSION,
        version: this.version,
        panels: Number(this.db.prepare("SELECT COUNT(*) AS n FROM panels").get()!.n),
        payloads: this.db
          .prepare(
            "SELECT kind,COUNT(*) AS count,SUM(raw_size) AS rawBytes,SUM(length(data)) AS storedBytes FROM payloads GROUP BY kind",
          )
          .all(),
      };
    });
  }
  /** Decode only the current panel and, during a transition, its incoming panel. */
  frameDocument(frame: number, options: { revision?: string } = {}): StoryboardDocument {
    assertRenderFrame(frame);
    return this.snapshot(() => readStoredFrame(this.db, this.codec, frame, options));
  }

  private revision(name: string): SavedRevision {
    return readRevisionRecord(this.db, this.codec, name);
  }

  /** A named root of references, not a second copy of the project's media. */
  saveRevision(name: string, options: { expectedVersion: number }): void {
    this.assertWritable();
    if (!name.trim() || name.length > 128)
      throw new Error("Revision name must contain 1–128 characters");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (this.version !== options.expectedVersion)
        throw new CodeboardError(
          "REVISION_CONFLICT",
          "Disk version conflict while recording revision",
          { details: { expected: options.expectedVersion, actual: this.version } },
        );
      writeRevisionRecord(this.db, this.codec, name, this.version);
      this.db.exec("COMMIT");
    } catch (error) {
      rollbackAfterFailure(this.db, error);
    }
  }

  listRevisions(options: { limit?: number; offset?: number } = {}) {
    return this.snapshot(() => listRevisionRecords(this.db, this.codec, options));
  }

  readRevision(name: string): StoryboardDocument {
    return this.snapshot(() => readRevisionDocument(this.db, this.codec, name));
  }

  restoreRevision(name: string, options: { expectedVersion: number; actor?: string }): void {
    const current = this.readHeader(),
      actor = options.actor ?? "agent:local";
    if (current.version !== options.expectedVersion)
      throw new CodeboardError(
        "REVISION_CONFLICT",
        "Disk version conflict while restoring revision",
        { details: { expected: options.expectedVersion, actual: current.version } },
      );
    const lock = current.locks.find((l) => l.owner !== actor);
    if (lock) throw new Error(`Locked by ${lock.owner}: ${lock.reason}`);
    const document = this.readRevision(name);
    document.version = current.version + 1;
    document.idCounter = Math.max(current.idCounter, document.idCounter);
    document.updatedAt = new Date().toISOString();
    document.changes = this.db
      .prepare("SELECT entry FROM changes ORDER BY position")
      .all()
      .map((r) => JSON.parse(String(r.entry)));
    document.changes.push({
      id: `change:${randomUUID()}`,
      version: document.version,
      actor,
      operation: `restore revision: ${name}`,
      targetIds: [document.id],
      timestamp: document.updatedAt,
    });
    this.save(document, {
      expectedVersion: options.expectedVersion,
      readAsset: (id) => this.readAsset(id, { revision: name }),
    });
  }

  deleteRevision(name: string): void {
    this.assertWritable();
    const result = this.db.prepare("DELETE FROM roots WHERE key=?").run(`revision:${name}`);
    if (!result.changes) throw new Error(`Revision not found: ${name}`);
  }
  /** Optional maintenance, never part of a small edit. No artwork precision is changed. */
  compact(): void {
    this.assertWritable();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.exec(`
      WITH RECURSIVE live(hash) AS (
        SELECT hash FROM roots UNION SELECT hash FROM panels UNION SELECT hash FROM components UNION SELECT hash FROM assets
        UNION SELECT child FROM payload_links JOIN live ON parent=live.hash
      ) DELETE FROM payloads WHERE hash NOT IN (SELECT hash FROM live);`);
      this.db.exec("COMMIT");
    } catch (error) {
      rollbackAfterFailure(this.db, error);
    }
    this.db.exec("VACUUM");
  }
  verify(): void {
    this.snapshot(() => verifyContainer(this.db, this.codec, () => this.readDocument()));
  }
}
