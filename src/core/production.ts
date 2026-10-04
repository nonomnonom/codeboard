import {solveTwoBoneIK,validateTwoBoneRig,validateRigLayerChange,type TwoBoneSolution} from "../animation/ik.js";
import {evaluateDrawing,evaluateLayer} from "../animation/evaluate.js";
import {assertRenderFrame} from "../animation/frame.js";
import type {CoordinateOptions,CoordinateSpace} from "./coordinates.js";
import type {inspectProject} from "./inspection.js";
import type {
  Asset, AudioClip, AudioClipQuery, AudioTrackSummary, BrushPreset, CameraKeyframe, DrawingElement, Id, Layer, LayerKeyframe, Panel, ProjectLock,
  ReviewComment, StoryboardDocument, Transform, Transition, ObjectQuery, ObjectSummary, PageOptions, DrawingExposure, DrawingNeighbors, LayerChannel, CameraChannel, TwoBoneRig, Easing,
} from "../model/types.js";
import { identityTransform } from "../model/types.js";
import { retimePanel } from "../animation/retime.js";
import {audioClipSchema,audioTrackChangesSchema,audioTrackSchema,cameraKeyframeSchema,exposureSchema,layerKeyframeSchema,transitionSchema,drawingSequenceSchema,twoBoneRigSchema} from "../model/schema.js";
import {parseBrushDefinition,validateAudioFades,validateKeyframePositions,validateLayerDependencies,validateDrawingSequence} from "../model/validate.js";

export type ProductionScope = {panelId:Id}|{layerId:Id}|{shotId:Id}|{audio:true};

export interface ProductionHost {
  readonly actor: string;
  readonly version: number;
  _findObjects(query:ObjectQuery):ObjectSummary[];
  _coordinates(targetId:Id,options:CoordinateOptions):CoordinateSpace;
  _inspectProject():ReturnType<typeof inspectProject>;
  _readChanges(version:number,options:PageOptions):StoryboardDocument["changes"];
  _readBrush(id:Id):BrushPreset;
  _readAudioTracks(options:PageOptions):AudioTrackSummary[];
  _readAudioClips(trackId:Id,options:AudioClipQuery):AudioClip[];
  _readAudioClip(id:Id):AudioClip&{trackId:Id};
  _readLock(id:Id):ProjectLock;
  _readLayer(id:Id):Layer;
  _readTwoBoneRig(id:Id):TwoBoneRig|null;
  _readLayerKeyframes(id:Id,options:PageOptions):LayerKeyframe[];
  _readCameraKeyframes(id:Id,options:PageOptions):CameraKeyframe[];
  _readDrawingSequence(id:Id):{keys:DrawingExposure[]|null;drawings:{id:Id;name:string;kind:Layer["kind"]}[]};
  _readDrawingNeighbors(id:Id,frame:number,skipBlank:boolean):DrawingNeighbors;
  _readElement(id:Id):DrawingElement;
  _applyProduction(
    operation: string,
    targetIds: Id[],
    expectedVersion: number | undefined,
    work: (document: StoryboardDocument, nextId: (prefix: string) => Id) => void,
    scope?: ProductionScope,
  ): void;
}

export interface MutationOptions { expectedVersion?: number }

/** Replace the array without mutating comment records shared with an undo snapshot. */
export function removeReviewAnchors(document:StoryboardDocument,removedIds:ReadonlySet<Id>):void{
  document.comments=document.comments.filter(({anchor})=>
    ![anchor.panelId,anchor.layerId,anchor.elementId].some(id=>id!==undefined&&removedIds.has(id)));
}

function assertRemovalUnlocked(document:StoryboardDocument,removedIds:ReadonlySet<Id>):void{
  const lock=document.locks.find(entry=>removedIds.has(entry.targetId));
  if(lock)throw new Error(`Cannot remove locked artwork: unlock ${lock.targetType} ${lock.targetId} first (${lock.id})`);
}

function findPanel(document: StoryboardDocument, id: Id): Panel {
  const panel = document.panels.find((entry) => entry.id === id);
  if (!panel) throw new Error(`Panel not found: ${id}`);
  return panel;
}

function visitLayers(layers: Layer[], work: (layer: Layer) => void): void {
  for (const layer of layers) {
    work(layer);
    if (layer.kind === "group") visitLayers(layer.children, work);
  }
}

function findLayer(document: StoryboardDocument, id: Id): { panel: Panel; layer: Layer } {
  for (const panel of document.panels) {
    let found: Layer | undefined;
    visitLayers(panel.layers, (layer) => { if (layer.id === id) found = layer; });
    if (found) return { panel, layer: found };
  }
  throw new Error(`Layer not found: ${id}`);
}

function orderedPanels(document: StoryboardDocument, shotId: Id): Panel[] {
  const shot = document.shots.find((entry) => entry.id === shotId);
  if (!shot) throw new Error(`Shot not found: ${shotId}`);
  return shot.panelIds.map((id) => findPanel(document, id));
}

function reflowTimeline(document: StoryboardDocument): void {
  const offsets = new Map<string,number>();
  const updates:(()=>void)[]=[];
  const before=document.panels.map(p=>({id:p.id,start:p.startFrame,end:p.startFrame+p.durationFrames}));
  let cursor=0;
  for(const scene of document.scenes)for(const shotId of scene.shotIds)for(const panel of orderedPanels(document,shotId)){
    const start=cursor,delta=start-panel.startFrame;offsets.set(panel.id,delta);cursor+=panel.durationFrames;
    updates.push(()=>{
      panel.startFrame=start;
      if(delta){
        panel.revision++;
        visitLayers(panel.layers,layer=>{
          for(const key of layer.keyframes)key.frame+=delta;
          if(layer.exposure){layer.exposure.startFrame+=delta;layer.exposure.endFrame+=delta;}
          if(layer.kind==="group")for(const key of layer.drawingSequence??[])key.frame+=delta;
          if(layer.kind!=="group")for(const element of layer.elements){
            if(element.kind==="raster-stroke"&&element.reveal){element.reveal.startFrame+=delta;element.reveal.endFrame+=delta;}
          }
        });
      }
    });
  }
  const map=(frame:number)=>{const p=before.find(p=>frame>=p.start&&frame<p.end);return frame+(p?offsets.get(p.id)??0:0);};
  for(const shot of document.shots){
    for(const key of shot.cameraKeyframes){const frame=map(key.frame);updates.push(()=>{key.frame=frame;});}
    updates.push(()=>shot.cameraKeyframes.sort((a,b)=>a.frame-b.frame));
  }
  for(const track of document.audioTracks)for(const clip of track.clips){
    const frame=map(clip.startFrame);
    if(frame!==clip.startFrame&&track.locked)throw new Error(`Audio track is locked: ${track.id}`);
    updates.push(()=>{clip.startFrame=frame;});
  }
  for(const comment of document.comments)if(comment.anchor.frame!==undefined){
    const frame=map(comment.anchor.frame);
    updates.push(()=>{comment.anchor.frame=frame;});
  }
  for(const update of updates)update();
  document.panels.sort((a,b)=>a.startFrame-b.startFrame);
}

/** Structural changes stage only reference lists; reflow checks locks before touching artwork timing. */
export function editTimelineStructure<T>(document:StoryboardDocument,work:()=>T):T{
  const original={shots:document.shots,panels:document.panels,comments:document.comments,idCounter:document.idCounter};
  document.shots=original.shots.map(shot=>({...shot,panelIds:shot.panelIds.slice(),cameraKeyframes:shot.cameraKeyframes.slice()}));
  document.panels=original.panels.slice();document.comments=original.comments.slice();
  try{const result=work();reflowTimeline(document);return result;}
  catch(error){Object.assign(document,original);throw error;}
}

function cloneLayers(layers:Layer[],nextId:(prefix:string)=>Id):Layer[]{
  const originals:Layer[]=[];visitLayers(layers,layer=>originals.push(layer));
  const owned=new Set(originals.map(layer=>layer.id));
  for(const layer of originals)if(layer.maskLayerId&&!owned.has(layer.maskLayerId))throw new Error("Copy must include the mask dependency");
  const copied=structuredClone(layers),ids=new Map<Id,Id>();
  visitLayers(copied,layer=>{
    const id=nextId("layer");ids.set(layer.id,id);layer.id=id;
    for(const key of layer.keyframes)key.id=nextId("layer-key");
    if(layer.kind!=="group")for(const element of layer.elements)element.id=nextId("element");
  });
  visitLayers(copied,layer=>{
    if(layer.maskLayerId)layer.maskLayerId=ids.get(layer.maskLayerId)!;
    if(layer.kind==="group"&&layer.twoBoneRig)layer.twoBoneRig.elbowId=ids.get(layer.twoBoneRig.elbowId)!;
    if(layer.kind==="group")for(const key of layer.drawingSequence??[])if(key.drawingId!==null)key.drawingId=ids.get(key.drawingId)!;
  });
  return copied;
}

function assertStaticComponent(layers:Layer[]):void {
  visitLayers(layers,layer=>{if(layer.kind==="group"&&layer.drawingSequence!==undefined)throw new Error("Components capture static artwork; capture an individual drawing instead of a drawing sequence");});
}

export class ProductionTools {
  constructor(private host: ProductionHost) {}

  captureComponent(layerId:Id,name:string,options:MutationOptions & {id?:Id}={}):Id{
    let id="";
    this.host._applyProduction("capture drawing component",[layerId],options.expectedVersion,(d,next)=>{
      const source=[findLayer(d,layerId).layer];assertStaticComponent(source);
      const layers=cloneLayers(source,next);
      id=options.id??next("component");
      visitLayers(layers,l=>{l.keyframes=[];l.exposure=null;delete l.componentSource;if(l.kind!=="group")for(const e of l.elements)if(e.kind==="raster-stroke")delete e.reveal;});
      layers[0]!.transform=identityTransform();
      d.components.push({id,name,version:1,layers});
    });return id;
  }

  reviseComponent(id:Id,sourceLayerId:Id,options:MutationOptions={}){
    this.host._applyProduction("revise component source",[id],options.expectedVersion,(d,next)=>{
      const c=d.components.find(c=>c.id===id);if(!c)throw new Error(`Component not found: ${id}`);
      const source=[findLayer(d,sourceLayerId).layer];assertStaticComponent(source);
      const layers=cloneLayers(source,next);
      visitLayers(layers,l=>{l.keyframes=[];l.exposure=null;delete l.componentSource;if(l.kind!=="group")for(const e of l.elements)if(e.kind==="raster-stroke")delete e.reveal;});layers[0]!.transform=identityTransform();
      c.layers=layers;c.version++;
    });
  }

  instantiateComponent(componentId:Id,panelId:Id,transform:Partial<Transform>={},options:MutationOptions & {id?:Id}={}):Id{
    let id="";
    this.host._applyProduction("instantiate component",[panelId,componentId],options.expectedVersion,(d,next)=>{
      const c=d.components.find(c=>c.id===componentId);if(!c)throw new Error(`Component not found: ${componentId}`);
      const layers=cloneLayers(c.layers,next);id=options.id??next("layer");
      findPanel(d,panelId).layers.push({id,name:c.name,kind:"group",children:layers,visible:true,opacity:1,blendMode:"source-over",transform:{...identityTransform(),...transform},clipToBelow:false,keyframes:[],depth:1,exposure:null,componentSource:{id:c.id,version:c.version}});
    },{panelId});return id;
  }

  refreshComponentInstance(layerId:Id,options:MutationOptions & {comments?:"reject"|"anchor-to-instance"}={}){
    if(options.comments!==undefined&&!['reject','anchor-to-instance'].includes(options.comments))throw new Error("Invalid component refresh comment policy");
    this.host._applyProduction("explicitly refresh component instance",[layerId],options.expectedVersion,(d,next)=>{
      const {panel,layer}=findLayer(d,layerId);
      if(layer.kind!=="group"||!layer.componentSource)throw new Error("Layer is not a component instance");
      const c=d.components.find(c=>c.id===layer.componentSource!.id);if(!c)throw new Error("Missing component source");
      const removedLayers=new Set<Id>(),removedElements=new Set<Id>();
      visitLayers(layer.children,child=>{
        removedLayers.add(child.id);
        if(child.kind!=="group")for(const element of child.elements)removedElements.add(element.id);
      });
      const lock=d.locks.find(lock=>removedLayers.has(lock.targetId));
      if(lock)throw new Error(`Cannot refresh locked descendant: unlock ${lock.targetId} first (${lock.id})`);
      visitLayers(panel.layers,entry=>{
        if(removedLayers.has(entry.id))return;
        if(entry.kind==="group"&&entry.twoBoneRig&&removedLayers.has(entry.twoBoneRig.elbowId))throw new Error("Unbind the two-bone rig before refreshing its elbow artwork");
        if(entry.maskLayerId&&removedLayers.has(entry.maskLayerId))throw new Error(`Cannot refresh ${layerId}: layer ${entry.id} uses descendant mask ${entry.maskLayerId}`);
        if(entry.kind==="group"&&entry.drawingSequence?.some(key=>key.drawingId!==null&&removedLayers.has(key.drawingId)))throw new Error(`Cannot refresh ${layerId}: drawing sequence ${entry.id} uses its descendants`);
      });
      const affected=(comment:ReviewComment)=>removedLayers.has(comment.anchor.layerId??"")||removedElements.has(comment.anchor.elementId??"");
      const anchored=d.comments.filter(affected);
      if(anchored.length&&options.comments!=="anchor-to-instance")throw new Error(`Refresh would replace artwork referenced by comments: ${anchored.map(comment=>comment.id).join(", ")}. Use comments: "anchor-to-instance" to retain those notes on the instance`);
      const children=cloneLayers(c.layers,next);
      if(anchored.length)d.comments=d.comments.map(comment=>{
        if(!affected(comment))return comment;
        const {layerId:_layer,elementId:_element,panelId:_panel,...position}=comment.anchor;
        return {...comment,anchor:{...position,panelId:panel.id,layerId:layer.id}};
      });
      layer.children=children;layer.componentSource.version=c.version;
    },{layerId});
  }

  moveLayer(layerId:Id,beforeLayerId?:Id,options:MutationOptions={}){
    this.host._applyProduction("reorder layer",[layerId,...(beforeLayerId?[beforeLayerId]:[])],options.expectedVersion,d=>{
      const {panel}=findLayer(d,layerId);
      const move=(layers:Layer[]):boolean=>{
        const index=layers.findIndex(l=>l.id===layerId);
        if(index>=0){
          if(beforeLayerId===layerId)return true;
          const destination=beforeLayerId?layers.findIndex(l=>l.id===beforeLayerId):layers.length;
          if(destination<0)throw new Error("Destination must be a sibling layer");
          const [l]=layers.splice(index,1);
          layers.splice(destination>index?destination-1:destination,0,l!);return true;
        }
        return layers.some(l=>l.kind==="group"&&move(l.children));
      };move(panel.layers);panel.revision++;
    },{layerId});
  }

  reparentLayer(layerId:Id,parentId:Id|null,options:MutationOptions & {beforeLayerId?:Id}={}):void{
    this.host._applyProduction("reparent layer",[layerId,...(parentId?[parentId]:[])],options.expectedVersion,document=>{
      const {panel,layer}=findLayer(document,layerId);
      const locate=(layers:Layer[],id:Id,ancestors:Id[]=[]):{layer:Layer;ancestors:Id[]}|undefined=>{
        for(const entry of layers){
          if(entry.id===id)return {layer:entry,ancestors};
          if(entry.kind==="group"){const found=locate(entry.children,id,[...ancestors,entry.id]);if(found)return found;}
        }
        return undefined;
      };
      const source=locate(panel.layers,layerId)!,destination=parentId===null?undefined:locate(panel.layers,parentId);
      if(parentId!==null&&destination?.layer.kind!=="group")throw new Error("Destination must be a group in the same panel, or null for panel root");
      if(parentId!==null&&layer.keyframes.some(key=>key.depth!==undefined))throw new Error("Remove depth keyframes before nesting a plane beneath another layer");
      const subtree=new Set<Id>();visitLayers([layer],entry=>subtree.add(entry.id));
      if(parentId!==null&&subtree.has(parentId))throw new Error("Cannot parent a layer to itself or its descendants");
      const affected=new Set([...subtree,...source.ancestors,...(destination?.ancestors??[]),...(parentId?[parentId]:[])]);
      const lock=document.locks.find(lock=>lock.targetType==="layer"&&affected.has(lock.targetId));
      if(lock)throw new Error(`Cannot reparent locked hierarchy: unlock ${lock.targetId} first (${lock.id})`);
      const oldParent=source.ancestors.at(-1),owner=oldParent?locate(panel.layers,oldParent)!.layer:undefined;
      if(oldParent!==parentId&&owner?.kind==="group"&&owner.twoBoneRig?.elbowId===layerId)throw new Error("Unbind the two-bone rig before moving its elbow");
      if(oldParent!==parentId&&owner?.kind==="group"&&owner.drawingSequence?.some(key=>key.drawingId===layerId))throw new Error(`Drawing sequence ${owner.id} uses ${layerId}; revise its exposures before reparenting`);
      const siblings=destination?.layer.kind==="group"?destination.layer.children:panel.layers;
      if(options.beforeLayerId!==undefined&&(options.beforeLayerId===layerId||!siblings.some(entry=>entry.id===options.beforeLayerId)))throw new Error("Insertion target must be another child of the destination");
      if(destination?.layer.kind==="group"&&destination.layer.drawingSequence!==undefined&&layer.clipToBelow)throw new Error("A drawing-sequence child cannot clip to another drawing; move its complete clipping group");
      const detach=(layers:Layer[]):Layer[]=>layers.filter(entry=>entry.id!==layerId).map(entry=>entry.kind==="group"?{...entry,children:detach(entry.children)}:entry);
      const insert=(layers:Layer[]):Layer[]=>{
        const index=options.beforeLayerId===undefined?layers.length:layers.findIndex(entry=>entry.id===options.beforeLayerId);
        return [...layers.slice(0,index),layer,...layers.slice(index)];
      };
      const attach=(layers:Layer[]):Layer[]=>layers.map(entry=>entry.kind==="group"?{...entry,children:entry.id===parentId?insert(entry.children):attach(entry.children)}:entry);
      const detached=detach(panel.layers),proposed=parentId===null?insert(detached):attach(detached),dependencies=new Map<Id,Layer>();
      visitLayers(proposed,entry=>dependencies.set(entry.id,entry));validateLayerDependencies(dependencies);
      panel.layers=proposed;panel.revision++;
    },{layerId});
  }

  removeLayer(layerId:Id,options:MutationOptions={}){
    this.host._applyProduction("remove layer",[layerId],options.expectedVersion,d=>{
      const {panel,layer}=findLayer(d,layerId),removedLayers=new Set<Id>(),removedElements=new Set<Id>();
      visitLayers([layer],entry=>{
        removedLayers.add(entry.id);
        if(entry.kind!=="group")for(const element of entry.elements)removedElements.add(element.id);
      });
      visitLayers(panel.layers,entry=>{
        if(!removedLayers.has(entry.id)&&entry.kind==="group"&&entry.twoBoneRig&&removedLayers.has(entry.twoBoneRig.elbowId))throw new Error("Unbind the two-bone rig before removing its elbow");
        if(!removedLayers.has(entry.id)&&entry.kind==="group"&&entry.drawingSequence?.some(key=>key.drawingId!==null&&removedLayers.has(key.drawingId)))
          throw new Error(`Cannot remove ${layerId}: drawing sequence ${entry.id} uses it; revise its exposures first`);
        if(!removedLayers.has(entry.id)&&entry.maskLayerId&&removedLayers.has(entry.maskLayerId))
          throw new Error(`Cannot remove ${layerId}: layer ${entry.id} uses mask ${entry.maskLayerId}; remove or replace its mask reference first`);
      });
      assertRemovalUnlocked(d,removedLayers);
      const remove=(layers:Layer[]):Layer[]=>layers.filter(l=>l.id!==layerId).map(l=>l.kind==="group"?{...l,children:remove(l.children)}:l);
      panel.layers=remove(panel.layers);
      removeReviewAnchors(d,new Set([...removedLayers,...removedElements]));
      panel.revision++;
    },{layerId});
  }

  find(query:ObjectQuery={}) {return this.host._findObjects(query);}

  coordinates(targetId:Id,options:CoordinateOptions={}) {return this.host._coordinates(targetId,options);}

  layer(id:Id):Layer{return this.host._readLayer(id);}

  layerKeyframes(id:Id,options:PageOptions={}){return this.host._readLayerKeyframes(id,options);}

  cameraKeyframes(shotId:Id,options:PageOptions={}){return this.host._readCameraKeyframes(shotId,options);}

  element(id:Id):DrawingElement{return this.host._readElement(id);}

  drawingSequence(groupId:Id){return this.host._readDrawingSequence(groupId);}
  setPlaneDepth(layerId:Id,depth:number,options:MutationOptions={}):void{
    if(!Number.isFinite(depth)||depth<=0)throw new Error("Plane depth must be positive and finite");
    this.host._applyProduction("set multiplane depth",[layerId],options.expectedVersion,d=>{
      const {layer,panel}=findLayer(d,layerId);
      if(!panel.layers.includes(layer))throw new Error(`Multiplane depth belongs to a top-level layer or group; revise its root plane instead: ${layerId}`);
      layer.depth=depth;
    },{layerId});
  }
  drawingNeighbors(groupId:Id,frame:number,options:{skipBlank?:boolean}={}):DrawingNeighbors{return this.host._readDrawingNeighbors(groupId,frame,options.skipBlank??true);}

  twoBoneRig(rootId:Id){return this.host._readTwoBoneRig(rootId);}

  setTwoBoneRig(rootId:Id,definition:TwoBoneRig|null,options:MutationOptions={}):void{
    const rig=definition===null?null:twoBoneRigSchema.parse(definition);
    this.host._applyProduction("configure two-bone rig",[rootId],options.expectedVersion,document=>{
      const {layer}=findLayer(document,rootId);
      if(layer.kind!=="group")throw new Error("Rig requires a group");
      if(rig){validateTwoBoneRig(layer,rig);layer.twoBoneRig=rig;}else delete layer.twoBoneRig;
    },{layerId:rootId});
  }

  poseTwoBoneRig(rootId:Id,frame:number,target:{x:number;y:number},options:MutationOptions & {bend?:1|-1;easing?:Easing}={}):TwoBoneSolution{
    assertRenderFrame(frame);
    let solution!:TwoBoneSolution;
    this.host._applyProduction("pose two-bone rig",[rootId],options.expectedVersion,(document,next)=>{
      const {layer}=findLayer(document,rootId);
      if(layer.kind!=="group"||!layer.twoBoneRig)throw new Error(`No two-bone rig on ${rootId}`);
      const elbow=validateTwoBoneRig(layer,layer.twoBoneRig);
      const lock=document.locks.find(lock=>lock.targetType==="layer"&&lock.targetId===elbow.id&&lock.owner!==this.host.actor);
      if(lock)throw new Error(`Locked by ${lock.owner}: ${lock.reason}`);
      const rootState=evaluateLayer(layer,frame).transform,elbowState=evaluateLayer(elbow,frame).transform;
      solution=solveTwoBoneIK(rootState,target,layer.twoBoneRig.upperLength,layer.twoBoneRig.lowerLength,options.bend??1);
      const nearest=(angle:number,reference:number)=>reference+Math.atan2(Math.sin(angle-reference),Math.cos(angle-reference));
      const prepare=(joint:Layer,angle:number,reference:number)=>{
        const existing=joint.keyframes.find(key=>key.frame===frame);
        return layerKeyframeSchema.parse({...existing,id:existing?.id??"",frame,transform:{...existing?.transform,rotation:nearest(angle,reference)},easing:existing?.easing??options.easing??"linear",channelEasing:{...existing?.channelEasing,rotation:options.easing??"linear"}});
      };
      const rootKey=prepare(layer,solution.rootRotation,rootState.rotation),elbowKey=prepare(elbow,solution.elbowRotation,elbowState.rotation);
      for(const [joint,key] of [[layer,rootKey],[elbow,elbowKey]] as const){
        if(!key.id)key.id=next("layer-key");
        joint.keyframes=[...joint.keyframes.filter(key=>key.frame!==frame),key].sort((a,b)=>a.frame-b.frame);
      }
    },{layerId:rootId});
    return solution;
  }

  setDrawingSequence(groupId:Id,keys:readonly DrawingExposure[]|null,options:MutationOptions={}) {
    const proposed=keys===null?null:drawingSequenceSchema.parse(keys);
    this.host._applyProduction("set drawing sequence",[groupId],options.expectedVersion,d=>{
      const {layer,panel}=findLayer(d,groupId);
      if(layer.kind!=="group")throw new Error(`Drawing sequence requires a group: ${groupId}`);
      if(proposed!==null)validateDrawingSequence({...layer,drawingSequence:proposed});
      if(proposed===null)delete layer.drawingSequence;
      else layer.drawingSequence=proposed;
      panel.revision++;
    },{layerId:groupId});
  }

  duplicateDrawing(groupId:Id,drawingId:Id,name:string,options:MutationOptions={}):Id {
    let id="";
    this.host._applyProduction("duplicate drawing for local variation",[groupId,drawingId],options.expectedVersion,(d,next)=>{
      const {layer}=findLayer(d,groupId);
      if(layer.kind!=="group"||layer.drawingSequence===undefined)throw new Error(`Layer is not a drawing sequence: ${groupId}`);
      const source=layer.children.find(child=>child.id===drawingId);
      if(!source)throw new Error(`Drawing ${drawingId} is not a child of ${groupId}`);
      const drawing=cloneLayers([source],next)[0]!;drawing.name=name;id=drawing.id;
      layer.children.push(drawing);
    },{layerId:groupId});
    return id;
  }

  setDrawingRange(groupId:Id,startFrame:number,endFrame:number,drawingId:Id|null,options:MutationOptions={}):void {
    assertRenderFrame(startFrame);assertRenderFrame(endFrame);
    if(endFrame<=startFrame)throw new Error("Drawing range end must follow start (end is exclusive)");
    this.host._applyProduction("replace drawing exposure range",[groupId],options.expectedVersion,d=>{
      const {layer,panel}=findLayer(d,groupId);
      if(layer.kind!=="group"||layer.drawingSequence===undefined)throw new Error(`Layer is not a drawing sequence: ${groupId}`);
      const sequence=layer.drawingSequence;
      const restore=evaluateDrawing(sequence,endFrame)!;
      const keys=sequence.filter(key=>key.frame<startFrame||key.frame>=endFrame);
      keys.push({frame:startFrame,drawingId});
      if(!keys.some(key=>key.frame===endFrame))keys.push({frame:endFrame,drawingId:restore});
      const proposed=drawingSequenceSchema.parse(keys.sort((a,b)=>a.frame-b.frame));
      validateDrawingSequence({...layer,drawingSequence:proposed});
      layer.drawingSequence=proposed;
      panel.revision++;
    },{layerId:groupId});
  }

  setExposure(layerId:Id,exposure:Layer["exposure"],options:MutationOptions={}) {
    this.host._applyProduction("set drawing exposure",[layerId],options.expectedVersion,d=>{
      const proposed=exposureSchema.parse(exposure);
      findLayer(d,layerId).layer.exposure=proposed;
    },{layerId});
  }

  inspect() {return this.host._inspectProject();}
  audioTracks(options:PageOptions={}):AudioTrackSummary[]{return this.host._readAudioTracks(options);}
  audioClips(trackId:Id,options:AudioClipQuery={}):AudioClip[]{return this.host._readAudioClips(trackId,options);}
  audioClip(id:Id):AudioClip&{trackId:Id}{return this.host._readAudioClip(id);}

  changesSince(version: number, options:PageOptions={}) {
    return this.host._readChanges(version,options);
  }

  brush(id: Id): BrushPreset {
    return this.host._readBrush(id);
  }

  createBrush(definition: Omit<BrushPreset, "id" | "version"> & { id?: Id }, options: MutationOptions = {}): Id {
    let id = "";
    this.host._applyProduction("create brush", [], options.expectedVersion, (document, nextId) => {
      const proposed=parseBrushDefinition({...definition,id:definition.id??"brush:pending",version:1});
      id = definition.id ?? nextId("brush");
      document.brushes.push({...proposed,id});
    });
    return id;
  }

  reviseBrush(id: Id, changes: Partial<Omit<BrushPreset, "id" | "version">>, options: MutationOptions = {}): number {
    let version = 0;
    this.host._applyProduction("revise brush", [id], options.expectedVersion, (document) => {
      const index = document.brushes.findIndex((entry) => entry.id === id);
      if (index < 0) throw new Error(`Brush not found: ${id}`);
      const current = document.brushes[index]!;
      version = current.version + 1;
      const proposed=parseBrushDefinition({...current,...changes,id,version});
      document.brushes[index] = proposed;
    });
    return version;
  }

  duplicateBrush(id: Id, name: string, options: MutationOptions = {}): Id {
    const source = this.brush(id);
    const { id: _id, version: _version, ...definition } = source;
    return this.createBrush({ ...definition, name }, options);
  }

  setPanelDuration(panelId: Id, durationFrames: number, mode: "ripple" | "preserve" = "ripple", options: MutationOptions = {}): void {
    if (!Number.isSafeInteger(durationFrames) || durationFrames < 1) throw new Error("Panel duration must be a positive safe integer frame count");
    if(mode!=="ripple"&&mode!=="preserve")throw new Error(`Unknown retiming mode: ${mode}`);
    this.host._applyProduction(`retime panel (${mode})`, [panelId], options.expectedVersion, (document) => {
      const panel = findPanel(document, panelId);
      if (mode === "preserve" && durationFrames !== panel.durationFrames) throw new Error("Preserving subsequent timing would create a gap or overlap. Use ripple retiming.");
      retimePanel(document, panelId, durationFrames);
    });
  }

  setTransition(panelId: Id, transition: Transition, options: MutationOptions = {}): void {
    this.host._applyProduction("set transition", [panelId], options.expectedVersion, (document) => {
      const panel = findPanel(document, panelId);
      const proposed=transitionSchema.parse(transition);
      if (proposed.durationFrames >= panel.durationFrames) throw new Error("Transition duration must fit inside the panel");
      panel.transition = proposed;
      panel.revision += 1;
    },{panelId});
  }

  movePanel(panelId: Id, beforePanelId?: Id, options: MutationOptions = {}): void {
    this.host._applyProduction("move panel", [panelId, ...(beforePanelId ? [beforePanelId] : [])], options.expectedVersion, (document) => editTimelineStructure(document,()=>{
      const panel = findPanel(document, panelId);
      const shot = document.shots.find((entry) => entry.id === panel.shotId)!;
      shot.panelIds = shot.panelIds.filter((id) => id !== panelId);
      const index = beforePanelId ? shot.panelIds.indexOf(beforePanelId) : shot.panelIds.length;
      if (index < 0) throw new Error(`Destination panel is not in shot ${shot.id}`);
      shot.panelIds.splice(index, 0, panelId);
    }));
  }

  duplicatePanel(panelId: Id, options: MutationOptions = {}): Id {
    let created = "";
    this.host._applyProduction("duplicate panel", [panelId], options.expectedVersion, (document, nextId) => editTimelineStructure(document,()=>{
      const source = findPanel(document, panelId);
      const shot = document.shots.find((entry) => entry.id === source.shotId)!;
      created = nextId("panel");
      const copy: Panel = {
        ...structuredClone(source), id: created, number: `${source.number}A`, title: `${source.title} copy`,
        layers: cloneLayers(source.layers, nextId),
        motion: source.motion.map((motion) => ({ ...motion, id: nextId("motion") })), revision: 0,
      };
      const index = shot.panelIds.indexOf(panelId) + 1;
      shot.panelIds.splice(index, 0, created);
      document.panels.push(copy);
    }));
    return created;
  }

  deletePanel(panelId: Id, options: MutationOptions = {}): void {
    this.host._applyProduction("delete panel", [panelId], options.expectedVersion, (document) => editTimelineStructure(document,()=>{
      const panel = findPanel(document, panelId);
      const shot = document.shots.find((entry) => entry.id === panel.shotId)!;
      if (shot.panelIds.length <= 1) throw new Error("A shot must keep at least one panel");
      const removedIds=new Set<Id>([panelId]);
      visitLayers(panel.layers,layer=>{
        removedIds.add(layer.id);
        if(layer.kind!=="group")for(const element of layer.elements)removedIds.add(element.id);
      });
      assertRemovalUnlocked(document,removedIds);
      const end=panel.startFrame+panel.durationFrames;
      if(document.audioTracks.some(t=>t.clips.some(c=>c.startFrame>=panel.startFrame&&c.startFrame<end)))throw new Error("Panel contains audio cues; remove or reposition those clips before deleting it");
      shot.cameraKeyframes=shot.cameraKeyframes.filter(k=>k.frame<panel.startFrame||k.frame>=end);
      shot.panelIds = shot.panelIds.filter((id) => id !== panelId);
      document.panels = document.panels.filter((entry) => entry.id !== panelId);
      removeReviewAnchors(document,removedIds);
      document.comments = document.comments.filter(({anchor}) =>
        !(anchor.panelId === undefined && anchor.layerId === undefined && anchor.elementId === undefined && anchor.frame !== undefined && anchor.frame >= panel.startFrame && anchor.frame < end));
    }));
  }

  setPanelStatus(panelId: Id, status: Panel["status"], options: MutationOptions = {}): void {
    this.host._applyProduction("set panel review status", [panelId], options.expectedVersion, (document) => { findPanel(document, panelId).status = status; });
  }

  setPanelNumber(panelId:Id,number:string,options:MutationOptions={}){
    this.host._applyProduction("renumber panel",[panelId],options.expectedVersion,d=>{findPanel(d,panelId).number=number;});
  }

  addCameraKeyframe(shotId: Id, frame: number, value: Partial<Pick<CameraKeyframe, CameraChannel | "easing">>, options: MutationOptions = {}): Id {
    let id = "";
    this.host._applyProduction("add camera keyframe", [shotId], options.expectedVersion, (document, nextId) => {
      const shot = document.shots.find((entry) => entry.id === shotId);
      if (!shot) throw new Error(`Shot not found: ${shotId}`);
      const existing=shot.cameraKeyframes.find(key=>key.frame===frame);
      const channels=["x","y","zoom","rotation"] as const;
      if(!channels.some(channel=>value[channel]!==undefined))throw new Error("Camera keyframe must author at least one property");
      const supplied=Object.fromEntries(channels.filter(channel=>value[channel]!==undefined).map(channel=>[channel,value[channel]]));
      const channelEasing={...existing?.channelEasing};
      if(existing&&value.easing!==undefined)for(const channel of channels)if(value[channel]!==undefined)channelEasing[channel]=value.easing;
      const keyframe=cameraKeyframeSchema.parse({...existing,...supplied,id:"",frame,easing:existing?.easing??value.easing??"linear",...(Object.keys(channelEasing).length?{channelEasing}:{})});
      id = existing?.id??nextId("camera-key");
      shot.cameraKeyframes = [...shot.cameraKeyframes.filter((keyframe) => keyframe.frame !== frame), { ...keyframe,id }].sort((a, b) => a.frame - b.frame);
    },{shotId});
    return id;
  }

  updateCameraKeyframe(shotId: Id, keyframeId: Id, changes: Partial<Omit<CameraKeyframe, "id">>, options: MutationOptions = {}): void {
    this.host._applyProduction("update camera keyframe", [shotId, keyframeId], options.expectedVersion, (document) => {
      const shot = document.shots.find((entry) => entry.id === shotId);
      const keyframe = shot?.cameraKeyframes.find((entry) => entry.id === keyframeId);
      if (!keyframe) throw new Error(`Camera keyframe not found: ${keyframeId}`);
      const proposed=cameraKeyframeSchema.parse({...keyframe,...changes,id:keyframe.id});
      const keys=shot!.cameraKeyframes.map(entry=>entry.id===keyframeId?proposed:entry);
      validateKeyframePositions(keys,shotId);
      shot!.cameraKeyframes=keys.sort((a,b)=>a.frame-b.frame);
    },{shotId});
  }

  removeCameraKeyframe(shotId: Id, keyframeId: Id, options: MutationOptions = {}): void {
    this.host._applyProduction("remove camera keyframe", [shotId, keyframeId], options.expectedVersion, (document) => {
      const shot = document.shots.find((entry) => entry.id === shotId);
      if (!shot || !shot.cameraKeyframes.some((entry) => entry.id === keyframeId)) throw new Error(`Camera keyframe not found: ${keyframeId}`);
      shot.cameraKeyframes = shot.cameraKeyframes.filter((entry) => entry.id !== keyframeId);
    },{shotId});
  }

  removeCameraKeyframeChannels(shotId:Id,keyframeId:Id,channels:readonly CameraChannel[],options:MutationOptions={}):void{
    if(!channels.length||new Set(channels).size!==channels.length||channels.some(channel=>!["x","y","zoom","rotation"].includes(channel)))throw new Error("Keyframe channels must be nonempty, unique supported property names");
    this.host._applyProduction("remove camera keyframe channels",[shotId,keyframeId],options.expectedVersion,document=>{
      const shot=document.shots.find(shot=>shot.id===shotId),key=shot?.cameraKeyframes.find(key=>key.id===keyframeId);
      if(!shot||!key)throw new Error(`Camera keyframe not found: ${keyframeId}`);
      const revised=structuredClone(key);
      for(const channel of channels){
        if(revised[channel]===undefined)throw new Error(`Property ${channel} is not keyed at ${keyframeId}`);
        delete revised[channel];
        if(revised.channelEasing)delete revised.channelEasing[channel];
      }
      if(![revised.x,revised.y,revised.zoom,revised.rotation].some(value=>value!==undefined))shot.cameraKeyframes=shot.cameraKeyframes.filter(key=>key.id!==keyframeId);
      else{const proposed=cameraKeyframeSchema.parse(revised);shot.cameraKeyframes=shot.cameraKeyframes.map(key=>key.id===keyframeId?proposed:key);}
    },{shotId});
  }

  addLayerKeyframe(layerId: Id, frame: number, value: { transform?: Partial<Transform>; opacity?: number; depth?:number; easing?: LayerKeyframe["easing"] }, options: MutationOptions = {}): Id {
    let id = "";
    this.host._applyProduction("add layer keyframe", [layerId], options.expectedVersion, (document, nextId) => {
      const { panel,layer } = findLayer(document, layerId);
      const existing=layer.keyframes.find(key=>key.frame===frame);
      const channelEasing={...existing?.channelEasing};
      if(existing&&value.easing!==undefined){
        for(const channel of Object.keys(value.transform??{}) as (keyof Transform)[])if(value.transform?.[channel]!==undefined)channelEasing[channel]=value.easing;
        if(value.opacity!==undefined)channelEasing.opacity=value.easing;
        if(value.depth!==undefined)channelEasing.depth=value.easing;
      }
      const keyframe=layerKeyframeSchema.parse({id:"",frame,transform:{...existing?.transform,...value.transform},opacity:value.opacity??existing?.opacity,depth:value.depth??existing?.depth,easing:existing?.easing??value.easing??"linear",...(Object.keys(channelEasing).length?{channelEasing}:{})});
      if(keyframe.depth!==undefined&&!panel.layers.includes(layer))throw new Error("Depth keyframes require a top-level plane");
      validateRigLayerChange(panel.layers,{...layer,keyframes:[...layer.keyframes.filter(entry=>entry.frame!==frame),keyframe]});
      id = existing?.id??nextId("layer-key");
      layer.keyframes = [...layer.keyframes.filter((entry) => entry.frame !== frame), {...keyframe,id}].sort((a, b) => a.frame - b.frame);
    },{layerId});
    return id;
  }

  updateLayerKeyframe(layerId: Id, keyframeId: Id, changes: Partial<Omit<LayerKeyframe, "id">>, options: MutationOptions = {}): void {
    this.host._applyProduction("update layer keyframe", [layerId, keyframeId], options.expectedVersion, (document) => {
      const { panel,layer } = findLayer(document, layerId);
      const keyframe = layer.keyframes.find((entry) => entry.id === keyframeId);
      if (!keyframe) throw new Error(`Layer keyframe not found: ${keyframeId}`);
      const proposed=layerKeyframeSchema.parse({...keyframe,...changes,id:keyframe.id});
      if(proposed.depth!==undefined&&!panel.layers.includes(layer))throw new Error("Depth keyframes require a top-level plane");
      const keys=layer.keyframes.map(entry=>entry.id===keyframeId?proposed:entry);
      validateKeyframePositions(keys,layerId);
      validateRigLayerChange(panel.layers,{...layer,keyframes:keys});
      layer.keyframes=keys.sort((a,b)=>a.frame-b.frame);
    },{layerId});
  }

  removeLayerKeyframe(layerId: Id, keyframeId: Id, options: MutationOptions = {}): void {
    this.host._applyProduction("remove layer keyframe", [layerId, keyframeId], options.expectedVersion, (document) => {
      const { layer } = findLayer(document, layerId);
      if (!layer.keyframes.some((entry) => entry.id === keyframeId)) throw new Error(`Layer keyframe not found: ${keyframeId}`);
      layer.keyframes = layer.keyframes.filter((entry) => entry.id !== keyframeId);
    },{layerId});
  }

  removeLayerKeyframeChannels(layerId:Id,keyframeId:Id,channels:readonly LayerChannel[],options:MutationOptions={}){
    if(!channels.length||new Set(channels).size!==channels.length||channels.some(channel=>!["x","y","scaleX","scaleY","rotation","opacity","depth"].includes(channel)))throw new Error("Keyframe channels must be nonempty, unique supported property names");
    this.host._applyProduction("remove keyframe channels",[layerId,keyframeId],options.expectedVersion,d=>{
      const {layer}=findLayer(d,layerId),key=layer.keyframes.find(k=>k.id===keyframeId);
      if(!key)throw new Error(`Layer keyframe not found: ${keyframeId}`);
      const revised=structuredClone(key);
      for(const channel of channels){
        if((channel==="opacity"||channel==="depth"?revised[channel]:revised.transform[channel])===undefined)throw new Error(`Property ${channel} is not keyed at ${keyframeId}`);
        if(channel==="opacity"||channel==="depth")delete revised[channel];else delete revised.transform[channel];
        if(revised.channelEasing)delete revised.channelEasing[channel];
      }
      if(revised.opacity===undefined&&revised.depth===undefined&&!Object.keys(revised.transform).length)layer.keyframes=layer.keyframes.filter(k=>k.id!==keyframeId);
      else{const proposed=layerKeyframeSchema.parse(revised);layer.keyframes=layer.keyframes.map(k=>k.id===keyframeId?proposed:k);}
    },{layerId});
  }

  addAsset(asset: Omit<Asset, "id"> & { id?: Id }, options: MutationOptions = {}): Id {
    let id = "";
    this.host._applyProduction("add asset", [], options.expectedVersion, (document, nextId) => {
      id = asset.id ?? nextId("asset");
      document.assets.push({ ...asset, id });
    });
    return id;
  }

  updateAsset(id: Id, changes: Partial<Omit<Asset,"id">>, options: MutationOptions = {}): void {
    this.host._applyProduction("update asset",[id],options.expectedVersion,document=>{
      const asset=document.assets.find(a=>a.id===id);
      if(!asset)throw new Error(`Asset not found: ${id}`);
      Object.assign(asset,structuredClone(changes));
    });
  }

  addAudioTrack(name: string, options: MutationOptions & { id?: Id } = {}): Id {
    audioTrackSchema.parse({id:options.id??"",name,muted:false,locked:false,clips:[]});
    let id = "";
    this.host._applyProduction("add audio track", [], options.expectedVersion, (document, nextId) => {
      id = options.id ?? nextId("audio-track");
      document.audioTracks.push({ id, name, muted: false, locked: false, clips: [] });
    },{audio:true});
    return id;
  }

  updateAudioTrack(trackId:Id,changes:{name?:string;muted?:boolean;locked?:boolean},options:MutationOptions={}):void{
    const proposed=audioTrackChangesSchema.parse(changes);
    this.host._applyProduction("update audio track",[trackId],options.expectedVersion,d=>{
      const track=d.audioTracks.find(track=>track.id===trackId);
      if(!track)throw new Error(`Audio track not found: ${trackId}`);
      if(track.locked&&(proposed.name!==undefined||proposed.muted!==undefined))throw new Error(`Unlock audio track before editing: ${trackId}`);
      for(const [key,value]of Object.entries(proposed))if(value!==undefined)Object.assign(track,{[key]:value});
    },{audio:true});
  }

  removeAudioTrack(trackId:Id,options:MutationOptions={}):void{
    this.host._applyProduction("remove audio track and clips",[trackId],options.expectedVersion,d=>{
      const track=d.audioTracks.find(track=>track.id===trackId);
      if(!track)throw new Error(`Audio track not found: ${trackId}`);
      if(track.locked)throw new Error(`Audio track is locked: ${trackId}`);
      d.audioTracks=d.audioTracks.filter(track=>track.id!==trackId);
    },{audio:true});
  }

  addAudioClip(trackId: Id, clip: Omit<AudioClip, "id"> & { id?: Id }, options: MutationOptions = {}): Id {
    let id = "";
    this.host._applyProduction("add audio clip", [trackId], options.expectedVersion, (document, nextId) => {
      const track = document.audioTracks.find((entry) => entry.id === trackId);
      if (!track) throw new Error(`Audio track not found: ${trackId}`);
      if (track.locked) throw new Error(`Audio track is locked: ${trackId}`);
      const asset = document.assets.find((entry) => entry.id === clip.assetId);
      if (!asset || asset.kind !== "audio") throw new Error(`Audio asset not found: ${clip.assetId}`);
      const proposed=audioClipSchema.parse({...clip,id:clip.id??"new clip"});
      validateAudioFades(proposed);
      id = clip.id ?? nextId("audio-clip");
      track.clips.push({ ...proposed, id });
    },{audio:true});
    return id;
  }

  updateAudioClip(trackId: Id, clipId: Id, changes: Partial<Pick<AudioClip, "startFrame" | "sourceInFrame" | "durationFrames" | "volume" | "fadeInFrames" | "fadeOutFrames" | "name">>, options: MutationOptions = {}): void {
    this.host._applyProduction("update audio clip", [trackId, clipId], options.expectedVersion, (document) => {
      const track = document.audioTracks.find((entry) => entry.id === trackId);
      if (!track) throw new Error(`Audio track not found: ${trackId}`);
      if (track.locked) throw new Error(`Audio track is locked: ${trackId}`);
      const clip = track.clips.find((entry) => entry.id === clipId);
      if (!clip) throw new Error(`Audio clip not found: ${clipId}`);
      const proposed=audioClipSchema.parse({...clip,...changes,id:clip.id,assetId:clip.assetId});
      validateAudioFades(proposed);
      Object.assign(clip,proposed);
    },{audio:true});
  }

  removeAudioClip(trackId:Id,clipId:Id,options:MutationOptions={}){
    this.host._applyProduction("remove audio clip",[trackId,clipId],options.expectedVersion,d=>{
      const track=d.audioTracks.find(t=>t.id===trackId);if(!track||track.locked)throw new Error("Missing or locked audio track");
      const index=track.clips.findIndex(c=>c.id===clipId);if(index<0)throw new Error(`Audio clip not found: ${clipId}`);track.clips.splice(index,1);
    },{audio:true});
  }

  moveAudioClip(clipId:Id,targetTrackId:Id,options:MutationOptions&{startFrame?:number}={}):void{
    const owner=this.host._readAudioClip(clipId).trackId;
    this.host._applyProduction("move audio clip",[owner,targetTrackId,clipId],options.expectedVersion,d=>{
      const source=d.audioTracks.find(track=>track.id===owner)!,target=d.audioTracks.find(track=>track.id===targetTrackId);
      if(!target)throw new Error(`Audio track not found: ${targetTrackId}`);
      if(source.locked||target.locked)throw new Error(`Audio track is locked: ${source.locked?source.id:target.id}`);
      const index=source.clips.findIndex(clip=>clip.id===clipId),clip=source.clips[index]!;
      const proposed=audioClipSchema.parse({...clip,startFrame:options.startFrame??clip.startFrame});
      if(source===target)source.clips[index]=proposed;
      else{source.clips.splice(index,1);target.clips.push(proposed);}
    },{audio:true});
  }

  splitAudioClip(clipId:Id,frame:number,options:MutationOptions={}):Id{
    if(!Number.isSafeInteger(frame)||frame<0)throw new Error("Audio split frame must be a nonnegative safe integer");
    const owner=this.host._readAudioClip(clipId).trackId;let rightId="";
    this.host._applyProduction("split audio clip",[owner,clipId],options.expectedVersion,(document,nextId)=>{
      const track=document.audioTracks.find(track=>track.id===owner)!;
      if(track.locked)throw new Error(`Audio track is locked: ${owner}`);
      const index=track.clips.findIndex(clip=>clip.id===clipId),clip=track.clips[index]!,end=clip.startFrame+clip.durationFrames;
      if(!Number.isSafeInteger(end))throw new Error("Audio clip end exceeds the safe integer frame range");
      if(frame<=clip.startFrame||frame>=end)throw new Error("Audio split frame must be strictly inside the clip");
      const leftDuration=frame-clip.startFrame,rightDuration=end-frame;
      if(leftDuration<clip.fadeInFrames||rightDuration<clip.fadeOutFrames)throw new Error("Audio split crosses a fade; revise the fade or choose a frame between the fades");
      const left=audioClipSchema.parse({...clip,durationFrames:leftDuration,fadeOutFrames:0});
      const right=audioClipSchema.parse({...clip,startFrame:frame,sourceInFrame:clip.sourceInFrame+leftDuration,durationFrames:rightDuration,fadeInFrames:0});
      validateAudioFades(left);validateAudioFades(right);
      rightId=nextId("audio-clip");right.id=rightId;
      track.clips.splice(index,1,left,right);
    },{audio:true});
    return rightId;
  }

  comment(body: string, anchor: ReviewComment["anchor"], options: MutationOptions & { author?: string } = {}): Id {
    let id = "";
    this.host._applyProduction("add review comment", Object.values(anchor).filter((value): value is string => typeof value === "string"), options.expectedVersion, (document, nextId) => {
      id = nextId("comment");
      document.comments.push({ id, author: options.author ?? this.host.actor, body, status: "open", anchor: structuredClone(anchor), createdAt: new Date().toISOString() });
    });
    return id;
  }

  resolveComment(commentId: Id, options: MutationOptions = {}): void {
    this.host._applyProduction("resolve review comment", [commentId], options.expectedVersion, (document) => {
      const comment = document.comments.find((entry) => entry.id === commentId);
      if (!comment) throw new Error(`Comment not found: ${commentId}`);
      comment.status = "resolved";
      comment.resolvedAt = new Date().toISOString();
    });
  }

  lock(targetType: ProjectLock["targetType"], targetId: Id, reason: string, options: MutationOptions = {}): Id {
    let id = "";
    this.host._applyProduction("lock project target", [targetId], options.expectedVersion, (document, nextId) => {
      if (document.locks.some((lock) => lock.targetType === targetType && lock.targetId === targetId)) throw new Error(`Target is already locked: ${targetId}`);
      id = nextId("lock");
      document.locks.push({ id, targetType, targetId, owner: this.host.actor, reason, createdAt: new Date().toISOString() });
    });
    return id;
  }

  unlock(lockId: Id, options: MutationOptions = {}): void {
    const lock = this.host._readLock(lockId);
    if (lock.owner !== this.host.actor) throw new Error(`Only ${lock.owner} can unlock ${lock.targetId}`);
    this.host._applyProduction("unlock project target", [lock.targetId], options.expectedVersion, (document) => {
      document.locks = document.locks.filter((entry) => entry.id !== lockId);
    });
  }
}
