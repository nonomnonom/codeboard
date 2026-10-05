import type { CoordinateOptions, CoordinateSpace } from "../coordinates.js";
import type { inspectProject, summarizeProject } from "../inspection.js";
import type { ObjectPageQuery, ObjectPage } from "../../model/types.js";
import type {
  AudioClip,
  AudioClipQuery,
  AudioTrackSummary,
  BrushPreset,
  CameraKeyframe,
  DrawingElement,
  Id,
  Layer,
  LayerKeyframe,
  ProjectLock,
  StoryboardDocument,
  ObjectQuery,
  ObjectSummary,
  PageOptions,
  DrawingExposure,
  DrawingNeighbors,
  TwoBoneRig,
} from "../../model/types.js";

export type ProductionScope = { panelId: Id } | { layerId: Id } | { shotId: Id } | { audio: true };

export interface ProductionHost {
  readonly actor: string;
  readonly version: number;
  _findObjects(query: ObjectQuery): ObjectSummary[];
  _queryObjects(query: ObjectPageQuery): ObjectPage;
  _summarizeProject(): ReturnType<typeof summarizeProject>;
  _coordinates(targetId: Id, options: CoordinateOptions): CoordinateSpace;
  _inspectProject(): ReturnType<typeof inspectProject>;
  _readChanges(version: number, options: PageOptions): StoryboardDocument["changes"];
  _readBrush(id: Id): BrushPreset;
  _readAudioTracks(options: PageOptions): AudioTrackSummary[];
  _readAudioClips(trackId: Id, options: AudioClipQuery): AudioClip[];
  _readAudioClip(id: Id): AudioClip & { trackId: Id };
  _readLock(id: Id): ProjectLock;
  _readLayer(id: Id): Layer;
  _readTwoBoneRig(id: Id): TwoBoneRig | null;
  _readLayerKeyframes(id: Id, options: PageOptions): LayerKeyframe[];
  _readCameraKeyframes(id: Id, options: PageOptions): CameraKeyframe[];
  _readDrawingSequence(id: Id): {
    keys: DrawingExposure[] | null;
    drawings: { id: Id; name: string; kind: Layer["kind"] }[];
  };
  _readDrawingExposures(id: Id, options: PageOptions): DrawingExposure[] | null;
  _readDrawingAlternatives(
    id: Id,
    options: PageOptions,
  ): { id: Id; name: string; kind: Layer["kind"] }[];
  _readDrawingNeighbors(id: Id, frame: number, skipBlank: boolean): DrawingNeighbors;
  _readElement(id: Id): DrawingElement;
  _applyProduction(
    operation: string,
    targetIds: Id[],
    expectedVersion: number | undefined,
    work: (document: StoryboardDocument, nextId: (prefix: string) => Id) => void,
    scope?: ProductionScope,
  ): void;
}

export interface MutationOptions {
  expectedVersion?: number;
}
