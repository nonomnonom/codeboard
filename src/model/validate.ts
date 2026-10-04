import {validateTwoBoneRig} from "../animation/ik.js";
import type { AudioClip, BrushPreset, GroupLayer, Layer, StoryboardDocument } from "./types.js";
import {brush,storyboardSchema} from "./schema.js";

export function parseBrushDefinition(input:unknown):BrushPreset{
  const definition=brush.parse(input) as BrushPreset;
  validateBrushResources(definition,definition.id);
  return definition;
}

export function parseStoryboardDocument(input:unknown):StoryboardDocument{
  const document=storyboardSchema.parse(input) as StoryboardDocument;
  assertUniqueIds(document);
  validateRelationships(document);
  return document;
}

export function validateAudioFades(clip:AudioClip):void{
  if(clip.fadeInFrames+clip.fadeOutFrames>clip.durationFrames)throw new Error(`Audio fades overlap: ${clip.id}`);
}

export function validateLayerDependencies(layers:ReadonlyMap<string,Layer>):void{
  const visiting=new Set<string>(),visited=new Set<string>();
  const visit=(id:string):void=>{
    if(visiting.has(id))throw new Error(`Circular layer dependency: ${id}`);
    if(visited.has(id))return;
    const layer=layers.get(id);
    if(!layer)throw new Error(`Missing layer dependency: ${id}`);
    visiting.add(id);
    if(layer.maskLayerId!==undefined)visit(layer.maskLayerId);
    if(layer.kind==="group")for(const child of layer.children)visit(child.id);
    visiting.delete(id);visited.add(id);
  };
  for(const id of layers.keys())visit(id);
}

export function validateKeyframePositions(items:{frame:number}[],owner:string):void{
  if(new Set(items.map(k=>k.frame)).size!==items.length)throw new Error(`Duplicate keyframe position in ${owner}`);
}

function validateBrushResources(brush:BrushPreset,owner:string):void{
  const {tip,paperTexture}=brush;
  if(tip.kind==="bitmap"&&tip.alpha.length!==tip.width*tip.height)throw new Error(`Invalid bitmap tip in ${owner}`);
  if(paperTexture&&paperTexture.alpha.length!==paperTexture.width*paperTexture.height)throw new Error(`Invalid paper texture in ${owner}`);
}

export function validateDrawingSequence(layer:GroupLayer):void{
 if(layer.drawingSequence===undefined)return;
 if(layer.twoBoneRig)throw new Error("Unbind the two-bone rig before selecting drawing alternatives at its root");
 const ids=new Set(layer.children.map(child=>child.id));
 for(const key of layer.drawingSequence)if(key.drawingId!==null&&!ids.has(key.drawingId))throw new Error(`Drawing exposure in ${layer.id} references a non-child layer: ${key.drawingId}`);
 if(layer.children.some(child=>child.clipToBelow))throw new Error(`Drawing alternatives in ${layer.id} cannot clip to another alternative; put clipping layers inside a drawing group`);
}

function validateArtwork(entries:Layer[]):void{
  const layers=new Map(identityLayers(entries).map(layer=>[layer.id,layer]));
  validateLayerDependencies(layers);
  for(const layer of layers.values()){
    if(!entries.includes(layer)&&layer.keyframes.some(key=>key.depth!==undefined))throw new Error(`Depth keyframes require a top-level plane: ${layer.id}`);
    validateKeyframePositions(layer.keyframes,layer.id);
    if(layer.kind==="group"&&layer.twoBoneRig)validateTwoBoneRig(layer,layer.twoBoneRig);
    if(layer.kind==="group")validateDrawingSequence(layer);
    if(layer.kind!=="group")for(const element of layer.elements){
      if((element.kind==="raster-stroke"||element.kind==="raster-surface")!==(layer.kind==="raster"))throw new Error(`Element ${element.id} is incompatible with ${layer.kind} layer`);
      if(element.kind==="raster-stroke"){
        validateBrushResources(element.brush,element.id);
        for(let i=1;i<element.points.length;i++)if((element.points[i]!.time??0)<(element.points[i-1]!.time??0))throw new Error(`Stroke ${element.id} has decreasing pen timestamps`);
      }
    }
  }
}

export function validateRelationships(d: StoryboardDocument): void {
  const fail = (message: string): never => { throw new Error(message); };
  const seenShots = new Set<string>();
  const sceneOrder=d.sequences.flatMap(s=>s.sceneIds);
  if(new Set(sceneOrder).size!==sceneOrder.length||JSON.stringify(sceneOrder)!==JSON.stringify(d.scenes.map(s=>s.id)))fail("Sequence scene order/ownership is invalid");
  for(const s of d.scenes)if(!d.sequences.some(q=>q.id===s.sequenceId&&q.sceneIds.includes(s.id)))fail(`Missing sequence for ${s.id}`);
  const seenPanels = new Set<string>();
  let cursor = 0;
  for (const scene of d.scenes) for (const shotId of scene.shotIds) {
    const shot = d.shots.find(s => s.id === shotId);
    if (!shot || shot.sceneId !== scene.id || seenShots.has(shotId)) fail(`Invalid shot ownership: ${shotId}`);
    seenShots.add(shotId);
    validateKeyframePositions(shot!.cameraKeyframes, shotId);
    for (const panelId of shot!.panelIds) {
      const p = d.panels.find(p => p.id === panelId);
      if (!p || p.shotId !== shotId || seenPanels.has(panelId)) fail(`Invalid panel ownership: ${panelId}`);
      seenPanels.add(panelId);
      if (p!.startFrame !== cursor) fail(`Panel ${panelId} must start at frame ${cursor}; found ${p!.startFrame}`);
      cursor += p!.durationFrames;
      if (p!.transition.durationFrames >= p!.durationFrames) fail(`Transition exceeds panel ${panelId}`);
      validateArtwork(p!.layers);
    }
  }
  if (seenShots.size !== d.shots.length || seenPanels.size !== d.panels.length) fail("Orphaned shot or panel");
  const allLayers=d.panels.flatMap(p=>identityLayers(p.layers));
  const sourceLayers=d.components.flatMap(c=>identityLayers(c.layers));
  for(const l of [...allLayers,...sourceLayers])if(l.componentSource&&!d.components.some(c=>c.id===l.componentSource!.id&&c.version>=l.componentSource!.version))fail(`Missing component source: ${l.id}`);
  for(const comment of d.comments){
    if(comment.anchor.panelId&&!d.panels.some(p=>p.id===comment.anchor.panelId))fail(`Missing comment panel: ${comment.id}`);
    if(comment.anchor.layerId&&!allLayers.some(l=>l.id===comment.anchor.layerId))fail(`Missing comment layer: ${comment.id}`);
    if(comment.anchor.elementId&&!allLayers.some(l=>l.kind!=="group"&&l.elements.some(e=>e.id===comment.anchor.elementId)))fail(`Missing comment element: ${comment.id}`);
  }
  for(const lock of d.locks)if(lock.targetType==="project"?lock.targetId!==d.id:lock.targetType==="panel"?!d.panels.some(p=>p.id===lock.targetId):!allLayers.some(l=>l.id===lock.targetId))fail(`Missing lock target: ${lock.id}`);
  for(const component of d.components)validateArtwork(component.layers);
  for(const brush of d.brushes)validateBrushResources(brush,brush.id);
  for (const track of d.audioTracks) for (const clip of track.clips) {
    if (!d.assets.some(a => a.id === clip.assetId && a.kind === "audio")) fail(`Missing audio asset: ${clip.assetId}`);
    validateAudioFades(clip);
  }
}

function identityLayers(layers: Layer[]): Layer[] { return layers.flatMap(l=>l.kind === "group" ? [l,...identityLayers(l.children)] : [l]); }

export function assertUniqueIds(document: StoryboardDocument): void {
  const ids: string[] = [document.id];
  ids.push(...document.sequences.map(s=>s.id));
  ids.push(...document.scenes.map((item) => item.id), ...document.shots.map((item) => item.id), ...document.panels.map((item) => item.id));
  for (const panel of document.panels) {
    for (const layer of identityLayers(panel.layers)) {
      ids.push(layer.id);
      ids.push(...layer.keyframes.map((keyframe) => keyframe.id));
      if (layer.kind !== "group") ids.push(...layer.elements.map((element) => element.id));
    }
    ids.push(...panel.motion.map((motion) => motion.id));
  }
  for (const shot of document.shots) ids.push(...shot.cameraKeyframes.map((keyframe) => keyframe.id));
  ids.push(...document.assets.map((asset) => asset.id), ...document.audioTracks.map((track) => track.id));
  ids.push(...document.brushes.map((brush) => brush.id));
  for(const c of document.components){ids.push(c.id);for(const l of identityLayers(c.layers)){ids.push(l.id,...l.keyframes.map(k=>k.id));if(l.kind!=="group")ids.push(...l.elements.map(e=>e.id));}}
  for (const track of document.audioTracks) ids.push(...track.clips.map((clip) => clip.id));
  ids.push(...document.comments.map((comment) => comment.id), ...document.locks.map((lock) => lock.id), ...document.changes.map((change) => change.id));
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate stable id: ${id}`);
    seen.add(id);
  }
}
