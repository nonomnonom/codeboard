import type { StudioAudioTrack } from "./studio-audio.js";
import type { Layer } from "./layers.js";
import type { CameraKeyframe } from "./animation.js";
import type { RationalRate } from "../../animation/rational-time.js";
import type {
  LayerSkinInput,
  MeshAnimation,
  CurveMeshInput,
  EnvelopeMeshInput,
  ShotMeshBinding,
} from "./deformation.js";

export interface ShotRenderOptions {
  /** Override the stored shot graph; null explicitly renders the uncomposited layer stack. */
  compositing?: import("./compositing.js").ShotCompositeGraph | null;
  layerIds?: readonly string[];
  background?: "scene" | "transparent";
}

export interface ShotAnimation {
  compositing?: import("./compositing.js").ShotCompositeGraph;
  controllers?: import("./controllers.js").ShotController[];
  meshes?: ShotMeshBinding[];
  boardPanelIds?: string[];
  audio?: StudioAudioTrack[];
  id: string;
  shotId: string;
  name: string;
  frameRate: RationalRate;
  durationFrames: number;
  canvas: { width: number; height: number; background: string };
  layers: Layer[];
  cameraKeyframes: CameraKeyframe[];
}

export type ShotAnimationEdit =
  | import("./controllers.js").ShotControllerEdit
  | ({ op: "timing.retime" } & import("./shot-timing.js").ShotRetimeOptions)
  | { op: "compositing.set"; graph: import("./compositing.js").ShotCompositeGraph | null }
  | {
      op: "layer.deformation.rest.apply";
      layerId: string;
      frame: number;
      easing?: import("./animation.js").Easing;
    }
  | {
      op: "layer.skin.weights.put";
      layerId: string;
      vertexIndex: number;
      influences: LayerSkinInput["weights"][number];
    }
  | { op: "layer.skin.bind.capture"; layerId: string; frame: number }
  | { op: "layer.skin"; layerId: string; skin: LayerSkinInput | null }
  | { op: "layer.envelope"; layerId: string; envelope: EnvelopeMeshInput | null }
  | { op: "layer.envelope.key.put"; layerId: string; key: EnvelopeMeshInput["keyframes"][number] }
  | { op: "layer.envelope.key.remove"; layerId: string; frame: number }
  | { op: "layer.mesh"; layerId: string; mesh: MeshAnimation | null }
  | { op: "layer.curve"; layerId: string; curve: CurveMeshInput | null }
  | { op: "layer.curve.key.put"; layerId: string; key: CurveMeshInput["keyframes"][number] }
  | { op: "layer.curve.key.remove"; layerId: string; frame: number }
  | { op: "layer.mesh.key.put"; layerId: string; key: MeshAnimation["keyframes"][number] }
  | { op: "layer.mesh.key.remove"; layerId: string; frame: number }
  | {
      op: "layer.drawing.range";
      layerId: string;
      startFrame: number;
      endFrame: number;
      drawingId: string | null;
    }
  | {
      op: "layer.pose";
      layerId: string;
      frame: number;
      keyId: string;
      mode: "replace" | "additive";
      weight: number;
      values: Partial<Record<import("./animation.js").LayerChannel, number>>;
      easing?: import("./animation.js").Easing;
    }
  | { op: "board.link"; panelIds: string[] }
  | { op: "layer.rig.rest.capture"; layerId: string; frame: number }
  | {
      op: "layer.rig.rest.apply";
      layerId: string;
      frame: number;
      rootKeyId: string;
      elbowKeyId: string;
      easing?: import("./animation.js").Easing;
    }
  | {
      op: "layer.rig.pose";
      layerId: string;
      frame: number;
      target: { x: number; y: number };
      rootKeyId: string;
      elbowKeyId: string;
      unreachable: "reject" | "clamp";
      bend?: 1 | -1;
      easing?: import("./animation.js").Easing;
    }
  | {
      op: "layer.add";
      id: string;
      kind: "raster" | "vector" | "group";
      name: string;
      options?: Omit<import("./layers.js").LayerOptions, "id">;
      parentId?: string;
      beforeId?: string;
    }
  | { op: "layer.move"; layerId: string; parentId: string | null; beforeId?: string }
  | { op: "layer.remove"; layerId: string }
  | { op: "layer.rig"; layerId: string; definition: import("./animation.js").TwoBoneRig | null }
  | { op: "layer.depth"; layerId: string; depth: number }
  | { op: "layer.set"; layerId: string; changes: import("./layers.js").LayerChanges }
  | { op: "layer.exposure"; layerId: string; exposure: Layer["exposure"] }
  | {
      op: "layer.drawings";
      layerId: string;
      keys: import("./animation.js").DrawingExposure[] | null;
    }
  | { op: "layer.key.put"; layerId: string; key: import("./animation.js").LayerKeyframe }
  | { op: "layer.key.remove"; layerId: string; id: string }
  | { op: "camera.key.put"; key: CameraKeyframe }
  | { op: "camera.key.remove"; id: string };
