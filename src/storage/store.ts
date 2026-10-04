import {pageBounds} from "../model/query.js";
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import type { Panel, StoryboardDocument, Layer } from "../model/types.js";
import { storyboardSchema } from "../model/schema.js";
import { assertUniqueIds, validateRelationships } from "../model/validate.js";
import { PayloadCodec, digest } from "./codec.js";
import { randomUUID } from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import {assertRenderFrame,selectFramePanels} from "../animation/frame.js";

const APPLICATION_ID = 0x43425244;
const FORMAT_VERSION = 1;
type Header = Omit<StoryboardDocument, "panels" | "components" | "changes">;
type PanelInfo = Omit<Panel, "layers" | "motion">;
type VersionRecord={id:string;position:number;info:string;hash:string};
interface SavedRevision {
  name:string;createdAt:string;version:number;documentHash:string;changesHash:string;
  panels:VersionRecord[];components:VersionRecord[];assets:{id:string;hash:string}[];
}

function identities(panel: Panel) {
  const rows: { id: string; name: string; kind: string }[] = [{id:panel.id,name:panel.title,kind:"panel"}];
  const visit = (layers: Layer[]) => { for (const l of layers) {
    rows.push({id:l.id,name:l.name,kind:l.kind});
    for (const k of l.keyframes) rows.push({id:k.id,name:"",kind:"layer-key"});
    if (l.kind === "group") visit(l.children);
    else for (const e of l.elements) rows.push({id:e.id,name:e.name ?? "",kind:e.kind});
  }};
  visit(panel.layers);
  for (const m of panel.motion) rows.push({id:m.id,name:m.label,kind:"motion"});
  return rows;
}

/** SQLite owns atomic commits; immutable payloads own numeric and resource bytes. */
export class ProjectStore {
  private db: DatabaseSync;
  private codec: PayloadCodec;
  private constructor(readonly path: string, create: boolean) {
    if (!create && !existsSync(path)) throw new Error(`Project does not exist: ${path}`);
    if (create) mkdirSync(dirname(resolve(path)), {recursive:true});
    this.db = new DatabaseSync(path);
    try {
      this.db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; PRAGMA trusted_schema=OFF;");
      const version = Number(this.db.prepare("PRAGMA user_version").get()!.user_version);
      const app = Number(this.db.prepare("PRAGMA application_id").get()!.application_id);
      if (version === 0 && app === 0 && create && !this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").get()) {
        this.db.exec(`BEGIN IMMEDIATE;
          PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=${FORMAT_VERSION};
          CREATE TABLE payloads(hash TEXT PRIMARY KEY,kind TEXT NOT NULL,codec TEXT NOT NULL CHECK(codec IN ('br','raw')),raw_size INTEGER NOT NULL CHECK(raw_size>=0),data BLOB NOT NULL);
          CREATE TABLE roots(key TEXT PRIMARY KEY,hash TEXT NOT NULL REFERENCES payloads(hash)) WITHOUT ROWID;
          CREATE TABLE payload_links(parent TEXT NOT NULL REFERENCES payloads(hash) ON DELETE CASCADE,child TEXT NOT NULL REFERENCES payloads(hash) ON DELETE CASCADE,PRIMARY KEY(parent,child)) WITHOUT ROWID;
          CREATE TABLE panels(id TEXT PRIMARY KEY,position INTEGER NOT NULL,info TEXT NOT NULL,hash TEXT NOT NULL REFERENCES payloads(hash)) WITHOUT ROWID;
          CREATE TABLE components(id TEXT PRIMARY KEY,position INTEGER NOT NULL,info TEXT NOT NULL,hash TEXT NOT NULL REFERENCES payloads(hash)) WITHOUT ROWID;
          CREATE TABLE objects(id TEXT PRIMARY KEY,panel_id TEXT NOT NULL REFERENCES panels(id) ON DELETE CASCADE,name TEXT NOT NULL,kind TEXT NOT NULL) WITHOUT ROWID;
          CREATE INDEX objects_panel ON objects(panel_id);
          CREATE TABLE assets(id TEXT PRIMARY KEY,hash TEXT NOT NULL REFERENCES payloads(hash)) WITHOUT ROWID;
          CREATE TABLE changes(position INTEGER PRIMARY KEY,entry TEXT NOT NULL);
          COMMIT;`);
      } else if (version !== FORMAT_VERSION || app !== APPLICATION_ID) throw new Error(`Unsupported project container (application ${app}, version ${version})`);
      this.codec = new PayloadCodec(this.db);
    } catch (error) { this.db.close(); throw error; }
  }

  static open(path: string): ProjectStore { return new ProjectStore(path, false); }
  static create(path: string): ProjectStore { return new ProjectStore(path, true); }
  close(): void { this.db.close(); }
  [Symbol.dispose](): void { this.close(); }

  private snapshot<T>(work:()=>T):T {
    this.db.exec("SAVEPOINT read_snapshot");
    try {const result=work();this.db.exec("RELEASE read_snapshot");return result;}
    catch(error){this.db.exec("ROLLBACK TO read_snapshot; RELEASE read_snapshot");throw error;}
  }

  private root(key: string): string {
    const row = this.db.prepare("SELECT hash FROM roots WHERE key=?").get(key);
    if (!row) throw new Error(`Missing project root: ${key}`);
    return String(row.hash);
  }
  private setRoot(key: string, value: unknown): void {
    this.db.prepare("INSERT INTO roots VALUES(?,?) ON CONFLICT(key) DO UPDATE SET hash=excluded.hash WHERE hash<>excluded.hash").run(key,this.codec.write(value));
  }
  readHeader(): Header { return this.snapshot(()=>storyboardSchema.omit({panels:true,components:true,changes:true}).parse(this.codec.read(this.root("document"))) as Header); }
  get version(): number { return this.readHeader().version; }

  listPanels(): PanelInfo[] {
    return this.db.prepare("SELECT info FROM panels ORDER BY position").all().map(r=>JSON.parse(String(r.info)));
  }
  findObjects(query: { panelId?: string; name?: string; kind?: string; limit?: number; offset?: number } = {}) {
    const {limit,offset}=pageBounds(query);
    return this.db.prepare("SELECT id,panel_id AS panelId,name,kind FROM objects WHERE (? IS NULL OR panel_id=?) AND (? IS NULL OR instr(lower(name),lower(?))>0) AND (? IS NULL OR kind=?) ORDER BY panel_id,id LIMIT ? OFFSET ?")
      .all(query.panelId??null,query.panelId??null,query.name??null,query.name??null,query.kind??null,query.kind??null,limit,offset);
  }
  readPanel(id: string, options:{revision?:string}={}): Panel {
    return this.snapshot(()=>{
    const row = options.revision?this.revision(options.revision).panels.find(p=>p.id===id):this.db.prepare("SELECT id,info,hash FROM panels WHERE id=?").get(id);
    if (!row) throw new Error(`Panel not found: ${id}`);
    const panel=storyboardSchema.shape.panels.element.parse(this.codec.read(String(row.hash))) as Panel;
    const {layers,motion,...info}=panel;
    if(panel.id!==id||!isDeepStrictEqual(info,JSON.parse(String(row.info))))throw new Error(`Panel index differs from artwork: ${id}`);
    return panel;
    });
  }
  /** Render context contains one decoded panel, plus timeline and small project metadata. */
  panelDocument(id: string, options:{revision?:string}={}): StoryboardDocument {
    return this.snapshot(()=>({...options.revision?this.codec.read<Header>(this.revision(options.revision).documentHash):this.readHeader(),panels:[this.readPanel(id,options)],components:[],changes:[]}));
  }
  readDocument(): StoryboardDocument {
    return this.snapshot(()=>{
      const document=storyboardSchema.parse({...this.readHeader(),panels:this.listPanels().map(p=>this.readPanel(p.id)),components:this.db.prepare("SELECT hash FROM components ORDER BY position").all().map(r=>this.codec.read(String(r.hash))),changes:this.db.prepare("SELECT entry FROM changes ORDER BY position").all().map(r=>JSON.parse(String(r.entry)))}) as StoryboardDocument;
      assertUniqueIds(document);validateRelationships(document);return document;
    });
  }
  readAsset(id: string, options:{expectedVersion?:number;revision?:string} = {}): Buffer {
    return this.snapshot(()=>{
    if(options.expectedVersion!==undefined && this.version!==options.expectedVersion)throw new Error("Embedded asset source changed since open; reopen the project before reading its assets");
    const row = options.revision?this.revision(options.revision).assets.find(a=>a.id===id):this.db.prepare("SELECT hash FROM assets WHERE id=?").get(id);
    if (!row) throw new Error(`Asset not embedded: ${id}`);
    return this.codec.get(String(row.hash),"asset");
    });
  }
  /** Explicit extraction for file-based audio encoders; never writes outside destination. */
  extractAssets(directory: string): void {
    const root = resolve(directory);
    for (const asset of this.readHeader().assets) {
      const target = resolve(root, asset.path), rel = relative(root,target);
      if (!rel || rel.startsWith("..") || isAbsolute(rel)) throw new Error(`Unsafe asset path: ${asset.path}`);
      const bytes = this.readAsset(asset.id);
      mkdirSync(dirname(target),{recursive:true});
      if (existsSync(target)) {
        if (digest(readFileSync(target)) !== digest(bytes)) throw new Error(`Refusing to replace a different extracted asset: ${target}`);
      } else writeFileSync(target,bytes,{flag:"wx"});
    }
  }

  private putPanel(panel: Panel, position: number, hash=this.codec.write(panel)): void {
    const {layers,motion,...info}=panel;
    const prior=this.db.prepare("SELECT hash,position FROM panels WHERE id=?").get(panel.id);
    if (prior?.hash===hash && prior.position===position) return;
    this.db.prepare("INSERT INTO panels VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET position=excluded.position,info=excluded.info,hash=excluded.hash").run(panel.id,position,JSON.stringify(info),hash);
    this.db.prepare("DELETE FROM objects WHERE panel_id=?").run(panel.id);
    const insert=this.db.prepare("INSERT INTO objects VALUES(?,?,?,?)");
    for (const item of identities(panel)) insert.run(item.id,panel.id,item.name,item.kind);
  }

  save(document: StoryboardDocument, options: {expectedVersion?:number;overwrite?:boolean;assetRoot?:string;readAsset?:(id:string)=>Buffer|undefined} = {}): number {
    storyboardSchema.parse(document);
    assertUniqueIds(document);
    validateRelationships(document);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const existing=this.db.prepare("SELECT hash FROM roots WHERE key='document'").get();
      const priorHeader=existing?this.readHeader():undefined;
      if(priorHeader && !options.overwrite && priorHeader.version!==options.expectedVersion) throw new Error(`Disk version conflict: expected ${options.expectedVersion??"new file"}, found ${priorHeader.version}`);
      const writesBefore=Number(this.db.prepare("SELECT total_changes() AS n").get()!.n);
      const {panels,components,changes,...header}=document;
      this.setRoot("document",header);
      for(const row of this.db.prepare("SELECT id FROM panels").all()) if(!panels.some(p=>p.id===row.id)) this.db.prepare("DELETE FROM panels WHERE id=?").run(row.id!);
      const encoded=panels.map((panel,position)=>({panel,position,hash:this.codec.write(panel)}));
      // Release old ownership for every changed panel before transferring IDs between them.
      for(const item of encoded){
        const prior=this.db.prepare("SELECT hash,position FROM panels WHERE id=?").get(item.panel.id);
        if(prior?.hash!==item.hash||prior.position!==item.position)this.db.prepare("DELETE FROM objects WHERE panel_id=?").run(item.panel.id);
      }
      encoded.forEach(({panel,position,hash})=>this.putPanel(panel,position,hash));
      for(const row of this.db.prepare("SELECT id FROM components").all()) if(!components.some(c=>c.id===row.id)) this.db.prepare("DELETE FROM components WHERE id=?").run(row.id!);
      components.forEach((c,i)=>this.db.prepare("INSERT INTO components VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET position=excluded.position,info=excluded.info,hash=excluded.hash WHERE hash<>excluded.hash OR position<>excluded.position").run(c.id,i,JSON.stringify({id:c.id,name:c.name,version:c.version}),this.codec.write(c)));
      this.db.prepare("DELETE FROM changes WHERE position>=?").run(changes.length);
      changes.forEach((c,i)=>this.db.prepare("INSERT INTO changes VALUES(?,?) ON CONFLICT(position) DO UPDATE SET entry=excluded.entry WHERE entry<>excluded.entry").run(i,JSON.stringify(c)));
      for(const row of this.db.prepare("SELECT id FROM assets").all()) if(!document.assets.some(a=>a.id===row.id)) this.db.prepare("DELETE FROM assets WHERE id=?").run(row.id!);
      for(const asset of document.assets) {
        const source=resolve(options.assetRoot??dirname(this.path),asset.path);
        const previous=this.db.prepare("SELECT hash FROM assets WHERE id=?").get(asset.id);
        const original=priorHeader?.assets.find(a=>a.id===asset.id);
        if(previous && !options.overwrite && !options.readAsset && original?.path===asset.path && original.checksum===asset.checksum)continue;
        const portable=!options.assetRoot?options.readAsset?.(asset.id):undefined;
        const bytes=portable??(existsSync(source)?readFileSync(source):previous?this.readAsset(asset.id):options.readAsset?.(asset.id));
        if(!bytes) throw new Error(`Missing asset ${asset.id}: ${source}`);
        if(asset.checksum && digest(bytes)!==asset.checksum) throw new Error(`Asset checksum mismatch: ${asset.id}`);
        this.db.prepare("INSERT INTO assets VALUES(?,?) ON CONFLICT(id) DO UPDATE SET hash=excluded.hash WHERE hash<>excluded.hash").run(asset.id,this.codec.put("asset",bytes));
      }
      const changed=Number(this.db.prepare("SELECT total_changes() AS n").get()!.n)!==writesBefore;
      if(priorHeader&&(changed||options.overwrite)&&header.version<=priorHeader.version){
        header.version=priorHeader.version+1;
        if(!Number.isSafeInteger(header.version))throw new Error("Project version exceeds the safe integer range");
        this.setRoot("document",header);
      }
      this.db.exec("COMMIT");
      return header.version;
    } catch(error) { this.db.exec("ROLLBACK"); throw error; }
  }

  /** Targeted artwork revision. Topology and timeline edits use the full authoring session. */
  updatePanel(panel: Panel, options: {expectedVersion:number;actor?:string}): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const header=this.readHeader(), old=this.readPanel(panel.id), actor=options.actor??"agent:local";
      if(header.version!==options.expectedVersion) throw new Error(`Disk version conflict: expected ${options.expectedVersion}, found ${header.version}`);
      for(const key of ["id","shotId","startFrame","durationFrames"] as const) if(panel[key]!==old[key]) throw new Error(`Targeted panel revision cannot change ${key}; use project timeline API`);
      const ids=identities(old).map(i=>i.id).sort();
      if(JSON.stringify(ids)!==JSON.stringify(identities(panel).map(i=>i.id).sort())) throw new Error("Targeted panel revision must preserve stable identity topology; use a full authoring session for additions/removals");
      for(const lock of header.locks) if(lock.owner!==actor && (lock.targetType==="project" || ids.includes(lock.targetId))) throw new Error(`Locked by ${lock.owner}: ${lock.reason}`);
      const parsed=storyboardSchema.shape.panels.element.parse(panel) as Panel;
      const skeleton:StoryboardDocument={...header,panels:this.listPanels().map(p=>p.id===panel.id?parsed:{...p,layers:[],motion:[]}),components:this.db.prepare("SELECT info FROM components").all().map(r=>({...JSON.parse(String(r.info)),layers:[]})),changes:[],comments:header.comments.filter(c=>(!c.anchor.layerId||ids.includes(c.anchor.layerId))&&(!c.anchor.elementId||ids.includes(c.anchor.elementId))),locks:header.locks.filter(l=>l.targetType!=="layer"||ids.includes(l.targetId))};
      validateRelationships(skeleton);
      parsed.revision=old.revision+1;
      const position=Number(this.db.prepare("SELECT position FROM panels WHERE id=?").get(panel.id)!.position);
      this.putPanel(parsed,position);
      header.version++; header.updatedAt=new Date().toISOString();
      this.setRoot("document",header);
      const index=Number(this.db.prepare("SELECT COALESCE(MAX(position),-1)+1 AS n FROM changes").get()!.n);
      this.db.prepare("INSERT INTO changes VALUES(?,?)").run(index,JSON.stringify({id:`change:store:${header.version}`,version:header.version,actor,operation:"update panel artwork",targetIds:[panel.id],timestamp:header.updatedAt}));
      this.db.exec("COMMIT");
    } catch(error) { this.db.exec("ROLLBACK"); throw error; }
  }

  inspect() {
    return {format:"Codeboard SQLite",formatVersion:FORMAT_VERSION,version:this.version,panels:Number(this.db.prepare("SELECT COUNT(*) AS n FROM panels").get()!.n),payloads:this.db.prepare("SELECT kind,COUNT(*) AS count,SUM(raw_size) AS rawBytes,SUM(length(data)) AS storedBytes FROM payloads GROUP BY kind").all()};
  }
  /** Decode only the current panel and, during a transition, its incoming panel. */
  frameDocument(frame:number,options:{revision?:string}={}):StoryboardDocument{
    assertRenderFrame(frame);
    return this.snapshot(()=>{
      const revision=options.revision?this.revision(options.revision):undefined;
      const header=revision?this.codec.read<Header>(revision.documentHash):this.readHeader();
      const metadata=revision?revision.panels.map(row=>JSON.parse(row.info) as PanelInfo):this.listPanels();
      const {panel,incoming}=selectFramePanels(metadata,frame);
      return {...header,panels:[panel,...incoming?[incoming]:[]].map(p=>this.readPanel(p.id,options)),components:[],changes:[]};
    });
  }

  private revision(name:string):SavedRevision {
    if(!name.trim()||name.length>128)throw new Error("Revision name must contain 1–128 characters");
    return this.codec.read(this.root(`revision:${name}`));
  }

  /** A named root of references, not a second copy of the project's media. */
  saveRevision(name:string, options:{expectedVersion:number}):void {
    if(!name.trim()||name.length>128)throw new Error("Revision name must contain 1–128 characters");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if(this.version!==options.expectedVersion)throw new Error("Disk version conflict while recording revision");
      if(this.db.prepare("SELECT 1 FROM roots WHERE key=?").get(`revision:${name}`))throw new Error(`Revision already exists: ${name}`);
      const snapshot:SavedRevision={name,version:this.version,createdAt:new Date().toISOString(),documentHash:this.root("document"),
        changesHash:this.codec.write(this.db.prepare("SELECT entry FROM changes ORDER BY position").all().map(r=>JSON.parse(String(r.entry)))),
        panels:this.db.prepare("SELECT id,position,info,hash FROM panels ORDER BY position").all() as unknown as VersionRecord[],
        components:this.db.prepare("SELECT id,position,info,hash FROM components ORDER BY position").all() as unknown as VersionRecord[],
        assets:this.db.prepare("SELECT id,hash FROM assets ORDER BY id").all() as unknown as {id:string;hash:string}[]};
      const hash=this.codec.write(snapshot);
      this.codec.retain(hash,[snapshot.documentHash,snapshot.changesHash,...snapshot.panels.map(p=>p.hash),...snapshot.components.map(c=>c.hash),...snapshot.assets.map(a=>a.hash)]);
      this.db.prepare("INSERT INTO roots VALUES(?,?)").run(`revision:${name}`,hash);
      this.db.exec("COMMIT");
    }catch(error){this.db.exec("ROLLBACK");throw error;}
  }

  listRevisions(options:{limit?:number;offset?:number}={}) {
    const {limit,offset}=pageBounds(options);
    return this.snapshot(()=>this.db.prepare("SELECT hash FROM roots WHERE key LIKE 'revision:%' ORDER BY key LIMIT ? OFFSET ?")
      .all(limit,offset)
      .map(r=>{const s=this.codec.read<SavedRevision>(String(r.hash));return {name:s.name,version:s.version,createdAt:s.createdAt,panels:s.panels.length};}));
  }

  readRevision(name:string):StoryboardDocument {
    return this.snapshot(()=>{
      const s=this.revision(name),header=this.codec.read<Header>(s.documentHash);
      const document=storyboardSchema.parse({...header,panels:s.panels.map(p=>this.codec.read(p.hash)),components:s.components.map(c=>this.codec.read(c.hash)),changes:this.codec.read(s.changesHash)}) as StoryboardDocument;
      assertUniqueIds(document);validateRelationships(document);return document;
    });
  }

  restoreRevision(name:string,options:{expectedVersion:number;actor?:string}):void {
    const current=this.readHeader(),actor=options.actor??"agent:local";
    if(current.version!==options.expectedVersion)throw new Error("Disk version conflict while restoring revision");
    const lock=current.locks.find(l=>l.owner!==actor);
    if(lock)throw new Error(`Locked by ${lock.owner}: ${lock.reason}`);
    const document=this.readRevision(name);
    document.version=current.version+1;document.idCounter=Math.max(current.idCounter,document.idCounter);document.updatedAt=new Date().toISOString();
    document.changes=this.db.prepare("SELECT entry FROM changes ORDER BY position").all().map(r=>JSON.parse(String(r.entry)));
    document.changes.push({id:`change:${randomUUID()}`,version:document.version,actor,operation:`restore revision: ${name}`,targetIds:[document.id],timestamp:document.updatedAt});
    this.save(document,{expectedVersion:options.expectedVersion,readAsset:id=>this.readAsset(id,{revision:name})});
  }

  deleteRevision(name:string):void {
    const result=this.db.prepare("DELETE FROM roots WHERE key=?").run(`revision:${name}`);
    if(!result.changes)throw new Error(`Revision not found: ${name}`);
  }
  /** Optional maintenance, never part of a small edit. No artwork precision is changed. */
  compact(): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {this.db.exec(`
      WITH RECURSIVE live(hash) AS (
        SELECT hash FROM roots UNION SELECT hash FROM panels UNION SELECT hash FROM components UNION SELECT hash FROM assets
        UNION SELECT child FROM payload_links JOIN live ON parent=live.hash
      ) DELETE FROM payloads WHERE hash NOT IN (SELECT hash FROM live);`);
      this.db.exec("COMMIT");
    }catch(error){this.db.exec("ROLLBACK");throw error;}
    this.db.exec("VACUUM");
  }
  verify(): void {
    this.snapshot(()=>{
    const result=this.db.prepare("PRAGMA integrity_check").get();
    if(result?.integrity_check!=="ok") throw new Error(`SQLite integrity failure: ${JSON.stringify(result)}`);
    if(this.db.prepare("PRAGMA foreign_key_check").get()) throw new Error("Broken project references");
    for(const row of this.db.prepare("SELECT hash FROM payloads").all()) this.codec.get(String(row.hash));
    const document=this.readDocument();
    for(const panel of document.panels){
      const indexed=this.db.prepare("SELECT id,name,kind FROM objects WHERE panel_id=?").all(panel.id).map(row=>({...row}));
      const expected=new Map(identities(panel).map(item=>[item.id,item]));
      if(indexed.length!==expected.size||indexed.some(item=>!isDeepStrictEqual(item,expected.get(String(item.id)))))throw new Error(`Object index differs from artwork: ${panel.id}`);
    }
    for(const [index,row] of this.db.prepare("SELECT id,info FROM components ORDER BY position").all().entries()){
      const component=document.components[index];
      if(!component||component.id!==row.id||!isDeepStrictEqual(JSON.parse(String(row.info)),{id:component.id,name:component.name,version:component.version}))throw new Error(`Component index differs from artwork: ${row.id}`);
    }
    const assets=this.db.prepare("SELECT id FROM assets").all().map(row=>String(row.id)).sort();
    if(!isDeepStrictEqual(assets,document.assets.map(asset=>asset.id).sort()))throw new Error("Embedded asset index differs from project assets");
    for(const asset of document.assets){
      const bytes=this.readAsset(asset.id);
      if(asset.checksum&&digest(bytes)!==asset.checksum)throw new Error(`Asset checksum mismatch: ${asset.id}`);
    }
    });
  }
}
