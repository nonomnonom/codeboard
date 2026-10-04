export type Id = string;
export interface PageOptions {limit?:number;offset?:number}
export interface ObjectQuery extends PageOptions {name?:string;kind?:string;panelId?:Id}
export interface ObjectSummary {id:Id;kind:string;name:string;panelId?:Id;parentId?:Id}
export type AffineMatrix = [number, number, number, number, number, number];
interface ElementPlacement { matrix?: AffineMatrix }

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
  tiltX?: number;
  tiltY?: number;
  rotation?: number;
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface Pivot { x:number; y:number }

export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten";

export type TextureKind = "none" | "graphite" | "charcoal" | "dry-brush";

export interface BrushDynamics {
  pressureSize: number;
  pressureOpacity: number;
  speedSize: number;
  speedOpacity: number;
  tiltShape: number;
  pressureSpacing: number;
  pressureHardness: number;
  rotationJitter: number;
}

export type BrushTip =
  | { kind: "round" | "ellipse" | "chisel" | "rake"; aspect: number; angle: number; rotationMode: "fixed" | "stroke" | "stylus" }
  | { kind: "bitmap"; width: number; height: number; alpha: number[]; angle: number; rotationMode: "fixed" | "stroke" | "stylus"; sourceAssetId?: Id };

export interface BrushPreset {
  provenance?: { source: string; author?: string; license: string; redistribution: "allowed"|"unknown"|"forbidden"; resourceChecksum: string };
  paperTexture?: { width: number; height: number; alpha: number[]; scale: number; strength: number };
  id: Id;
  name: string;
  version: number;
  tip: BrushTip;
  size: number;
  opacity: number;
  flow: number;
  hardness: number;
  spacing: number;
  taperStart: number;
  taperEnd: number;
  texture: TextureKind;
  textureStrength: number;
  dynamics: BrushDynamics;
}

export interface RasterStroke extends ElementPlacement {
  /** Global timeline frames: blank at startFrame, complete at endFrame. */
  reveal?: { startFrame: number; endFrame: number };
  kind: "raster-stroke";
  id: Id;
  name?: string;
  points: Point[];
  brush: BrushPreset;
  color: string;
  opacity: number;
  erase: boolean;
  seed: number;
  visible: boolean;
}

export interface PixelBuffer { width: number; height: number; pixels: Uint8Array }
export interface PixelRegion { x: number; y: number; width: number; height: number }
/** Straight-alpha, sRGB RGBA8 pixels; matrix maps source pixels into layer coordinates. */
export interface RasterSurface extends PixelBuffer {
  kind: "raster-surface";
  id: Id;
  name?: string;
  matrix: AffineMatrix;
  opacity: number;
  visible: boolean;
}

export interface VectorStroke extends ElementPlacement {
  kind: "vector-stroke";
  id: Id;
  name?: string;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  taperStart: number;
  taperEnd: number;
  pressureSize: number;
  closed: boolean;
  fill?: string;
  visible: boolean;
}

export type VectorFill = string | {
  kind:"linear";from:{x:number;y:number};to:{x:number;y:number};stops:{offset:number;color:string}[];
} | {
  kind:"radial";from:{x:number;y:number;radius:number};to:{x:number;y:number;radius:number};stops:{offset:number;color:string}[];
};

export interface VectorPath extends ElementPlacement {
  kind: "vector-path";
  id: Id;
  name?: string;
  commands: PathCommand[];
  fill?: VectorFill;
  stroke?: string;
  strokeWidth: number;
  opacity: number;
  visible: boolean;
}

export interface TextElement extends ElementPlacement {
  kind: "text";
  id: Id;
  name?: string;
  x: number;
  y: number;
  text: string;
  color: string;
  font: string;
  align: "left" | "center" | "right";
  opacity: number;
  visible: boolean;
}

export type PathCommand =
  | { op: "M" | "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: "Q"; x1: number; y1: number; x: number; y: number }
  | { op: "Z" };

export type DrawingElement = RasterStroke | RasterSurface | VectorStroke | VectorPath | TextElement;
export type NewDrawingElement =
  | (Omit<RasterStroke, "id"> & { id?: Id })
  | (Omit<RasterSurface, "id"> & { id?: Id })
  | (Omit<VectorStroke, "id"> & { id?: Id })
  | (Omit<VectorPath, "id"> & { id?: Id })
  | (Omit<TextElement, "id"> & { id?: Id });

interface LayerBase {
  pivot?: Pivot;
  componentSource?: { id: Id; version: number };
  id: Id;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: Transform;
  maskLayerId?: Id;
  clipToBelow: boolean;
  keyframes: LayerKeyframe[];
  depth: number;
  exposure: { startFrame: number; endFrame: number } | null;
}

export interface DrawingLayer extends LayerBase {
  kind: "raster" | "vector";
  elements: DrawingElement[];
}

export interface GroupLayer extends LayerBase {
  kind: "group";
  children: Layer[];
  drawingSequence?: DrawingExposure[];
  twoBoneRig?: TwoBoneRig;
}

export interface TwoBoneRig { elbowId:Id; upperLength:number; lowerLength:number }

export interface DrawingExposure { frame: number; drawingId: Id | null }
export interface DrawingInterval { startFrame:number; endFrame:number; drawingId:Id|null }
export interface DrawingNeighbors { current:DrawingInterval; previous:DrawingInterval|null; next:DrawingInterval|null }

export type Layer = DrawingLayer | GroupLayer;

export type LayerChanges = Partial<Pick<Layer, "name" | "visible" | "opacity" | "blendMode" | "transform" | "clipToBelow" | "pivot">> & { maskLayerId?: Id | null };

export interface MotionAnnotation {
  id: Id;
  label: string;
  from: Point;
  to: Point;
  color: string;
}

export interface Panel {
  id: Id;
  shotId: Id;
  number: string;
  title: string;
  width: number;
  height: number;
  durationFrames: number;
  startFrame: number;
  transition: Transition;
  status: "working" | "review" | "approved";
  action: string;
  dialogue: string;
  camera: string;
  notes: string;
  layers: Layer[];
  motion: MotionAnnotation[];
  revision: number;
}

export interface Shot {
  id: Id;
  sceneId: Id;
  name: string;
  panelIds: Id[];
  cameraKeyframes: CameraKeyframe[];
}

export interface Scene {
  sequenceId: Id;
  id: Id;
  name: string;
  shotIds: Id[];
}

export interface Sequence { id:Id; name:string; sceneIds:Id[] }

export interface StoryboardDocument {
  components: DrawingComponent[];
  schemaVersion: 3;
  version: number;
  id: Id;
  title: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  canvas: { width: number; height: number; background: string };
  seed: number;
  frameRate: number;
  idCounter: number;
  scenes: Scene[];
  sequences: Sequence[];
  shots: Shot[];
  panels: Panel[];
  brushes: BrushPreset[];
  assets: Asset[];
  audioTracks: AudioTrack[];
  comments: ReviewComment[];
  locks: ProjectLock[];
  changes: ChangeEntry[];
  metadata: Record<string, string>;
}

export interface DrawingComponent { id: Id; name: string; version: number; layers: Layer[] }

export interface ProjectOptions {
  id?: Id;
  title: string;
  author?: string;
  width?: number;
  height?: number;
  background?: string;
  seed?: number;
  frameRate?: number;
}

export interface PanelOptions {
  id?: Id;
  number?: string;
  title?: string;
  width?: number;
  height?: number;
  durationFrames?: number;
  action?: string;
  dialogue?: string;
  camera?: string;
  notes?: string;
}

export interface LayerOptions {
  pivot?: Pivot;
  depth?: number;
  exposure?: { startFrame: number; endFrame: number };
  id?: Id;
  opacity?: number;
  blendMode?: BlendMode;
  transform?: Partial<Transform>;
  maskLayerId?: Id;
  clipToBelow?: boolean;
  visible?: boolean;
}

export interface StrokeOptions {
  reveal?: { startFrame: number; endFrame: number };
  id?: Id;
  name?: string;
  color?: string;
  opacity?: number;
  erase?: boolean;
  seed?: number;
}

export interface VectorStrokeOptions extends StrokeOptions {
  width?: number;
  taperStart?: number;
  taperEnd?: number;
  pressureSize?: number;
  closed?: boolean;
  fill?: string;
}

export interface SheetOptions {
  columns?: number;
  rows?: number;
  pageWidth?: number;
  pageHeight?: number;
  margin?: number;
  gutter?: number;
  captionHeight?: number;
}

export interface Transition {
  type: "cut" | "dissolve" | "wipe-left" | "wipe-right";
  durationFrames: number;
}

export type Easing = "linear" | "ease-in-out" | "hold" | {
  type: "cubic-bezier";
  x1: number; y1: number; x2: number; y2: number;
};

export type CameraChannel = "x" | "y" | "zoom" | "rotation";
export interface CameraKeyframe {
  id: Id;
  frame: number;
  x?: number;
  y?: number;
  zoom?: number;
  rotation?: number;
  easing: Easing;
  channelEasing?: Partial<Record<CameraChannel, Easing>>;
}

export interface LayerKeyframe {
  id: Id;
  frame: number;
  transform: Partial<Transform>;
  opacity?: number;
  depth?: number;
  easing: Easing;
  channelEasing?: Partial<Record<LayerChannel, Easing>>;
}

export type LayerChannel = keyof Transform | "opacity" | "depth";

export interface Asset {
  id: Id;
  kind: "image" | "audio";
  name: string;
  path: string;
  mimeType: string;
  source: "linked" | "managed";
  checksum?: string;
}

export interface AudioClip {
  id: Id;
  assetId: Id;
  name: string;
  startFrame: number;
  sourceInFrame: number;
  durationFrames: number;
  volume: number;
  fadeInFrames: number;
  fadeOutFrames: number;
}

export interface AudioTrack {
  id: Id;
  name: string;
  muted: boolean;
  locked: boolean;
  clips: AudioClip[];
}
export interface AudioTrackSummary extends Omit<AudioTrack,"clips"> { clipCount:number }
export interface AudioClipQuery extends PageOptions { frame?:number; assetId?:Id }

export interface ReviewComment {
  id: Id;
  author: string;
  body: string;
  status: "open" | "resolved";
  anchor: { panelId?: Id; layerId?: Id; elementId?: Id; frame?: number; x?: number; y?: number };
  createdAt: string;
  resolvedAt?: string;
}

export interface ProjectLock {
  id: Id;
  targetType: "project" | "panel" | "layer";
  targetId: Id;
  owner: string;
  reason: string;
  createdAt: string;
}

export interface ChangeEntry {
  id: Id;
  version: number;
  actor: string;
  operation: string;
  targetIds: Id[];
  timestamp: string;
}

export const identityTransform = (): Transform => ({
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
});
