import {Canvas} from "skia-canvas";
import type {VectorFill} from '../model/types.js';

const context=new Canvas(1,1).getContext("2d"),cache=new Map<string,boolean>();

export function isDrawingColor(value:unknown):value is string{
  if(typeof value!=="string")return false;
  const cached=cache.get(value);
  if(cached!==undefined)return cached;
  let valid=false;
  try{
    // Canvas ignores invalid styles; two prior styles distinguish rejection from a valid match.
    context.fillStyle="#010203";context.fillStyle=value;const first=context.fillStyle;
    context.fillStyle="#040506";context.fillStyle=value;
    valid=first===context.fillStyle;
  }catch{}
  if(cache.size>=256)cache.delete(cache.keys().next().value!);
  cache.set(value,valid);
  return valid;
}

export function isVectorFill(value:unknown):value is VectorFill{
  if(typeof value==='string')return isDrawingColor(value);
  if(!value||typeof value!=='object')return false;
  const fill=value as Record<string,any>;
  if(!['linear','radial'].includes(fill.kind)||Object.keys(fill).some(key=>!['kind','from','to','stops'].includes(key)))return false;
  const radial=fill.kind==='radial';
  for(const point of [fill.from,fill.to]){
    if(!point||typeof point!=='object'||Object.keys(point).some(key=>!(radial?['x','y','radius']:['x','y']).includes(key)))return false;
    for(const key of radial?['x','y','radius']:['x','y'])if(typeof point[key]!=='number'||!Number.isFinite(point[key])||!Number.isFinite(Math.fround(point[key])))return false;
    if(radial&&point.radius<0)return false;
  }
  if(fill.from.x===fill.to.x&&fill.from.y===fill.to.y&&(!radial||fill.from.radius===fill.to.radius))return false;
  if(!Array.isArray(fill.stops)||fill.stops.length<2)return false;
  let previous=0;
  for(const stop of fill.stops){
    if(!stop||typeof stop!=='object'||Object.keys(stop).some(key=>!['offset','color'].includes(key))||!Number.isFinite(stop.offset)||stop.offset<previous||stop.offset>1||!isDrawingColor(stop.color))return false;
    previous=stop.offset;
  }
  return true;
}

export function assertDrawingColors(value:object):void{
  for(const key of ["color","fill","stroke"]){
    const color=(value as Record<string,unknown>)[key];
    const valid=key==='fill'&&(value as {kind?:string}).kind==='vector-path'?isVectorFill(color):isDrawingColor(color);
    if(color!==undefined&&!valid)throw new Error(`Invalid drawing ${key}; use a supported CSS color or valid vector gradient`);
  }
}
