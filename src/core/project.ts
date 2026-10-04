import {assertRenderFrame,selectFramePanels} from "../animation/frame.js";
import {drawingNeighbors} from "../animation/drawing-neighbors.js";
import {validateRigLayerChange} from "../animation/ik.js";
import {coordinateSpace,type CoordinateOptions} from "./coordinates.js";
import {pageBounds} from "../model/query.js";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readPixelRegion } from "../drawing/pixels.js";
import { ProjectStore } from "../storage/store.js";
import { difference, applyRevision, type Revision } from "./history.js";
import type {
  AudioClipQuery, BlendMode, DrawingElement, DrawingLayer, Id, Layer, LayerChanges, LayerOptions,
  MotionAnnotation, NewDrawingElement, Panel, PanelOptions, ProjectOptions,
  Scene, Shot, StoryboardDocument, Transform, ObjectQuery, PageOptions,
} from "../model/types.js";
import { identityTransform } from "../model/types.js";
import { storyboardSchema,layerChangesSchema } from "../model/schema.js";
import { LayerHandle, PanelHandle, SceneHandle, Selection, ShotHandle, SequenceHandle } from "./handles.js";
import { assertUniqueIds, validateRelationships, validateLayerDependencies,parseStoryboardDocument } from "../model/validate.js";
import { ProductionTools, editTimelineStructure, removeReviewAnchors, type ProductionScope } from "./production.js";
import { brushes as builtinBrushes } from "../drawing/brushes.js";
import {findObjects,inspectProject} from "./inspection.js";
import { retimePanel } from "../animation/retime.js";
import {assertDrawingColors} from "../drawing/color.js";

const clone = <T>(value: T): T => structuredClone(value);
const now = () => new Date().toISOString();

function layerBase(id: string, name: string, options: LayerOptions) {
  const transform: Transform = { ...identityTransform(), ...options.transform };
  return {
    id,
    name,
    visible: options.visible ?? true,
    opacity: options.opacity ?? 1,
    blendMode: options.blendMode ?? "source-over" as BlendMode,
      transform,
      ...(options.pivot?{pivot:clone(options.pivot)}:{}),
    ...(options.maskLayerId ? { maskLayerId: options.maskLayerId } : {}),
    clipToBelow: options.clipToBelow ?? false,
    keyframes: [],
    depth: options.depth ?? 1,
    exposure: clone(options.exposure ?? null),
  };
}

function allLayers(layers: Layer[]): Layer[] {
  return layers.flatMap((layer) => layer.kind === "group" ? [layer, ...allLayers(layer.children)] : [layer]);
}

function findDocumentLayer(document:StoryboardDocument,id:Id):Layer{
  for(const owner of [...document.panels,...document.components]){
    const layer=allLayers(owner.layers).find(layer=>layer.id===id);
    if(layer)return layer;
  }
  throw new Error(`Layer not found: ${id}`);
}

function findLayer(panel: Panel, layerId: Id): Layer {
  const layer = allLayers(panel.layers).find((entry) => entry.id === layerId);
  if (!layer) throw new Error(`Layer not found: ${layerId}`);
  return layer;
}

function findDrawingLayer(panel: Panel, layerId: Id): DrawingLayer {
  const layer = findLayer(panel, layerId);
  if (layer.kind === "group") throw new Error(`Layer ${layerId} is a group, not a drawing layer`);
  return layer;
}

export class StoryboardProject {
  #document: StoryboardDocument;
  #undo: Revision[] = [];
  #redo: Revision[] = [];
  #transactionDepth = 0;
  #transactionTargets = new Set<Id>();
  #writablePanels = new Set<Id>();
  #writableMetadata = false;
  #writableAudio = false;
  #writableShots = new Set<Id>();
  #writableDocument = false;
  #savedVersions = new Map<string,number>();
  #assetPath: string | undefined;
  readonly production: ProductionTools;

  private constructor(document: StoryboardDocument, readonly actor = "agent:local") {
    this.#document = document;
    this.production = new ProductionTools(this);
  }

  static create(options: ProjectOptions): StoryboardProject {
    const timestamp = now();
    return new StoryboardProject({
      schemaVersion: 3,
      version: 0,
      id: options.id ?? "project:1",
      title: options.title,
      ...(options.author ? { author: options.author } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
      canvas: {
        width: options.width ?? 1280,
        height: options.height ?? 720,
        background: options.background ?? "#ffffff",
      },
      seed: options.seed ?? 1,
      frameRate: options.frameRate ?? 24,
      idCounter: 1,
      scenes: [],
      sequences:[{id:"sequence:main",name:"Main sequence",sceneIds:[]}],
      shots: [],
      panels: [],
      brushes: Object.values(builtinBrushes).map((brush) => clone(brush)),
      assets: [],
      audioTracks: [],
      comments: [],
      locks: [],
      changes: [],
      metadata: {},
      components: [],
    });
  }

  static fromJSON(input: unknown, options: { actor?: string } = {}): StoryboardProject {
    return new StoryboardProject(parseStoryboardDocument(input), options.actor ?? "agent:local");
  }

  static async open(path: string, options: { actor?: string } = {}): Promise<StoryboardProject> {
    const store=ProjectStore.open(path);
    try {
      const project=new StoryboardProject(store.readDocument(), options.actor??"agent:local");
      project.#savedVersions.set(resolve(path),project.version);
      project.#assetPath=resolve(path);
      return project;
    } finally { store.close(); }
  }

  get id(): string { return this.#document.id; }
  get title(): string { return this.#document.title; }
  get canUndo(): boolean { return this.#undo.length > 0; }
  get canRedo(): boolean { return this.#redo.length > 0; }
  get version(): number { return this.#document.version; }

  toJSON(): StoryboardDocument {
    return clone(this.#document);
  }

  _findObjects(query:ObjectQuery){return findObjects(this.#document,query);}

  _coordinates(targetId:Id,options:CoordinateOptions){return coordinateSpace(this.#document,targetId,options);}

  _inspectProject(){return inspectProject(this.#document);}

  _readChanges(version:number,options:PageOptions){
    if(!Number.isSafeInteger(version)||version<0)throw new Error("Audit version must be a nonnegative safe integer");
    const {limit,offset}=pageBounds(options),result:StoryboardDocument["changes"]=[];let skipped=0;
    for(const change of this.#document.changes){
      if(change.version<=version)continue;
      if(skipped++<offset)continue;
      result.push(change);if(result.length===limit)break;
    }
    return clone(result);
  }

  _readBrush(id:Id){
    const brush=this.#document.brushes.find(entry=>entry.id===id);
    if(!brush)throw new Error(`Brush not found: ${id}`);
    return clone(brush);
  }

  _readLock(id:Id){
    const lock=this.#document.locks.find(entry=>entry.id===id);
    if(!lock)throw new Error(`Lock not found: ${id}`);
    return clone(lock);
  }

  _readLayer(id:Id):Layer{
    return clone(findDocumentLayer(this.#document,id));
  }

  _readLayerKeyframes(id:Id,options:PageOptions){
    const {limit,offset}=pageBounds(options);
    return clone([...findDocumentLayer(this.#document,id).keyframes].sort((a,b)=>a.frame-b.frame).slice(offset,offset+limit));
  }

  _readCameraKeyframes(id:Id,options:PageOptions){
    const {limit,offset}=pageBounds(options),shot=this.#document.shots.find(shot=>shot.id===id);
    if(!shot)throw new Error(`Shot not found: ${id}`);
    return clone([...shot.cameraKeyframes].sort((a,b)=>a.frame-b.frame).slice(offset,offset+limit));
  }

  _readTwoBoneRig(id:Id){
    const layer=findDocumentLayer(this.#document,id);
    if(layer.kind!=="group")throw new Error(`Rig requires a group: ${id}`);
    return clone(layer.twoBoneRig??null);
  }

  _readDrawingSequence(id:Id){
    const layer=findDocumentLayer(this.#document,id);
    if(layer.kind!=="group")throw new Error(`Drawing sequence requires a group: ${id}`);
    return {keys:clone(layer.drawingSequence??null),drawings:layer.children.map(({id,name,kind})=>({id,name,kind}))};
  }

  _readAudioTracks(options:PageOptions){
    const {offset,limit}=pageBounds(options);
    return this.#document.audioTracks.slice(offset,offset+limit).map(({clips,...track})=>({...track,clipCount:clips.length}));
  }

  _readAudioClips(trackId:Id,options:AudioClipQuery){
    const {offset,limit}=pageBounds(options);
    if(options.frame!==undefined)assertRenderFrame(options.frame);
    const track=this.#document.audioTracks.find(track=>track.id===trackId);
    if(!track)throw new Error(`Audio track not found: ${trackId}`);
    let skipped=0;const result=[];
    for(const clip of track.clips){
      if(options.assetId!==undefined&&clip.assetId!==options.assetId)continue;
      if(options.frame!==undefined&&(options.frame<clip.startFrame||options.frame>=clip.startFrame+clip.durationFrames))continue;
      if(skipped++<offset)continue;
      result.push(clone(clip));if(result.length===limit)break;
    }
    return result;
  }

  _readAudioClip(id:Id){
    for(const track of this.#document.audioTracks){
      const clip=track.clips.find(clip=>clip.id===id);
      if(clip)return {...clone(clip),trackId:track.id};
    }
    throw new Error(`Audio clip not found: ${id}`);
  }

  _readRenderPanels(ids:readonly Id[]):Pick<StoryboardDocument,"canvas"|"panels"|"shots">{
    const panels=[...new Set(ids)].map(id=>this.#getPanel(id));
    const shots=new Set(panels.map(panel=>panel.shotId));
    return clone({canvas:this.#document.canvas,panels,shots:this.#document.shots.filter(shot=>shots.has(shot.id))});
  }

  _readRenderFrame(frame:number):Pick<StoryboardDocument,"canvas"|"panels"|"shots">{
    const {panel,incoming}=selectFramePanels(this.#document.panels,frame);
    return this._readRenderPanels(incoming?[panel.id,incoming.id]:[panel.id]);
  }

  _readDrawingNeighbors(id:Id,frame:number,skipBlank:boolean){
    const panel=this.#document.panels.find(panel=>allLayers(panel.layers).some(layer=>layer.id===id));
    if(!panel)throw new Error(`Panel drawing track not found: ${id}`);
    const layer=findLayer(panel,id);
    if(layer.kind!=="group"||layer.drawingSequence===undefined)throw new Error(`Layer is not a drawing sequence: ${id}`);
    return drawingNeighbors(layer.drawingSequence,frame,panel.startFrame,panel.startFrame+panel.durationFrames,skipBlank);
  }

  _readElement(id:Id):DrawingElement{
    for(const owner of [...this.#document.panels,...this.#document.components]){
      for(const layer of allLayers(owner.layers)){
        if(layer.kind==="group")continue;
        const element=layer.elements.find(entry=>entry.id===id);
        if(element)return clone(element);
      }
    }
    throw new Error(`Drawing element not found: ${id}`);
  }

  readAsset(id: string): Buffer {
    if(!this.#assetPath) throw new Error("Unsaved project assets require assetRoot; save the project to embed them first");
    const store=ProjectStore.open(this.#assetPath);
    try{
      return store.readAsset(id,{expectedVersion:this.#savedVersions.get(this.#assetPath)!});
    }finally{store.close();}
  }

  async save(path: string, options:{overwrite?:boolean;expectedVersion?:number;assetRoot?:string}={}): Promise<void> {
    if(this.#transactionDepth>0)throw new Error("Cannot save during an authoring transaction; save after the transaction commits");
    const store=ProjectStore.create(path);
    try {
      const expected=options.expectedVersion??this.#savedVersions.get(resolve(path));
      const committedVersion=store.save(this.#document,{...options,...(expected===undefined?{}:{expectedVersion:expected}),...(this.#assetPath && this.#assetPath!==resolve(path)?{readAsset:(id:string)=>{
        const original=ProjectStore.open(this.#assetPath!);
        try{
          if(original.version!==this.#savedVersions.get(this.#assetPath!))throw new Error("Embedded asset source changed since open; reopen before saving a copy");
          return original.readHeader().assets.some(a=>a.id===id)?original.readAsset(id,{expectedVersion:this.#savedVersions.get(this.#assetPath!)!}):undefined;
        }finally{original.close();}
      }}:{})});
      this.#document.version=committedVersion;
      this.#savedVersions.set(resolve(path),this.version);
      this.#assetPath=resolve(path);
    } finally { store.close(); }
  }

  transaction<T>(label: string, work: () => T): T {
    if (work.constructor.name === "AsyncFunction") throw new Error("Transactions must be synchronous; load assets before authoring");
    if (this.#transactionDepth > 0) return work();
    const before = this.#document;
    this.#document={...before,panels:before.panels.slice(),changes:before.changes.slice()};
    this.#writablePanels.clear();
    this.#writableShots.clear();
    this.#writableMetadata=false;
    this.#writableAudio=false;
    this.#writableDocument=false;
    this.#transactionTargets.clear();
    this.#transactionDepth += 1;
    try {
      const result = work();
      if (result && typeof (result as { then?: unknown }).then === "function") throw new Error("Transactions must not return a Promise");
      this.#normalizePanelRevisions(before);
      this.#validate();
      this.#assertLocksUnchanged(before);
      this.#undo.push(difference(before,this.#document));
      if (this.#undo.length > 32) this.#undo.shift();
      this.#redo = [];
      this.#document.updatedAt = now();
      this.#recordChange(label, [...this.#transactionTargets,...this.#document.panels.filter(p=>!isDeepStrictEqual(p,before.panels.find(old=>old.id===p.id))).map(p=>p.id)]);
      return result;
    } catch (error) {
      this.#document = before;
      throw new Error(`Transaction "${label}" failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.#transactionDepth -= 1;
    }
  }

  undo(): boolean {
    if(this.#transactionDepth>0)throw new Error("Cannot undo during an authoring transaction; finish or cancel the transaction first");
    const previous = this.#undo.at(-1);
    if (!previous) return false;
    const current = this.#document;
    this.#document = applyRevision(current,previous,"before");
    this.#undo.pop();
    this.#redo.push(previous);
    this.#document.version = current.version;
    this.#document.changes = current.changes.slice();
    this.#document.idCounter = Math.max(current.idCounter, this.#document.idCounter);
    this.#document.updatedAt = now();
    this.#recordChange("undo", []);
    return true;
  }

  redo(): boolean {
    if(this.#transactionDepth>0)throw new Error("Cannot redo during an authoring transaction; finish or cancel the transaction first");
    const next = this.#redo.at(-1);
    if (!next) return false;
    const current = this.#document;
    this.#document = applyRevision(current,next,"after");
    this.#redo.pop();
    this.#undo.push(next);
    this.#document.version = current.version;
    this.#document.changes = current.changes.slice();
    this.#document.idCounter = Math.max(current.idCounter, this.#document.idCounter);
    this.#document.updatedAt = now();
    this.#recordChange("redo", []);
    return true;
  }

  setMetadata(key: string, value: string): this {
    this.#mutate("set metadata", [this.id], () => { this.#document.metadata[key] = value; },"metadata");
    return this;
  }

  addScene(name: string, id?: Id): SceneHandle {
    return this._addScene("sequence:main",name,id);
  }

  addSequence(name:string,id?:Id):SequenceHandle{
    let sequenceId="";
    this.#mutate("add sequence",[this.id],()=>{sequenceId=id??this.#nextId("sequence");this.#document.sequences.push({id:sequenceId,name,sceneIds:[]});});
    return new SequenceHandle(this,sequenceId);
  }

  _addScene(sequenceId:Id,name:string,id?:Id):SceneHandle{
    let sceneId = "";
    this.#mutate("add scene", [this.id], () => {
      const sequence=this.#document.sequences.find(s=>s.id===sequenceId);if(!sequence)throw new Error(`Sequence not found: ${sequenceId}`);
      sceneId = id ?? this.#nextId("scene");
      this.#document.scenes.push({ id: sceneId, name, sequenceId, shotIds: [] });
      sequence.sceneIds.push(sceneId);
      this.#document.scenes=this.#document.sequences.flatMap(s=>s.sceneIds.map(id=>this.#document.scenes.find(s=>s.id===id)!));
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

  select(query: { panelId: Id; layerId?: Id; elementIds?: Id[] }): Selection {
    return new Selection(this, query.panelId, query.layerId, query.elementIds ?? []);
  }

  #prepareMutation(scope: {panelId:Id}|{shotId:Id}|"audio"|"metadata"|"document"):void{
    if(this.#writableDocument)return;
    if(scope==="audio"){
      if(!this.#writableAudio)this.#document.audioTracks=clone(this.#document.audioTracks);
      this.#writableAudio=true;
    }else if(scope==="metadata"){
      if(!this.#writableMetadata)this.#document.metadata=clone(this.#document.metadata);
      this.#writableMetadata=true;
    }else if(scope==="document"){
      const {panels,metadata,...rest}=this.#document;
      Object.assign(this.#document,clone(rest));
      this.#document.panels=panels.map(panel=>this.#writablePanels.has(panel.id)?panel:clone(panel));
      if(!this.#writableMetadata)this.#document.metadata=clone(metadata);
      this.#writableDocument=true;
    }else if("shotId" in scope){
      if(!this.#writableShots.has(scope.shotId)){
        const index=this.#document.shots.findIndex(shot=>shot.id===scope.shotId);
        if(index<0)throw new Error(`Shot not found: ${scope.shotId}`);
        if(!this.#writableShots.size)this.#document.shots=this.#document.shots.slice();
        this.#document.shots[index]=clone(this.#document.shots[index]!);
        this.#writableShots.add(scope.shotId);
      }
    }else if(!this.#writablePanels.has(scope.panelId)){
      const index=this.#document.panels.findIndex(p=>p.id===scope.panelId);
      if(index<0)throw new Error(`Panel not found: ${scope.panelId}`);
      this.#document.panels[index]=clone(this.#document.panels[index]!);
      this.#writablePanels.add(scope.panelId);
    }
  }

  #mutate(operation: string, targetIds: Id[], work: () => void,scope:{panelId:Id}|{shotId:Id}|"audio"|"metadata"|"document"="document"): void {
    this.#assertEditableTargets(targetIds);
    if (this.#transactionDepth > 0) {
      this.#prepareMutation(scope);
      targetIds.forEach(id=>this.#transactionTargets.add(id));
      work();
      return;
    }
    this.transaction(operation,()=>this.#mutate(operation,targetIds,work,scope));
  }

  #nextId(prefix: string): string {
    const id = `${prefix}:${this.#document.idCounter}`;
    this.#document.idCounter += 1;
    return id;
  }

  #validate(): void {
    storyboardSchema.parse(this.#document);
    assertUniqueIds(this.#document);
    validateRelationships(this.#document);
  }

  #normalizePanelRevisions(before:StoryboardDocument):void{
    for(const panel of this.#document.panels){const previous=before.panels.find(p=>p.id===panel.id);if(!isDeepStrictEqual(panel,previous))panel.revision=(previous?.revision??0)+1;}
  }

  #assertLocksUnchanged(before:StoryboardDocument):void{
    for(const lock of before.locks.filter(l=>l.owner!==this.actor)){
      const target=(d:StoryboardDocument)=>lock.targetType==="project"?d:lock.targetType==="panel"?d.panels.find(p=>p.id===lock.targetId):d.panels.flatMap(p=>allLayers(p.layers)).find(l=>l.id===lock.targetId);
      if(!isDeepStrictEqual(target(before),target(this.#document)))throw new Error(`Locked by ${lock.owner}: ${lock.reason}`);
    }
  }

  #recordChange(operation: string, targetIds: Id[]): void {
    this.#document.version += 1;
    this.#document.changes.push({
      id: this.#nextId("change"), version: this.#document.version, actor: this.actor,
      operation, targetIds: [...targetIds], timestamp: now(),
    });
  }

  #getScene(id: Id): Scene {
    const scene = this.#document.scenes.find((entry) => entry.id === id);
    if (!scene) throw new Error(`Scene not found: ${id}`);
    return scene;
  }

  #getShot(id: Id): Shot {
    const shot = this.#document.shots.find((entry) => entry.id === id);
    if (!shot) throw new Error(`Shot not found: ${id}`);
    return shot;
  }

  #getPanel(id: Id): Panel {
    const panel = this.#document.panels.find((entry) => entry.id === id);
    if (!panel) throw new Error(`Panel not found: ${id}`);
    return panel;
  }

  _addShot(sceneId: Id, name: string, id?: Id): ShotHandle {
    let shotId = "";
    this.#mutate("add shot", [sceneId], () => {
      const scene = this.#getScene(sceneId);
      shotId = id ?? this.#nextId("shot");
      this.#document.shots.push({ id: shotId, sceneId, name, panelIds: [], cameraKeyframes: [] });
      scene.shotIds.push(shotId);
    });
    return new ShotHandle(this, shotId);
  }

  _addPanel(shotId: Id, options: PanelOptions): PanelHandle {
    let panelId = "";
    this.#mutate("add panel", [shotId], () => editTimelineStructure(this.#document,()=>{
      const shot = this.#getShot(shotId);
      panelId = options.id ?? this.#nextId("panel");
      const startFrame = this.#document.panels.reduce((maximum, entry) => Math.max(maximum, entry.startFrame + entry.durationFrames), 0);
      const panel: Panel = {
        id: panelId,
        shotId,
        number: options.number ?? String(this.#document.panels.length + 1),
        title: options.title ?? "Untitled panel",
        width: options.width ?? this.#document.canvas.width,
        height: options.height ?? this.#document.canvas.height,
        durationFrames: options.durationFrames ?? 48,
        startFrame,
        transition: { type: "cut", durationFrames: 0 },
        status: "working",
        action: options.action ?? "",
        dialogue: options.dialogue ?? "",
        camera: options.camera ?? "",
        notes: options.notes ?? "",
        layers: [],
        motion: [],
        revision: 0,
      };
      this.#document.panels.push(panel);
      shot.panelIds.push(panelId);
    }));
    return new PanelHandle(this, panelId);
  }

  _addLayer(panelId: Id, kind: "raster" | "vector" | "group", name: string, options: LayerOptions, parentGroupId?: Id): LayerHandle {
    let id = "";
    this.#assertEditable(panelId);
    this.#mutate("add layer", [panelId], () => {
      const panel = this.#getPanel(panelId);
      id = options.id ?? this.#nextId("layer");
      const base = layerBase(id, name, options);
      const layer: Layer = kind === "group" ? { ...base, kind, children: [] } : { ...base, kind, elements: [] };
      if (parentGroupId) {
        const group = findLayer(panel, parentGroupId);
        if (group.kind !== "group") throw new Error(`Parent ${parentGroupId} is not a group`);
        group.children.push(layer);
      } else {
        panel.layers.push(layer);
      }
      panel.revision += 1;
    },{panelId});
    return new LayerHandle(this, panelId, id);
  }

  _addElement(panelId: Id, layerId: Id, element: NewDrawingElement): Id {
    let id = "";
    this.#assertEditable(panelId, layerId);
    assertDrawingColors(element);
    this.#mutate("add drawing element", [panelId, layerId], () => {
      const panel = this.#getPanel(panelId);
      const layer = findDrawingLayer(panel, layerId);
      const raster=element.kind === "raster-stroke" || element.kind === "raster-surface";
      if (raster !== (layer.kind === "raster")) throw new Error(`${element.kind} requires a ${raster?"raster":"vector"} layer`);
      id = element.id ?? this.#nextId("element");
      layer.elements.push({ ...element, id } as DrawingElement);
      panel.revision += 1;
    },{panelId});
    return id;
  }

  _addMotion(panelId: Id, annotation: Omit<MotionAnnotation, "id"> & { id?: Id }): Id {
    let id = "";
    this.#assertEditable(panelId);
    assertDrawingColors(annotation);
    this.#mutate("add motion annotation", [panelId], () => {
      const panel = this.#getPanel(panelId);
      id = annotation.id ?? this.#nextId("motion");
      panel.motion.push({ ...clone(annotation), id });
      panel.revision += 1;
    },{panelId});
    return id;
  }

  _updatePanel(panelId: Id, changes: Partial<Pick<Panel, "title" | "durationFrames" | "action" | "dialogue" | "camera" | "notes">>): void {
    this.#assertEditable(panelId);
    this.#mutate("update panel", [panelId], () => {
      const panel = this.#getPanel(panelId);
      const { durationFrames, ...metadata } = changes;
      if (durationFrames !== undefined) retimePanel(this.#document, panelId, durationFrames);
      Object.assign(panel, metadata);
      panel.revision += 1;
    },changes.durationFrames===undefined?{panelId}:"document");
  }

  _updateLayer(panelId: Id, layerId: Id, changes: LayerChanges): void {
    this.#assertEditable(panelId, layerId);
    this.#mutate("update layer", [panelId, layerId], () => {
      const panel = this.#getPanel(panelId);
      const layer=findLayer(panel,layerId);
      const {maskLayerId,...parsed}=layerChangesSchema.parse(changes);
      const properties=Object.fromEntries(Object.entries(parsed).filter(([,value])=>value!==undefined));
      if(maskLayerId!==undefined&&maskLayerId!==null){
        const dependencies=new Map(allLayers(panel.layers).map(entry=>[entry.id,entry]));
        dependencies.set(layerId,{...layer,maskLayerId});
        validateLayerDependencies(dependencies);
      }
      validateRigLayerChange(panel.layers,{...layer,...properties});
      Object.assign(layer,properties);
      if(maskLayerId===null)delete layer.maskLayerId;
      else if(maskLayerId!==undefined)layer.maskLayerId=maskLayerId;
      panel.revision += 1;
    },{panelId});
  }

  _updateElement(panelId: Id, layerId: Id, elementId: Id, updater: (element: DrawingElement) => DrawingElement): void {
    this._updateElements(panelId,layerId,[elementId],updater);
  }

  _updateElements(panelId: Id, layerId: Id, elementIds: Id[], updater: (element: DrawingElement) => DrawingElement): void {
    this.#assertEditable(panelId, layerId);
    const selected=new Set(elementIds);
    if(!selected.size)throw new Error("Element update requires at least one target");
    this.#mutate("update drawing elements", [panelId, layerId, ...selected], () => {
      const panel = this.#getPanel(panelId);
      const layer = findDrawingLayer(panel, layerId);
      const existing=new Set(layer.elements.map(e=>e.id));
      for(const id of selected)if(!existing.has(id))throw new Error(`Element not found: ${id}`);
      const updated=layer.elements.map(original=>{
        if(!selected.has(original.id))return original;
        const result=updater(clone(original));
        if(result.id!==original.id)throw new Error("Editing an element may not change its stable id");
        assertDrawingColors(result);
        return clone(result);
      });
      layer.elements = updated;
      panel.revision += 1;
    },{panelId});
  }

  _readPixels(panelId: Id, layerId: Id, elementId: Id, region?: import("../model/types.js").PixelRegion): import("../model/types.js").PixelBuffer {
    const element=findDrawingLayer(this.#getPanel(panelId),layerId).elements.find(e=>e.id===elementId);
    if(element?.kind!=="raster-surface")throw new Error(`Element ${elementId} is not a pixel surface`);
    return readPixelRegion(element,region??{x:0,y:0,width:element.width,height:element.height});
  }

  _remove(panelId: Id, layerId?: Id, elementIds: Id[] = []): void {
    this.#assertEditable(panelId, layerId);
    this.#mutate("remove drawing elements", [panelId, ...(layerId ? [layerId] : []), ...elementIds], () => {
      const panel = this.#getPanel(panelId);
      if (!layerId) throw new Error("Selection.remove() requires a layerId");
      const layer = findDrawingLayer(panel, layerId);
      const existing=new Set(layer.elements.map(e=>e.id));
      for(const id of elementIds)if(!existing.has(id))throw new Error(`Element not found: ${id}`);
      const before = layer.elements.length;
      layer.elements = layer.elements.filter((element) => !elementIds.includes(element.id));
      if (layer.elements.length === before) throw new Error("Selection did not match any elements");
      removeReviewAnchors(this.#document,new Set(elementIds));
      panel.revision += 1;
    },{panelId});
  }

  _applyProduction(operation: string, targetIds: Id[], expectedVersion: number | undefined, work: (document: StoryboardDocument, nextId: (prefix: string) => Id) => void, scope?:ProductionScope): void {
    if (expectedVersion !== undefined && expectedVersion !== this.version) {
      throw new Error(`Version conflict: expected ${expectedVersion}, current ${this.version}`);
    }
    this.#assertEditableTargets(targetIds);
    let panelId:Id|undefined;
    if(scope&&!("shotId" in scope)&&!("audio" in scope)){
      if("panelId" in scope)panelId=scope.panelId;
      else{
        panelId=this.#document.panels.find(panel=>allLayers(panel.layers).some(layer=>layer.id===scope.layerId))?.id;
        if(!panelId)throw new Error(`Layer not found: ${scope.layerId}`);
      }
      this.#assertEditableTargets([panelId]);
    }
    this.#mutate(operation, targetIds, () => work(this.#document, (prefix) => this.#nextId(prefix)),panelId?{panelId}:scope&&"shotId" in scope?scope:scope&&"audio" in scope?"audio":"document");
  }

  #assertEditable(panelId?: Id, layerId?: Id): void {
    this.#assertEditableTargets([...(panelId ? [panelId] : []), ...(layerId ? [layerId] : [])]);
  }

  #assertEditableTargets(targetIds: Id[]): void {
    const blocking = this.#document.locks.find((lock) =>
      lock.owner !== this.actor && (lock.targetType === "project" || targetIds.includes(lock.targetId)),
    );
    if (blocking) throw new Error(`Locked by ${blocking.owner}: ${blocking.reason}`);
  }
}
