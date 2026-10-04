import { z } from "zod";
import { validatePixels } from "../drawing/pixels.js";
import {isDrawingColor,isVectorFill} from "../drawing/color.js";
import type {LayerKeyframe,CameraKeyframe,VectorFill} from "./types.js";

const finite = z.number().finite();
const color=z.string().refine(isDrawingColor,"Invalid drawing color; use a supported CSS color or transparent");
const point = z.object({
  x: finite,
  y: finite,
  pressure: finite.min(0).max(1).optional(),
  time: finite.min(0).optional(),
  tiltX: finite.min(-90).max(90).optional(),
  tiltY: finite.min(-90).max(90).optional(),
  rotation: finite.optional(),
});

const transform = z.object({
  x: finite,
  y: finite,
  scaleX: finite,
  scaleY: finite,
  rotation: finite,
});

export const brush = z.object({
  provenance: z.object({source:z.string(),author:z.string().optional(),license:z.string(),redistribution:z.enum(["allowed","unknown","forbidden"]),resourceChecksum:z.string()}).optional(),
  paperTexture: z.object({width:z.number().int().min(1).max(512),height:z.number().int().min(1).max(512),alpha:z.array(finite.min(0).max(1)).max(262144),scale:finite.positive(),strength:finite.min(0).max(1)}).optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().positive(),
  tip: z.discriminatedUnion("kind", [
    z.object({ kind: z.enum(["round", "ellipse", "chisel", "rake"]), aspect: finite.min(0.05).max(1), angle: finite, rotationMode: z.enum(["fixed", "stroke", "stylus"]) }),
    z.object({ kind: z.literal("bitmap"), width: z.number().int().min(1).max(512), height: z.number().int().min(1).max(512), alpha: z.array(finite.min(0).max(1)).max(262144), angle: finite, rotationMode: z.enum(["fixed", "stroke", "stylus"]), sourceAssetId: z.string().optional() }),
  ]),
  size: finite.positive(),
  opacity: finite.min(0).max(1),
  flow: finite.min(0).max(1),
  hardness: finite.min(0.01).max(1),
  spacing: finite.min(0.02).max(4),
  taperStart: finite.min(0).max(1),
  taperEnd: finite.min(0).max(1),
  texture: z.enum(["none", "graphite", "charcoal", "dry-brush"]),
  textureStrength: finite.min(0).max(1),
  dynamics: z.object({
    pressureSize: finite.min(0).max(1),
    pressureOpacity: finite.min(0).max(1),
    speedSize: finite.min(-1).max(1),
    speedOpacity: finite.min(-1).max(1),
    tiltShape: finite.min(0).max(1),
    pressureSpacing: finite.min(-1).max(1),
    pressureHardness: finite.min(-1).max(1),
    rotationJitter: finite.min(0).max(1),
  }),
});

export const brushParameterSchema = z.toJSONSchema(brush);

const elementMatrix=z.tuple([finite,finite,finite,finite,finite,finite]);
const rasterStroke = z.object({
  matrix:elementMatrix.optional(),
  reveal: z.object({startFrame: z.number().int().nonnegative(), endFrame: z.number().int().nonnegative()})
    .refine(r => r.endFrame > r.startFrame, "Reveal end must follow start").optional(),
  kind: z.literal("raster-stroke"), id: z.string(), name: z.string().optional(),
  points: z.array(point).min(1), brush, color, opacity: finite.min(0).max(1),
  erase: z.boolean(), seed: z.number().int(), visible: z.boolean(),
});
const vectorStroke = z.object({
  matrix:elementMatrix.optional(),
  kind: z.literal("vector-stroke"), id: z.string(), name: z.string().optional(),
  points: z.array(point).min(1), color, width: finite.positive(),
  opacity: finite.min(0).max(1), taperStart: finite.min(0).max(1),
  taperEnd: finite.min(0).max(1), pressureSize: finite.min(0).max(1),
  closed: z.boolean(), fill: color.optional(), visible: z.boolean(),
});
const pathCommand = z.discriminatedUnion("op", [
  z.object({ op: z.literal("M"), x: finite, y: finite }),
  z.object({ op: z.literal("L"), x: finite, y: finite }),
  z.object({ op: z.literal("C"), x1: finite, y1: finite, x2: finite, y2: finite, x: finite, y: finite }),
  z.object({ op: z.literal("Q"), x1: finite, y1: finite, x: finite, y: finite }),
  z.object({ op: z.literal("Z") }),
]);
const vectorPath = z.object({
  matrix:elementMatrix.optional(),
  kind: z.literal("vector-path"), id: z.string(), name: z.string().optional(),
  commands: z.array(pathCommand), fill: z.custom<VectorFill>(isVectorFill,"Invalid drawing color or vector fill: check gradient coordinates and ordered color stops").transform(value=>structuredClone(value)).optional(), stroke: color.optional(),
  strokeWidth: finite.nonnegative(), opacity: finite.min(0).max(1), visible: z.boolean(),
});
const textElement = z.object({
  matrix:elementMatrix.optional(),
  kind: z.literal("text"), id: z.string(), name: z.string().optional(), x: finite, y: finite,
  text: z.string(), color, font: z.string(), align: z.enum(["left", "center", "right"]),
  opacity: finite.min(0).max(1), visible: z.boolean(),
});
const rasterSurface = z.object({
  kind:z.literal("raster-surface"),id:z.string(),name:z.string().optional(),
  width:finite.int().positive(),height:finite.int().positive(),
  pixels:z.instanceof(Uint8Array).transform(bytes=>new Uint8Array(bytes)),
  matrix:elementMatrix,
  opacity:finite.min(0).max(1),visible:z.boolean(),
}).superRefine((value,ctx)=>{try{validatePixels(value);}catch(error){ctx.addIssue({code:"custom",message:(error as Error).message});}});
const element = z.discriminatedUnion("kind", [rasterStroke, rasterSurface, vectorStroke, vectorPath, textElement]);
const unitInterval=finite.min(0).max(1);
const easingSchema=z.union([z.enum(["linear","ease-in-out","hold"]),z.object({
  type:z.literal("cubic-bezier"),x1:unitInterval,y1:unitInterval,x2:unitInterval,y2:unitInterval,
}).strict()]);
export const layerKeyframeSchema=z.object({
  id:z.string(),frame:z.number().int().nonnegative(),transform:transform.partial().strict(),
  opacity:finite.min(0).max(1).optional(),depth:finite.positive().optional(),easing:easingSchema,
  channelEasing:z.object(Object.fromEntries(["x","y","scaleX","scaleY","rotation","opacity","depth"].map(key=>[key,easingSchema.optional()]))).strict().optional(),
}).superRefine((key,ctx)=>{
  if(key.opacity===undefined&&key.depth===undefined&&!Object.values(key.transform).some(value=>value!==undefined))ctx.addIssue({code:"custom",message:"Layer keyframe must author at least one property"});
  for(const [channel,easing] of Object.entries(key.channelEasing??{}))if(easing!==undefined&&(channel==="opacity"||channel==="depth"?key[channel]:key.transform[channel as keyof typeof key.transform])===undefined)ctx.addIssue({code:"custom",message:`Easing requires a keyed property: ${channel}`});
}).transform((key):LayerKeyframe=>({
  id:key.id,frame:key.frame,easing:key.easing,
  transform:Object.fromEntries(Object.entries(key.transform).filter(([,value])=>value!==undefined)),
  ...(key.opacity===undefined?{}:{opacity:key.opacity}),
  ...(key.depth===undefined?{}:{depth:key.depth}),
  ...(key.channelEasing?{channelEasing:Object.fromEntries(Object.entries(key.channelEasing).filter(([,value])=>value!==undefined))}:{}),
}));
const cameraChannels=["x","y","zoom","rotation"] as const;
export const cameraKeyframeSchema=z.object({
  id:z.string(),frame:z.number().int().nonnegative(),x:finite.optional(),y:finite.optional(),
  zoom:finite.positive().optional(),rotation:finite.optional(),easing:easingSchema,
  channelEasing:z.object({x:easingSchema.optional(),y:easingSchema.optional(),zoom:easingSchema.optional(),rotation:easingSchema.optional()}).strict().optional(),
}).strict().superRefine((key,ctx)=>{
  if(!cameraChannels.some(channel=>key[channel]!==undefined))ctx.addIssue({code:"custom",message:"Camera keyframe must author at least one property"});
  for(const channel of cameraChannels)if(key.channelEasing?.[channel]!==undefined&&key[channel]===undefined)ctx.addIssue({code:"custom",message:`Easing requires a keyed property: ${channel}`});
}).transform((key):CameraKeyframe=>({
  id:key.id,frame:key.frame,easing:key.easing,
  ...Object.fromEntries(cameraChannels.filter(channel=>key[channel]!==undefined).map(channel=>[channel,key[channel]])),
  ...(key.channelEasing?{channelEasing:Object.fromEntries(Object.entries(key.channelEasing).filter(([,value])=>value!==undefined))}:{}),
}));
export const audioClipSchema=z.object({
  id:z.string(),assetId:z.string(),name:z.string(),startFrame:z.number().int().nonnegative(),
  sourceInFrame:z.number().int().nonnegative(),durationFrames:z.number().int().positive(),
  volume:finite.min(0).max(2),fadeInFrames:z.number().int().nonnegative(),fadeOutFrames:z.number().int().nonnegative(),
});
export const exposureSchema=z.object({
  startFrame:z.number().int().nonnegative(),endFrame:z.number().int().positive(),
}).refine(value=>value.endFrame>value.startFrame,{message:"Exposure end must follow start",path:["endFrame"]}).nullable();
export const transitionSchema=z.object({type:z.enum(["cut","dissolve","wipe-left","wipe-right"]),durationFrames:z.number().int().nonnegative()});
export const drawingSequenceSchema=z.array(z.object({frame:z.number().int().nonnegative(),drawingId:z.string().min(1).nullable()}).strict())
  .refine(keys=>keys.every((key,i)=>i===0||key.frame>keys[i-1]!.frame),"Drawing exposure frames must be unique and increasing");
const layerBase = {
  pivot:z.object({x:finite,y:finite}).strict().optional(),
  componentSource:z.object({id:z.string(),version:z.number().int().positive()}).optional(),
  depth: finite.positive(), exposure: exposureSchema,
  id: z.string().min(1), name: z.string(), visible: z.boolean(), opacity: finite.min(0).max(1),
  blendMode: z.enum(["source-over", "multiply", "screen", "overlay", "darken", "lighten"]),
  transform, maskLayerId: z.string().optional(), clipToBelow: z.boolean(),
  keyframes: z.array(layerKeyframeSchema),
};
export const layerChangesSchema=z.object(layerBase).pick({
  name:true,visible:true,opacity:true,blendMode:true,transform:true,clipToBelow:true,pivot:true,
}).partial().extend({maskLayerId:z.string().nullable().optional()}).strict();
export const twoBoneRigSchema=z.object({elbowId:z.string().min(1),upperLength:finite.positive(),lowerLength:finite.positive()}).strict();
const layer: z.ZodTypeAny = z.lazy(() => z.discriminatedUnion("kind", [
  z.object({ ...layerBase, kind: z.enum(["raster", "vector"]), elements: z.array(element) }),
  z.object({ ...layerBase, kind: z.literal("group"), children: z.array(layer), drawingSequence:drawingSequenceSchema.optional(),twoBoneRig:twoBoneRigSchema.optional() }),
]));

export const audioTrackSchema=z.object({id:z.string(),name:z.string(),muted:z.boolean(),locked:z.boolean(),clips:z.array(audioClipSchema)});
export const audioTrackChangesSchema=audioTrackSchema.pick({name:true,muted:true,locked:true}).partial().strict();

export const storyboardSchema = z.object({
  components:z.array(z.object({id:z.string(),name:z.string(),version:z.number().int().positive(),layers:z.array(layer)})),
  schemaVersion: z.literal(3), version: z.number().int().nonnegative(), id: z.string().min(1), title: z.string().min(1), author: z.string().optional(),
  createdAt: z.string(), updatedAt: z.string(),
  canvas: z.object({ width: finite.int().min(1).max(8192), height: finite.int().min(1).max(8192), background: color }),
  seed: z.number().int(), frameRate: finite.positive(), idCounter: z.number().int().nonnegative(),
  sequences:z.array(z.object({id:z.string(),name:z.string(),sceneIds:z.array(z.string())})),
  scenes: z.array(z.object({ id: z.string(), sequenceId:z.string(), name: z.string(), shotIds: z.array(z.string()) })),
  shots: z.array(z.object({
    id: z.string(), sceneId: z.string(), name: z.string(), panelIds: z.array(z.string()),
    cameraKeyframes: z.array(cameraKeyframeSchema),
  })),
  panels: z.array(z.object({
    id: z.string(), shotId: z.string(), number: z.string(), title: z.string(),
    width: finite.positive(), height: finite.positive(), durationFrames: z.number().int().positive(),
    startFrame: z.number().int().nonnegative(), transition: transitionSchema,
    status: z.enum(["working", "review", "approved"]),
    action: z.string(), dialogue: z.string(), camera: z.string(), notes: z.string(),
    layers: z.array(layer), motion: z.array(z.object({ id: z.string(), label: z.string(), from: point, to: point, color })),
    revision: z.number().int().nonnegative(),
  })),
  brushes: z.array(brush),
  assets: z.array(z.object({
    id: z.string(), kind: z.enum(["image", "audio"]), name: z.string(), path: z.string(), mimeType: z.string(),
    source: z.enum(["linked", "managed"]), checksum: z.string().optional(),
  })),
  audioTracks: z.array(audioTrackSchema),
  comments: z.array(z.object({
    id: z.string(), author: z.string(), body: z.string(), status: z.enum(["open", "resolved"]),
    anchor: z.object({ panelId: z.string().optional(), layerId: z.string().optional(), elementId: z.string().optional(), frame: z.number().int().nonnegative().optional(), x: finite.optional(), y: finite.optional() }),
    createdAt: z.string(), resolvedAt: z.string().optional(),
  })),
  locks: z.array(z.object({ id: z.string(), targetType: z.enum(["project", "panel", "layer"]), targetId: z.string(), owner: z.string(), reason: z.string(), createdAt: z.string() })),
  changes: z.array(z.object({ id: z.string(), version: z.number().int().nonnegative(), actor: z.string(), operation: z.string(), targetIds: z.array(z.string()), timestamp: z.string() })),
  metadata: z.record(z.string(), z.string()),
});
