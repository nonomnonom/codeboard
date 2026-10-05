import {
  prepareComponentUpgrade,
  type ComponentUpgradeOptions,
} from "../model/component-upgrade.js";
import { boundQueryResponse } from "../model/query.js";
import {
  shotControllerData,
  type ShotControllerQuery,
} from "../animation/controller-inspection.js";
import { studioSchema } from "../model/schema/studio.js";
import { DocumentCopyState, type MutationScope } from "./project/document-copies.js";
import { reviseShotAnimation } from "../animation/shot-edit.js";
import { shotCoordinates } from "../animation/coordinates.js";
import { shotPointCoordinates, type ShotPointOptions } from "../animation/shot-points.js";
import { shotMeshData, type ShotMeshQuery } from "../animation/mesh-inspection.js";
import { defineStudioAudio } from "../audio/studio.js";
import { reviseEditorialSequence } from "../animation/editorial-edit.js";
import {
  capturePanelAnimation,
  type PanelCaptureResult,
  type PanelCaptureOptions,
} from "./project/capture.js";
import {
  duplicateShotAnimation,
  type ShotDuplicateOptions,
  type ShotDuplicateResult,
} from "./project/duplicate-shot.js";
import * as structure from "./project/structure.js";
import * as studioOperations from "./project/studio.js";
import { defineShotAnimation } from "../animation/shot.js";
import { defineEditorialSequence } from "../animation/editorial.js";
import type { ShotAnimation } from "../model/types/shot.js";
import type { EditorialSequence, EditorialEdit } from "../model/types/editorial.js";
import * as artwork from "./project/artwork.js";
import { createProjectDocument, configureProjectDocument } from "./project/configuration.js";
import * as reads from "./project/reads.js";
import { reviseScript } from "./project/script.js";
import * as paletteOperations from "./project/palettes.js";
import { paletteSchema, colorBindingSchema, colorChannelSchema } from "../model/schema/palettes.js";
import type { Palette, ColorChannel, ColorBinding } from "../model/types/palettes.js";
import type { ScriptInput } from "../model/types/script.js";
import { allLayers, findDrawingLayer } from "../model/layers.js";
import { assertEditableTargets, assertLocksUnchanged } from "../model/locks.js";
import { coordinateSpace, type CoordinateOptions } from "./coordinates.js";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import { CodeboardError } from "../model/errors.js";
import { fingerprint } from "./edit-plan/fingerprint.js";
import { createPlan, parsePlan } from "./edit-plan/schema.js";
import { executePlan } from "./edit-plan/execute.js";
import type { EditCommand, EditPlan, CommitResult } from "./edit-plan/types.js";
import { readPixelRegion } from "../drawing/pixel-buffer.js";
import { ProjectStore } from "../storage/store.js";
import { difference, applyRevision, type Revision } from "./history.js";
import type {
  AudioClipQuery,
  DrawingElement,
  Id,
  Layer,
  LayerChanges,
  LayerOptions,
  MotionAnnotation,
  NewDrawingElement,
  Panel,
  PanelOptions,
  ProjectOptions,
  ProjectChanges,
  Scene,
  StoryboardDocument,
  ObjectQuery,
  PageOptions,
} from "../model/types.js";
import { storyboardSchema } from "../model/schema/project.js";
import {
  LayerHandle,
  PanelHandle,
  SceneHandle,
  Selection,
  ShotHandle,
  SequenceHandle,
} from "./handles.js";
import {
  assertUniqueIds,
  validateRelationships,
  parseStoryboardDocument,
} from "../model/validation/document.js";
import { ProductionTools } from "./production.js";
import type { ProductionScope } from "./production/host.js";
import { findObjects, inspectProject, queryObjects, summarizeProject } from "./inspection.js";
import type { ObjectPageQuery } from "../model/types.js";
import { assertDrawingColors } from "../drawing/color.js";

const clone = <T>(value: T): T => structuredClone(value);
const now = () => new Date().toISOString();

export class StoryboardProject {
  #document: StoryboardDocument;
  #querySession = randomUUID();
  #queryGeneration = 0;
  #undo: Revision[] = [];
  #redo: Revision[] = [];
  #transactionDepth = 0;
  #transactionTargets = new Set<Id>();
  #copies = new DocumentCopyState();
  #savedVersions = new Map<string, number>();
  #assetPath: string | undefined;
  readonly production: ProductionTools;

  private constructor(
    document: StoryboardDocument,
    readonly actor = "agent:local",
  ) {
    this.#document = document;
    this.production = new ProductionTools(this);
  }

  static create(options: ProjectOptions): StoryboardProject {
    return StoryboardProject.fromJSON(createProjectDocument(options));
  }

  static fromJSON(input: unknown, options: { actor?: string } = {}): StoryboardProject {
    return new StoryboardProject(parseStoryboardDocument(input), options.actor ?? "agent:local");
  }

  static async open(path: string, options: { actor?: string } = {}): Promise<StoryboardProject> {
    const store = ProjectStore.open(path);
    try {
      const project = new StoryboardProject(store.readDocument(), options.actor ?? "agent:local");
      project.#savedVersions.set(resolve(path), project.version);
      project.#assetPath = resolve(path);
      return project;
    } finally {
      store.close();
    }
  }

  get id(): string {
    return this.#document.id;
  }
  get title(): string {
    return this.#document.title;
  }
  get canUndo(): boolean {
    return this.#undo.length > 0;
  }
  get canRedo(): boolean {
    return this.#redo.length > 0;
  }
  get version(): number {
    return this.#document.version;
  }

  toJSON(): StoryboardDocument {
    return clone(this.#document);
  }

  previewComponentUpgrade(instanceId: string, options: ComponentUpgradeOptions = {}) {
    const prepared = prepareComponentUpgrade(this.#document, instanceId, options);
    return boundQueryResponse(
      {
        version: this.version,
        instanceId,
        sourceVersion: prepared.source.version,
        owner: prepared.owner,
        inputHash: prepared.inputHash,
        conflictsResolved: prepared.layers !== null,
        ...prepared.report,
      },
      "Component upgrade preview",
    );
  }

  componentOriginData(instanceId: string, options: PageOptions = {}) {
    return reads.readComponentOrigin(this.#document, instanceId, options);
  }

  shotDependencyData(animationId: string, options: PageOptions = {}) {
    return reads.readShotDependencies(this.#document, animationId, options);
  }

  get studio(): import("../model/types/studio.js").StudioContent {
    return clone(this.#document.studio);
  }

  boardPanels(options: PageOptions = {}) {
    return reads.readBoardPanels(this.#document, options);
  }

  #shotAnimation(id: string): ShotAnimation {
    const animation = this.#document.studio.animations.find((item) => item.id === id);
    if (!animation) throw new CodeboardError("INVALID_ARGUMENT", `Shot animation not found: ${id}`);
    return animation;
  }

  shotAnimation(id: string): ShotAnimation {
    return clone(this.#shotAnimation(id));
  }

  editorialSequence(id: string): EditorialSequence {
    const sequence = this.#document.studio.editorial.find((item) => item.id === id);
    if (!sequence)
      throw new CodeboardError("INVALID_ARGUMENT", `Editorial sequence not found: ${id}`);
    return clone(sequence);
  }

  shotCoordinates(animationId: string, targetId: string, options: CoordinateOptions = {}) {
    return shotCoordinates(this.#shotAnimation(animationId), targetId, options);
  }

  shotControllerData(
    animationId: string,
    controllerId: string,
    query: ShotControllerQuery = { collection: "keyframes" },
  ) {
    return shotControllerData(this.#shotAnimation(animationId), controllerId, query);
  }

  shotMeshData(
    animationId: string,
    layerId: string,
    query: ShotMeshQuery = { collection: "keyframes" },
  ) {
    return shotMeshData(this.#shotAnimation(animationId), layerId, query);
  }

  shotPointCoordinates(
    animationId: string,
    targetId: string,
    point: { x: number; y: number },
    options: ShotPointOptions,
  ) {
    return shotPointCoordinates(this.#shotAnimation(animationId), targetId, point, options);
  }

  editorialClips(sequenceId: string, options: PageOptions = {}) {
    return reads.readEditorialClips(this.#document, sequenceId, options);
  }

  scriptSummary() {
    return reads.readScriptSummary(this.#document);
  }

  palettes(options: PageOptions = {}) {
    return reads.readPalettes(this.#document, options);
  }

  paletteSwatches(id: string, options: PageOptions = {}) {
    return reads.readPaletteSwatches(this.#document, id, options);
  }

  paletteBindings(swatchId: string, options: PageOptions = {}) {
    return reads.readPaletteBindings(this.#document, swatchId, options);
  }

  putPalette(palette: Palette): this {
    const parsed = paletteSchema.parse(palette);
    this.#mutate("put palette", [parsed.id], () =>
      paletteOperations.putPalette(this.#document, parsed),
    );
    return this;
  }

  removePalette(id: string): this {
    this.#mutate("remove palette", [id], () => paletteOperations.removePalette(this.#document, id));
    return this;
  }

  setColorBinding(elementId: string, channel: ColorChannel, binding: ColorBinding | null): this {
    const parsedChannel = colorChannelSchema.parse(channel);
    const parsedBinding = colorBindingSchema.nullable().parse(binding);
    this.#mutate("set color binding", [elementId], () =>
      paletteOperations.setColorBinding(this.#document, elementId, parsedChannel, parsedBinding),
    );
    return this;
  }

  scriptEntries(options: PageOptions = {}) {
    return reads.readScriptEntries(this.#document, options);
  }

  replaceScript(input: ScriptInput, expectedRevision: number) {
    const result = reviseScript(this.#document.studio.script, input, expectedRevision);
    if (result.changed)
      this.#mutate(
        "replace script",
        [
          result.script.id,
          ...result.report.added,
          ...result.report.removed,
          ...result.report.updated.map((entry) => entry.id),
        ],
        () => {
          this.#document.studio.script = result.script;
        },
      );
    return result.report;
  }

  shotBoardPanels(animationId: string, options: PageOptions = {}) {
    return reads.readShotBoardPanels(this.#document, animationId, options);
  }

  studioAudioTracks(ownerId: string, options: PageOptions = {}) {
    return reads.readStudioAudioTracks(this.#document, ownerId, options);
  }

  studioAudioClips(ownerId: string, trackId: string, options: PageOptions = {}) {
    return reads.readStudioAudioClips(this.#document, ownerId, trackId, options);
  }

  addShotElement(animationId: string, layerId: string, element: DrawingElement): this {
    this.#mutate("add shot element", [animationId, layerId, element.id], () =>
      studioOperations.addShotElement(this.#document, animationId, layerId, element),
    );
    return this;
  }

  removeShotElements(animationId: string, layerId: string, ids: readonly string[]): this {
    this.#mutate("remove shot elements", [animationId, layerId, ...ids], () =>
      studioOperations.removeShotElements(this.#document, animationId, layerId, ids),
    );
    return this;
  }

  reviseShotElement(
    animationId: string,
    layerId: string,
    id: string,
    element: DrawingElement,
  ): this {
    this.#mutate("revise shot element", [animationId, layerId, id], () =>
      studioOperations.reviseShotElement(this.#document, animationId, layerId, id, element),
    );
    return this;
  }

  patchShotPixels(
    animationId: string,
    layerId: string,
    id: string,
    x: number,
    y: number,
    patch: import("../model/types.js").PixelBuffer,
  ): this {
    this.#mutate("patch shot pixels", [animationId, layerId, id], () =>
      studioOperations.patchShotPixels(this.#document, animationId, layerId, id, x, y, patch),
    );
    return this;
  }

  setStudio(content: import("../model/types/studio.js").StudioContent): this {
    const proposed = clone(studioSchema.parse(content)) as StoryboardDocument["studio"];
    this.#mutate("replace studio content", [this.id], () => {
      this.#document.studio = proposed;
    });
    return this;
  }

  capturePanelAnimation(panelId: string, options: PanelCaptureOptions): PanelCaptureResult {
    let result: PanelCaptureResult | undefined;
    this.#mutate("capture panel animation", [panelId, options.id], () => {
      result = capturePanelAnimation(
        this.#document,
        (prefix) => this.#nextId(prefix),
        panelId,
        options,
      );
    });
    return result!;
  }

  duplicateShotAnimation(
    sourceAnimationId: string,
    options: ShotDuplicateOptions,
  ): ShotDuplicateResult {
    let result: ShotDuplicateResult | undefined;
    this.#mutate(
      "duplicate shot animation",
      [sourceAnimationId, options.id, options.shotId],
      () => {
        result = duplicateShotAnimation(
          this.#document,
          (prefix) => this.#nextId(prefix),
          sourceAnimationId,
          options,
        );
      },
    );
    return result!;
  }

  editShotAnimation(
    id: string,
    edits: readonly import("../model/types/shot.js").ShotAnimationEdit[],
  ): this {
    const proposed = reviseShotAnimation(this.shotAnimation(id), edits);
    this.#mutate("edit shot animation", [id], () =>
      studioOperations.putShotAnimation(this.#document, proposed),
    );
    return this;
  }

  putShotAnimation(animation: ShotAnimation): this {
    const proposed = defineShotAnimation(animation);
    this.#mutate("put shot animation", [proposed.id, proposed.shotId], () =>
      studioOperations.putShotAnimation(this.#document, proposed),
    );
    return this;
  }

  putEditorialSequence(sequence: EditorialSequence): this {
    const proposed = defineEditorialSequence(sequence, this.#document.studio.animations);
    this.#mutate("put editorial sequence", [proposed.id], () =>
      studioOperations.putEditorialSequence(this.#document, proposed),
    );
    return this;
  }

  editStudioAudio(
    ownerId: string,
    edits: readonly import("../model/types/studio-audio.js").StudioAudioEdit[],
  ): this {
    this.#mutate("edit studio audio", [ownerId], () =>
      studioOperations.editStudioAudio(this.#document, ownerId, edits),
    );
    return this;
  }

  setStudioAudio(
    ownerId: string,
    tracks: readonly import("../model/types/studio-audio.js").StudioAudioTrack[],
  ): this {
    const proposed = defineStudioAudio(tracks);
    this.#mutate("set studio audio", [ownerId], () =>
      studioOperations.setStudioAudio(this.#document, ownerId, proposed),
    );
    return this;
  }

  editEditorial(id: string, edits: readonly EditorialEdit[]): this {
    const proposed = reviseEditorialSequence(
      this.editorialSequence(id),
      this.#document.studio.animations,
      edits,
    );
    this.#mutate("edit editorial sequence", [id], () =>
      studioOperations.putEditorialSequence(this.#document, proposed),
    );
    return this;
  }

  removeShotAnimation(id: string): this {
    this.#mutate("remove shot animation", [id], () =>
      studioOperations.removeStudioObject(this.#document, "animation", id),
    );
    return this;
  }

  removeEditorialSequence(id: string): this {
    this.#mutate("remove editorial sequence", [id], () =>
      studioOperations.removeStudioObject(this.#document, "editorial", id),
    );
    return this;
  }

  /** Validate serializable changes on an isolated draft, without changing this session. */
  plan(label: string, commands: EditCommand[]): EditPlan {
    if (this.#transactionDepth)
      throw new CodeboardError("INVALID_ARGUMENT", "Create plans outside authoring transactions");
    const body = {
      format: "codeboard-edit-plan/1" as const,
      projectId: this.id,
      actor: this.actor,
      baseVersion: this.version,
      baseHash: fingerprint(this.#document),
      label,
      commands,
    };
    const plan = createPlan(body);
    executePlan(StoryboardProject.fromJSON(this.#document, { actor: this.actor }), plan);
    return plan;
  }

  /** Atomically save a plan and its receipt to this session's existing .cboard. */
  async commit(input: EditPlan, options: { requestId: string }): Promise<CommitResult> {
    if (this.#transactionDepth || !this.#assetPath)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Commit requires a saved project outside an authoring transaction",
      );
    const plan = parsePlan(input);
    if (plan.actor !== this.actor || plan.projectId !== this.id)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Plan actor and project must match this session",
      );
    const store = ProjectStore.open(this.#assetPath);
    try {
      const existing = store.readReceipt(options.requestId);
      if (existing) {
        if (existing.digest !== plan.digest)
          throw new CodeboardError(
            "REQUEST_ID_REUSED",
            "Request ID was already committed with a different plan",
            { details: { requestId: options.requestId } },
          );
        return { receipt: existing, replayed: true };
      }
      if (
        this.#savedVersions.get(this.#assetPath) !== this.version ||
        this.version !== plan.baseVersion ||
        fingerprint(this.#document) !== plan.baseHash
      )
        throw new CodeboardError(
          "REVISION_CONFLICT",
          "Session differs from the saved plan base; save or reopen before planning",
          { details: { expected: plan.baseVersion, actual: this.version } },
        );
      const draft = StoryboardProject.fromJSON(this.#document, { actor: this.actor });
      executePlan(draft, plan);
      const result = store._commitPlan(draft.#document, plan, options.requestId);
      if (!result.replayed) {
        this.#undo.push(difference(this.#document, draft.#document));
        if (this.#undo.length > 32) this.#undo.shift();
        this.#redo = [];
        this.#document = draft.#document;
        this.#savedVersions.set(this.#assetPath, result.receipt.committedVersion);
        this.#queryGeneration++;
      }
      return result;
    } finally {
      store.close();
    }
  }

  _findObjects(query: ObjectQuery) {
    return findObjects(this.#document, query);
  }
  _queryObjects(query: ObjectPageQuery) {
    return queryObjects(
      this.#document,
      query,
      `${this.#querySession}:${this.version}:${this.#queryGeneration}`,
    );
  }
  _summarizeProject() {
    return summarizeProject(this.#document);
  }

  _coordinates(targetId: Id, options: CoordinateOptions) {
    return coordinateSpace(this.#document, targetId, options);
  }

  _inspectProject() {
    return inspectProject(this.#document);
  }

  _readChanges(version: number, options: PageOptions) {
    return reads.readChanges(this.#document, version, options);
  }

  _readBrush(id: Id) {
    return reads.readBrush(this.#document, id);
  }

  _readLock(id: Id) {
    return reads.readLock(this.#document, id);
  }

  _readLayer(id: Id): Layer {
    return reads.readLayer(this.#document, id);
  }

  _readLayerKeyframes(id: Id, options: PageOptions) {
    return reads.readLayerKeyframes(this.#document, id, options);
  }

  _readCameraKeyframes(id: Id, options: PageOptions) {
    return reads.readCameraKeyframes(this.#document, id, options);
  }

  _readTwoBoneRig(id: Id) {
    return reads.readTwoBoneRig(this.#document, id);
  }

  _readDrawingSequence(id: Id) {
    return reads.readDrawingSequence(this.#document, id);
  }

  _readAudioTracks(options: PageOptions) {
    return reads.readAudioTracks(this.#document, options);
  }

  _readAudioClips(trackId: Id, options: AudioClipQuery) {
    return reads.readAudioClips(this.#document, trackId, options);
  }

  _readAudioClip(id: Id) {
    return reads.readAudioClip(this.#document, id);
  }

  _readRenderPanels(ids: readonly Id[]): Pick<StoryboardDocument, "canvas" | "panels" | "shots"> {
    return reads.readRenderPanels(this.#document, ids);
  }

  _readRenderFrame(frame: number): Pick<StoryboardDocument, "canvas" | "panels" | "shots"> {
    return reads.readRenderFrame(this.#document, frame);
  }

  _readDrawingExposures(id: Id, options: PageOptions) {
    return reads.readDrawingExposures(this.#document, id, options);
  }

  _readDrawingAlternatives(id: Id, options: PageOptions) {
    return reads.readDrawingAlternatives(this.#document, id, options);
  }

  _readDrawingNeighbors(id: Id, frame: number, skipBlank: boolean) {
    return reads.readDrawingNeighbors(this.#document, id, frame, skipBlank);
  }

  _readElement(id: Id): DrawingElement {
    return reads.readElement(this.#document, id);
  }

  readAsset(id: string): Buffer {
    return this.captureAssetReader()(id);
  }

  /** Capture the saved media source independently of later session saves or Save As. */
  captureAssetReader(): (id: string) => Buffer {
    if (!this.#assetPath)
      throw new Error(
        "Unsaved project assets require assetRoot; save the project to embed them first",
      );
    const path = this.#assetPath,
      expectedVersion = this.#savedVersions.get(path)!;
    return (id: string) => {
      const store = ProjectStore.open(path);
      try {
        return store.readAsset(id, { expectedVersion });
      } finally {
        store.close();
      }
    };
  }

  async save(
    path: string,
    options: { overwrite?: boolean; expectedVersion?: number; assetRoot?: string } = {},
  ): Promise<void> {
    if (this.#transactionDepth > 0)
      throw new Error(
        "Cannot save during an authoring transaction; save after the transaction commits",
      );
    const store = ProjectStore.create(path);
    try {
      const expected = options.expectedVersion ?? this.#savedVersions.get(resolve(path));
      const committedVersion = store.save(this.#document, {
        ...options,
        ...(expected === undefined ? {} : { expectedVersion: expected }),
        ...(this.#assetPath && this.#assetPath !== resolve(path)
          ? {
              readAsset: (id: string) => {
                const original = ProjectStore.open(this.#assetPath!);
                try {
                  return original.readAssetIfPresent(id, {
                    expectedVersion: this.#savedVersions.get(this.#assetPath!)!,
                    asset: this.#document.assets.find((asset) => asset.id === id)!,
                  });
                } finally {
                  original.close();
                }
              },
            }
          : {}),
      });
      this.#document.version = committedVersion;
      this.#savedVersions.set(resolve(path), this.version);
      this.#assetPath = resolve(path);
    } finally {
      store.close();
    }
  }

  transaction<T>(label: string, work: () => T): T {
    if (work.constructor.name === "AsyncFunction")
      throw new Error("Transactions must be synchronous; load assets before authoring");
    if (this.#transactionDepth > 0) return work();
    const before = this.#document;
    this.#document = { ...before, panels: before.panels.slice(), changes: before.changes.slice() };
    this.#copies.reset();
    this.#transactionTargets.clear();
    this.#transactionDepth += 1;
    try {
      const result = work();
      if (result && typeof (result as { then?: unknown }).then === "function")
        throw new Error("Transactions must not return a Promise");
      this.#normalizePanelRevisions(before);
      this.#validate();
      assertLocksUnchanged(before, this.#document, this.actor);
      const revision = difference(before, this.#document);
      this.#document.updatedAt = now();
      this.#recordChange(label, [
        ...this.#transactionTargets,
        ...this.#document.panels
          .filter(
            (p) =>
              !isDeepStrictEqual(
                p,
                before.panels.find((old) => old.id === p.id),
              ),
          )
          .map((p) => p.id),
      ]);
      this.#undo.push(revision);
      if (this.#undo.length > 32) this.#undo.shift();
      this.#redo = [];
      return result;
    } catch (error) {
      this.#document = before;
      if (error instanceof CodeboardError) throw error;
      throw new Error(
        `Transaction "${label}" failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.#transactionDepth -= 1;
    }
  }

  undo(): boolean {
    if (this.#transactionDepth > 0)
      throw new Error(
        "Cannot undo during an authoring transaction; finish or cancel the transaction first",
      );
    const previous = this.#undo.at(-1);
    if (!previous) return false;
    this.#restoreHistory(previous, "before");
    this.#undo.pop();
    this.#redo.push(previous);
    return true;
  }

  redo(): boolean {
    if (this.#transactionDepth > 0)
      throw new Error(
        "Cannot redo during an authoring transaction; finish or cancel the transaction first",
      );
    const next = this.#redo.at(-1);
    if (!next) return false;
    this.#restoreHistory(next, "after");
    this.#redo.pop();
    this.#undo.push(next);
    return true;
  }

  #restoreHistory(revision: Revision, direction: "before" | "after"): void {
    const current = this.#document;
    const restored = { ...applyRevision(current, revision, direction) };
    restored.version = current.version;
    restored.changes = current.changes.slice();
    restored.idCounter = Math.max(current.idCounter, restored.idCounter);
    restored.updatedAt = now();
    this.#document = restored;
    try {
      this.#recordChange(direction === "before" ? "undo" : "redo", []);
    } catch (error) {
      this.#document = current;
      throw error;
    }
  }

  setMetadata(key: string, value: string): this {
    this.#mutate(
      "set metadata",
      [this.id],
      () => {
        this.#document.metadata[key] = value;
      },
      "metadata",
    );
    return this;
  }

  configure(changes: ProjectChanges): this {
    const validated = configureProjectDocument(this.#document, changes);
    assertLocksUnchanged(this.#document, validated, this.actor);
    if (isDeepStrictEqual(this.#document, validated)) return this;
    this.#mutate("configure project", [this.id], () => {
      this.#document = validated;
    });
    return this;
  }

  addScene(name: string, id?: Id): SceneHandle {
    return this._addScene("sequence:main", name, id);
  }

  addSequence(name: string, id?: Id): SequenceHandle {
    let sequenceId = "";
    this.#mutate("add sequence", [this.id], () => {
      sequenceId = structure.addSequence(
        this.#document,
        (prefix) => this.#nextId(prefix),
        name,
        id,
      );
    });
    return new SequenceHandle(this, sequenceId);
  }

  _addScene(sequenceId: Id, name: string, id?: Id): SceneHandle {
    let sceneId = "";
    this.#mutate("add scene", [this.id], () => {
      sceneId = structure.addScene(
        this.#document,
        (prefix) => this.#nextId(prefix),
        sequenceId,
        name,
        id,
      );
    });
    return new SceneHandle(this, sceneId);
  }

  scene(id: Id): SceneHandle {
    this.#getScene(id);
    return new SceneHandle(this, id);
  }

  panel(id: Id): PanelHandle {
    this.#getPanel(id);
    return new PanelHandle(this, id);
  }

  panelCaptions(id: Id) {
    return reads.readPanelCaptions(this.#document, id);
  }

  select(query: { panelId: Id; layerId?: Id; elementIds?: Id[] }): Selection {
    return new Selection(this, query.panelId, query.layerId, query.elementIds ?? []);
  }

  #mutate(
    operation: string,
    targetIds: Id[],
    work: () => void,
    scope: MutationScope = "document",
  ): void {
    this.#assertEditableTargets(targetIds);
    if (this.#transactionDepth > 0) {
      this.#queryGeneration++;
      this.#copies.prepare(this.#document, scope);
      targetIds.forEach((id) => {
        this.#transactionTargets.add(id);
      });
      work();
      return;
    }
    this.transaction(operation, () => this.#mutate(operation, targetIds, work, scope));
  }

  #nextId(prefix: string): string {
    if (!Number.isSafeInteger(this.#document.idCounter + 1))
      throw new CodeboardError("RESOURCE_LIMIT", "Project ID counter is exhausted", {
        details: { reason: "PROJECT_ID_LIMIT", idCounter: this.#document.idCounter },
      });
    const id = `${prefix}:${this.#document.idCounter}`;
    this.#document.idCounter += 1;
    return id;
  }

  #validate(): void {
    storyboardSchema.parse(this.#document);
    assertUniqueIds(this.#document);
    validateRelationships(this.#document);
  }

  #normalizePanelRevisions(before: StoryboardDocument): void {
    for (const panel of this.#document.panels) {
      const previous = before.panels.find((p) => p.id === panel.id);
      if (!isDeepStrictEqual(panel, previous)) panel.revision = (previous?.revision ?? 0) + 1;
    }
  }

  #recordChange(operation: string, targetIds: Id[]): void {
    if (!Number.isSafeInteger(this.#document.version + 1))
      throw new CodeboardError("RESOURCE_LIMIT", "Project version counter is exhausted", {
        details: { reason: "PROJECT_VERSION_LIMIT", version: this.#document.version },
      });
    const id = this.#nextId("change");
    this.#document.version += 1;
    this.#document.changes.push({
      id,
      version: this.#document.version,
      actor: this.actor,
      operation,
      targetIds: [...targetIds],
      timestamp: now(),
    });
  }

  #getScene(id: Id): Scene {
    const scene = this.#document.scenes.find((entry) => entry.id === id);
    if (!scene) throw new Error(`Scene not found: ${id}`);
    return scene;
  }

  #getPanel(id: Id): Panel {
    const panel = this.#document.panels.find((entry) => entry.id === id);
    if (!panel) throw new Error(`Panel not found: ${id}`);
    return panel;
  }

  _addShot(sceneId: Id, name: string, id?: Id): ShotHandle {
    let shotId = "";
    this.#mutate("add shot", [sceneId], () => {
      shotId = structure.addShot(
        this.#document,
        (prefix) => this.#nextId(prefix),
        sceneId,
        name,
        id,
      );
    });
    return new ShotHandle(this, shotId);
  }

  _addPanel(shotId: Id, options: PanelOptions): PanelHandle {
    let panelId = "";
    this.#mutate("add panel", [shotId], () => {
      panelId = structure.addPanel(
        this.#document,
        (prefix) => this.#nextId(prefix),
        shotId,
        options,
      );
    });
    return new PanelHandle(this, panelId);
  }

  _addLayer(
    panelId: Id,
    kind: "raster" | "vector" | "group",
    name: string,
    options: LayerOptions,
    parentGroupId?: Id,
  ): LayerHandle {
    let id = "";
    this.#assertEditable(panelId);
    this.#mutate(
      "add layer",
      [panelId],
      () => {
        id = artwork.addLayer(
          this.#document,
          (prefix) => this.#nextId(prefix),
          panelId,
          kind,
          name,
          options,
          parentGroupId,
        );
      },
      { panelId },
    );
    return new LayerHandle(this, panelId, id);
  }

  _addElement(panelId: Id, layerId: Id, element: NewDrawingElement): Id {
    let id = "";
    this.#assertEditable(panelId, layerId);
    assertDrawingColors(element);
    this.#mutate(
      "add drawing element",
      [panelId, layerId],
      () => {
        id = artwork.addElement(
          this.#document,
          (prefix) => this.#nextId(prefix),
          panelId,
          layerId,
          element,
        );
      },
      { panelId },
    );
    return id;
  }

  _addMotion(panelId: Id, annotation: Omit<MotionAnnotation, "id"> & { id?: Id }): Id {
    let id = "";
    this.#assertEditable(panelId);
    assertDrawingColors(annotation);
    this.#mutate(
      "add motion annotation",
      [panelId],
      () => {
        id = artwork.addMotion(
          this.#document,
          (prefix) => this.#nextId(prefix),
          panelId,
          annotation,
        );
      },
      { panelId },
    );
    return id;
  }

  _updatePanel(
    panelId: Id,
    changes: Partial<
      Pick<Panel, "title" | "durationFrames" | "action" | "dialogue" | "camera" | "notes">
    >,
  ): void {
    this.#assertEditable(panelId);
    this.#mutate(
      "update panel",
      [panelId],
      () => {
        structure.updatePanel(this.#document, panelId, changes);
      },
      changes.durationFrames === undefined ? { panelId } : "document",
    );
  }

  _updateLayer(panelId: Id, layerId: Id, changes: LayerChanges): void {
    this.#assertEditable(panelId, layerId);
    this.#mutate(
      "update layer",
      [panelId, layerId],
      () => {
        artwork.updateLayer(this.#document, panelId, layerId, changes);
      },
      { panelId },
    );
  }

  _updateElement(
    panelId: Id,
    layerId: Id,
    elementId: Id,
    updater: (element: DrawingElement) => DrawingElement,
  ): void {
    this._updateElements(panelId, layerId, [elementId], updater);
  }

  _updateElements(
    panelId: Id,
    layerId: Id,
    elementIds: Id[],
    updater: (element: DrawingElement) => DrawingElement,
  ): void {
    this.#assertEditable(panelId, layerId);
    const selected = new Set(elementIds);
    if (!selected.size) throw new Error("Element update requires at least one target");
    this.#mutate(
      "update drawing elements",
      [panelId, layerId, ...selected],
      () => {
        artwork.updateElements(this.#document, panelId, layerId, selected, updater);
      },
      { panelId },
    );
  }

  _readPixels(
    panelId: Id,
    layerId: Id,
    elementId: Id,
    region?: import("../model/types.js").PixelRegion,
  ): import("../model/types.js").PixelBuffer {
    const element = findDrawingLayer(this.#getPanel(panelId), layerId).elements.find(
      (e) => e.id === elementId,
    );
    if (element?.kind !== "raster-surface")
      throw new Error(`Element ${elementId} is not a pixel surface`);
    return readPixelRegion(
      element,
      region ?? { x: 0, y: 0, width: element.width, height: element.height },
    );
  }

  _remove(panelId: Id, layerId?: Id, elementIds: Id[] = []): void {
    this.#assertEditable(panelId, layerId);
    this.#mutate(
      "remove drawing elements",
      [panelId, ...(layerId ? [layerId] : []), ...elementIds],
      () => {
        artwork.remove(this.#document, panelId, layerId, elementIds);
      },
      { panelId },
    );
  }

  _applyProduction(
    operation: string,
    targetIds: Id[],
    expectedVersion: number | undefined,
    work: (document: StoryboardDocument, nextId: (prefix: string) => Id) => void,
    scope?: ProductionScope,
  ): void {
    if (expectedVersion !== undefined && expectedVersion !== this.version) {
      throw new CodeboardError(
        "REVISION_CONFLICT",
        `Version conflict: expected ${expectedVersion}, current ${this.version}`,
        { details: { expected: expectedVersion, actual: this.version } },
      );
    }
    this.#assertEditableTargets(targetIds);
    let panelId: Id | undefined;
    if (scope && !("shotId" in scope) && !("audio" in scope)) {
      if ("panelId" in scope) panelId = scope.panelId;
      else {
        panelId = this.#document.panels.find((panel) =>
          allLayers(panel.layers).some((layer) => layer.id === scope.layerId),
        )?.id;
        if (!panelId) throw new Error(`Layer not found: ${scope.layerId}`);
      }
      this.#assertEditableTargets([panelId]);
    }
    this.#mutate(
      operation,
      targetIds,
      () => work(this.#document, (prefix) => this.#nextId(prefix)),
      panelId
        ? { panelId }
        : scope && "shotId" in scope
          ? scope
          : scope && "audio" in scope
            ? "audio"
            : "document",
    );
  }

  #assertEditable(panelId?: Id, layerId?: Id): void {
    this.#assertEditableTargets([...(panelId ? [panelId] : []), ...(layerId ? [layerId] : [])]);
  }

  #assertEditableTargets(targetIds: Id[]): void {
    assertEditableTargets(this.#document.locks, this.actor, targetIds);
  }
}
