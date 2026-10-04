import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { unzipSync } from "fflate";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import sharp from "sharp";
import type { BrushPreset, BrushTip } from "../model/types.js";
import { Reader, readGBR, readABR, type Sample } from "./resource-binary.js";

export interface ResourceOrigin { source: string; author?: string; license: string; redistribution: "allowed"|"unknown"|"forbidden" }
export interface BrushResource {
  id: string; name: string; role: "tip"|"texture"; tip: Extract<BrushTip,{kind:"bitmap"}>;
  originalWidth: number; originalHeight: number; checksum: string; origin: ResourceOrigin;
}
export interface ImportedPreset {
  name: string; engine: string; parameters: Record<string,string>; resourceIds: string[];
  mapped: Partial<Pick<BrushPreset,"spacing"|"opacity"|"flow">>;
  missingDependencies: string[]; unsupported: string[];
}
export interface BrushImportReport {
  format: string; source: ResourceOrigin; checksum: string; resources: BrushResource[];
  presets: ImportedPreset[]; mapped: string[]; missingDependencies: string[]; unsupported: string[]; warnings: string[];
}
export interface ImportOptions {
  origin: ResourceOrigin;
  maxTipSize?: number;
  maskMode?: "alpha"|"luminance"|"inverse-luminance";
  dependencies?: Record<string,Buffer>;
  role?: "tip"|"texture";
}
const sha=(b:Buffer|Uint8Array)=>createHash("sha256").update(b).digest("hex");
const list=(x:any):any[]=>x===undefined?[]:Array.isArray(x)?x:[x];
const xml = (text:string) => {
  text=text.replace(/<!DOCTYPE\s+[A-Za-z_:][\w:.-]*\s*>/g,"");
  if(text.length>8*1024*1024 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error("XML entities/DOCTYPE or oversized XML are not allowed");
  const valid=XMLValidator.validate(text); if(valid!==true) throw new Error(`Invalid preset XML: ${valid.err.msg}`);
  return new XMLParser({ignoreAttributes:false,parseTagValue:false,attributeNamePrefix:"@"}).parse(text);
};

function pngText(data:Buffer):Record<string,string> {
  if(data.subarray(0,8).toString("hex")!=="89504e470d0a1a0a") throw new Error("KPP must be a PNG container");
  const r=new Reader(data);r.take(8); const fields:Record<string,string>={};
  while(r.offset<data.length) {
    const length=r.u32(),type=r.take(4).toString(),chunk=r.take(length);r.take(4);
    if(!["tEXt","zTXt","iTXt"].includes(type)) continue;
    const zero=chunk.indexOf(0); if(zero<1) throw new Error("Invalid PNG text keyword");
    const key=chunk.subarray(0,zero).toString();let value:Buffer;
    if(type==="tEXt") value=chunk.subarray(zero+1);
    else if(type==="zTXt") { if(chunk[zero+1]!==0) throw new Error("Unknown PNG text compression");value=inflateSync(chunk.subarray(zero+2),{maxOutputLength:8*1024*1024}); }
    else {
      const compressed=chunk[zero+1],method=chunk[zero+2];let offset=zero+3;
      for(let i=0;i<2;i++){const end=chunk.indexOf(0,offset);if(end<0)throw new Error("Invalid international PNG text");offset=end+1;}
      if(method!==0||!(compressed===0||compressed===1))throw new Error("Unknown international PNG text compression");
      value=compressed?inflateSync(chunk.subarray(offset),{maxOutputLength:8*1024*1024}):chunk.subarray(offset);
    }
    fields[key]=value.toString("utf8");
  }
  return fields;
}

export async function importBrushResource(path:string, options:ImportOptions):Promise<BrushImportReport> {
  return importBrushResourceBuffer(await readFile(path),basename(path),options);
}

export async function importBrushResourceBuffer(data:Buffer,name:string,options:ImportOptions):Promise<BrushImportReport> {
  if(data.length>64*1024*1024) throw new Error("Brush resource exceeds 64 MB input limit");
  const max=options.maxTipSize??128;
  if(!Number.isInteger(max)||max<1||max>512)throw new Error("maxTipSize must be 1..512");
  const format=extname(name).toLowerCase().slice(1);
  const report:BrushImportReport={format,source:options.origin,checksum:sha(data),resources:[],presets:[],mapped:[],missingDependencies:[],unsupported:[],warnings:[]};
  const addSample=async(sample:Sample,originName:string,role:"tip"|"texture"="tip")=>{
    const {data:pixels,info}=await sharp(sample.alpha,{raw:{width:sample.width,height:sample.height,channels:1}}).resize({width:max,height:max,fit:"inside",withoutEnlargement:true}).greyscale().raw().toBuffer({resolveWithObject:true});
    const checksum=createHash("sha256").update(`mask:${sample.width}x${sample.height}:`).update(sample.alpha).digest("hex");
    const importedChecksum=createHash("sha256").update(`${checksum}:${info.width}x${info.height}:`).update(pixels).digest("hex");
    const id=`resource:${importedChecksum}:${role}`;
    const tip:Extract<BrushTip,{kind:"bitmap"}>={kind:"bitmap",width:info.width,height:info.height,alpha:Array.from(pixels,v=>v/255),angle:0,rotationMode:"stroke",sourceAssetId:id};
    if(!report.resources.some(r=>r.id===id)) report.resources.push({id,name:originName,role,tip,originalWidth:sample.width,originalHeight:sample.height,checksum,origin:options.origin});
    if(info.width!==sample.width||info.height!==sample.height)report.warnings.push(`${originName}: resampled ${sample.width}x${sample.height} to ${info.width}x${info.height}`);
    return id;
  };
  const image=async(bytes:Buffer,entry:string,role:"tip"|"texture"="tip")=>{
    const {data:pixels,info}=await sharp(bytes,{limitInputPixels:16*1024*1024}).toColourspace("srgb").ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const mode=role==="texture"?"luminance":options.maskMode??"alpha";
    const alpha=Uint8Array.from({length:info.width*info.height},(_,i)=>{
      const a=pixels[i*4+3]!/255, l=.2126*pixels[i*4]!+.7152*pixels[i*4+1]!+.0722*pixels[i*4+2]!;
      return Math.round(mode==="alpha"?a*255:(mode==="luminance"?l:255-l)*a);
    });
    if(mode==="alpha"&&alpha.every(v=>v===255))report.warnings.push(`${entry}: alpha is fully opaque; choose inverse-luminance for black-on-white tips`);
    return addSample({name:entry,width:info.width,height:info.height,alpha},entry,role);
  };
  const load=async(bytes:Buffer,entry:string,role:"tip"|"texture"="tip"):Promise<string[]>=>{
    const extension=extname(entry).toLowerCase();
    if(extension===".png") return [await image(bytes,entry,role)];
    if(extension===".gbr") { const s=readGBR(new Reader(bytes)); const id=await addSample(s,entry,role);report.mapped.push(`${entry}: bitmap alpha; native spacing ${s.spacing}`);return [id]; }
    if(extension===".gih") {
      const r=new Reader(bytes),line=()=>{const end=bytes.indexOf(10,r.offset);if(end<0||end-r.offset>4096)throw new Error("Invalid GIH header");return r.take(end-r.offset+1).toString().trim();};
      line(); const header=line(),count=Number(header.split(/\s/)[0]);
      if(!Number.isInteger(count)||count<1||count>4096)throw new Error("Invalid GIH brush count");
      const ids=[];for(let i=0;i<count;i++) ids.push(await addSample(readGBR(r),`${entry}#${i}`,role));
      report.unsupported.push(`${entry}: image-pipe selection dynamics are not emulated (${header}); cells are separate tips`);return ids;
    }
    if(extension===".abr") {
      const result=readABR(bytes);report.unsupported.push(...result.unsupported);const ids=[];
      for(const s of result.samples)ids.push(await addSample(s,`${entry}/${s.name}`,role));return ids;
    }
    report.unsupported.push(`${entry}: resource encoding ${extension} is not decoded`);return [];
  };
  const preset=async(bytes:Buffer,entry:string,dependencies:Record<string,Buffer>)=>{
    const fields=pngText(bytes);
    if(!fields.preset)throw new Error(`${entry}: missing preset metadata; preview is never used as a tip`);
    const root=xml(fields.preset).Preset;
    if(!root)throw new Error(`${entry}: missing Preset XML root`);
    const parameters:Record<string,string>={};
    for(const param of list(root.param))parameters[String(param["@name"])]=String(param["#text"]??"");
    const result:ImportedPreset={name:root["@name"]??entry,engine:root["@paintopid"]??"unknown",parameters,resourceIds:[],mapped:{},missingDependencies:[],unsupported:[]};
    const deps={...dependencies};
    for(const resource of list(root.resources?.resource)) {
      const file=String(resource["@filename"]??"");
      if(!file)continue;
      const decoded=Buffer.from(String(resource["#text"]??""),"base64");
      if(decoded.length>16*1024*1024)throw new Error("Embedded resource exceeds 16 MB");
      const expected=resource["@md5sum"];
      if(expected&&createHash("md5").update(decoded).digest("hex")!==expected)throw new Error(`Embedded resource checksum mismatch: ${file}`);
      deps[file]=decoded;
    }
    const refs:{name:string;role:"tip"|"texture"}[]=[];
    let brushDefinition:any;
    if(parameters.brush_definition) {
      brushDefinition=xml(parameters.brush_definition).Brush;
      const walk=(node:any)=>{if(!node||typeof node!=="object")return;for(const [key,value]of Object.entries(node)){
        if(key==="@filename")refs.push({name:String(value),role:"tip"}); else if(typeof value==="object")walk(value);
      }};walk(brushDefinition);
      const rawSpacing=brushDefinition?.["@spacing"],spacing=Number(rawSpacing);
      if(rawSpacing!==undefined){
        if(String(rawSpacing).trim()&&Number.isFinite(spacing)&&spacing>=.02&&spacing<=4)result.mapped.spacing=spacing;
        else result.unsupported.push(`Unmapped brush spacing: ${rawSpacing} (supported range 0.02..4)`);
      }
    }
    for(const [key,value]of Object.entries(parameters)) {
      if(/Texture\/Pattern\/.*(?:FileName|Filename)$/i.test(key)&&value)refs.push({name:value,role:"texture"});
      if(key==="OpacityValue"||key==="FlowValue") {
        const v=Number(value);
        if(value.trim()&&Number.isFinite(v)&&v>=0&&v<=1)result.mapped[key==="OpacityValue"?"opacity":"flow"]=v;
        else result.unsupported.push(`Unmapped parameter: ${key} = ${value} (supported range 0..1)`);
      }
    }
    let resolvedTip=false;
    for(const ref of refs) {
      const matches=Object.hasOwn(deps,ref.name)?[ref.name]:Object.keys(deps).filter(k=>basename(k)===basename(ref.name));
      if(matches.length!==1) {result.missingDependencies.push(`${ref.name}${matches.length>1?" (ambiguous)":""}`);continue;}
      const ids=await load(deps[matches[0]!]!,ref.name,ref.role);
      result.resourceIds.push(...ids);if(ref.role==='tip'&&ids.length)resolvedTip=true;
    }
    if(!resolvedTip)result.unsupported.push("No explicit bitmap tip reference resolved; auto/procedural/masked brush definitions are not translated");
    result.unsupported.push(`Krita engine '${result.engine}' is not emulated; sensors, mixing, masked brush and texture mode require explicit reauthoring`);
    result.unsupported.push(...Object.keys(parameters).filter(k=>!["brush_definition","OpacityValue","FlowValue","paintop"].includes(k)).map(k=>`Unmapped parameter: ${k}`));
    report.presets.push(result);report.missingDependencies.push(...result.missingDependencies);report.unsupported.push(...result.unsupported);
    report.mapped.push(...Object.entries(result.mapped).map(([k,v])=>`${entry}: ${k} = ${v}`));
  };
  if(format==="bundle") {
    let expanded=0,count=0;
    const entries=unzipSync(data,{filter:entry=>{
      if(++count>4096||entry.originalSize>16*1024*1024||(expanded+=entry.originalSize)>64*1024*1024)throw new Error("Bundle exceeds entry/decompression limits");
      if(entry.name.includes("..")||entry.name.startsWith("/")||entry.name.includes("\\"))throw new Error("Unsafe bundle entry path");
      return true;
    }});
    const deps=Object.fromEntries(Object.entries(entries).map(([k,v])=>[k,Buffer.from(v)]));
    for(const [entry,bytes]of Object.entries(deps)) {
      if(entry.endsWith(".kpp"))await preset(bytes,entry,deps);
      else if(/^(brushes|kis_brushes)\//.test(entry))await load(bytes,entry);
      else if(/^(patterns|kis_patterns)\//.test(entry))await load(bytes,entry,"texture");
    }
    report.warnings.push("Bundle metadata does not establish redistribution permission; origin/license is caller-supplied");
  } else if(format==="kpp")await preset(data,name,options.dependencies??{});
  else await load(data,name,options.role??"tip");
  return report;
}

/** Explicitly reauthor a resource for this engine; never promises source-application parity. */
export function brushFromResource(resource:BrushResource,settings:Omit<BrushPreset,"tip">):BrushPreset {
  if(resource.role!=="tip")throw new Error("A texture resource is not a brush tip; select a tip explicitly");
  return {...structuredClone(settings),tip:structuredClone(resource.tip),provenance:{...resource.origin,resourceChecksum:resource.checksum}};
}
