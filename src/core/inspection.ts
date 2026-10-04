import {pageBounds} from "../model/query.js";
import type {Layer,ObjectQuery,ObjectSummary,StoryboardDocument} from "../model/types.js";

/** Bounded metadata traversal; source artwork is neither cloned nor returned. */
export function findObjects(document:StoryboardDocument,query:ObjectQuery):ObjectSummary[]{
  const {limit:maximum,offset}=pageBounds(query),name=query.name?.toLowerCase();
  function* layers(entries:Layer[],parentId:string,panelId?:string):Generator<ObjectSummary>{
    for(const layer of entries){
      yield {id:layer.id,kind:layer.kind,name:layer.name,parentId,...(panelId?{panelId}:{})};
      if(layer.kind==="group")yield* layers(layer.children,layer.id,panelId);
      else for(const element of layer.elements)yield {id:element.id,kind:element.kind,name:element.name??"",parentId:layer.id,...(panelId?{panelId}:{})};
    }
  }
  function* entries():Generator<ObjectSummary>{
    for(const panel of document.panels){
      if(query.panelId&&query.panelId!==panel.id)continue;
      yield {id:panel.id,kind:"panel",name:panel.title,panelId:panel.id,parentId:panel.shotId};
      yield* layers(panel.layers,panel.id,panel.id);
    }
    if(query.panelId)return;
    for(const component of document.components){
      yield {id:component.id,kind:"component",name:component.name};
      yield* layers(component.layers,component.id);
    }
    for(const asset of document.assets)yield {id:asset.id,kind:`asset:${asset.kind}`,name:asset.name};
    for(const brush of document.brushes)yield {id:brush.id,kind:"brush",name:brush.name};
    for(const track of document.audioTracks){
      yield {id:track.id,kind:"audio-track",name:track.name};
      for(const clip of track.clips)yield {id:clip.id,kind:"audio-clip",name:clip.name,parentId:track.id};
    }
  }
  const result:ObjectSummary[]=[];let skipped=0;
  for(const entry of entries()){
    if(name&&!entry.name.toLowerCase().includes(name)||query.kind&&entry.kind!==query.kind)continue;
    if(skipped++<offset)continue;
    result.push(entry);if(result.length===maximum)break;
  }
  return result;
}

export function inspectProject(document:StoryboardDocument) {
    return structuredClone({
      schemaVersion: document.schemaVersion,
      version: document.version,
      frameRate: document.frameRate,
      durationFrames: document.panels.reduce((maximum, panel) => Math.max(maximum, panel.startFrame + panel.durationFrames), 0),
      scenes: document.scenes.map((scene) => ({ ...scene, shots: scene.shotIds.map((id) => document.shots.find((shot) => shot.id === id)) })),
      sequences:document.sequences,
      assets: document.assets,
      audioTracks: document.audioTracks,
      locks: document.locks,
      openComments: document.comments.filter((comment) => comment.status === "open"),
      capabilities: {
        vectorFill:"solid-linear-radial-local-coordinates",
        rasterPainting: "working", vectorStrokeEditing: "working", vectorBooleans:"closed-contours-skia", vectorStrokeOutlining:"explicit-editable-contour-conversion", pixelRegionEditing: "rgba8-source-rectangles", pixelSelections:"polygon-color-flood-combination-gaussian-feather",pixelFill:"source-over-copy-destination-out-source-atop",
        timeline: "working", camera2d: "independent-property-keys-and-easing", layerAnimation: "independent-property-keys-and-easing", animationEasing:"linear-smoothstep-hold-bounded-cubic-bezier", layerPivots:"permanent-local-joints", twoBoneIK:"stored-cutout-rig-baked-rotation-keys", drawingSequences:"reusable-drawings-holds-blanks", audioPlacement: "working",
        multiplane:"independent-root-depth-keys-2d-parallax", audioMixdown: "ffmpeg", audioInspection:"paged-tracks-clips-and-frame-filter", animaticFrameExport: "working", movieExport: "ffmpeg",
        referenceAssets: "partial", onionSkin: "layer-selection-tint-frame-samples", coordinateInspection:"animated-local-frame-matrices", renderComparison:"premultiplied-pixel-deltas", compositionGuides:"frame-space-review-overlay", reviewLocks: "working",
      },
    } as const);
}
