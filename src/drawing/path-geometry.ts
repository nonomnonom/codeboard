import {Path2D} from "skia-canvas";
import type {PathCommand} from "../model/types.js";

export type PathBooleanOperation="union"|"intersect"|"difference"|"xor";
const coordinates:Record<PathCommand["op"],readonly string[]>={M:["x","y"],L:["x","y"],Q:["x1","y1","x","y"],C:["x1","y1","x2","y2","x","y"],Z:[]};

/** Insert a knot using de Casteljau subdivision; retain editable curve commands. */
export function splitPathSegment(commands:readonly PathCommand[],index:number,t=.5):PathCommand[]{
  if(!Number.isSafeInteger(index)||index<0||index>=commands.length)throw new Error("Path segment index is out of range");
  if(!Number.isFinite(t)||t<=0||t>=1)throw new Error("Path split parameter must be strictly between 0 and 1");
  const segment=commands[index]!;
  if(segment.op==='M'||segment.op==='Z')throw new Error("Split an L, Q or C segment; M and Z are not supported");
  contourPath(commands);
  let current={x:0,y:0},start=current;
  for(const command of commands.slice(0,index)){
    if(command.op==='Z')current=start;
    else {current={x:command.x,y:command.y};if(command.op==='M')start=current;}
  }
  const mix=(a:{x:number;y:number},b:{x:number;y:number})=>({x:(1-t)*a.x+t*b.x,y:(1-t)*a.y+t*b.y});
  const end={x:segment.x,y:segment.y};let halves:PathCommand[];
  if(segment.op==='L')halves=[{op:'L',...mix(current,end)},{op:'L',...end}];
  else if(segment.op==='Q'){
    const control={x:segment.x1,y:segment.y1},a=mix(current,control),b=mix(control,end),knot=mix(a,b);
    halves=[{op:'Q',x1:a.x,y1:a.y,...knot},{op:'Q',x1:b.x,y1:b.y,...end}];
  }else if(segment.op==='C'){
    const a=mix(current,{x:segment.x1,y:segment.y1}),b=mix({x:segment.x1,y:segment.y1},{x:segment.x2,y:segment.y2}),c=mix({x:segment.x2,y:segment.y2},end);
    const d=mix(a,b),e=mix(b,c),knot=mix(d,e);
    halves=[{op:'C',x1:a.x,y1:a.y,x2:d.x,y2:d.y,...knot},{op:'C',x1:e.x,y1:e.y,x2:c.x,y2:c.y,...end}];
  }else throw new Error("Unsupported path segment");
  return [...commands.slice(0,index),...halves,...commands.slice(index+1)].map(command=>({...command}));
}

/** Shared native conversion for rendering and explicit geometry operations. */
export function contourPath(commands:readonly PathCommand[],requireClosed=false):Path2D{
  const path=new Path2D();let opened=false,hasPoint=false;
  for(const command of commands){
    const fields=coordinates[command.op];
    if(!fields)throw new Error(`Unsupported path command: ${command.op}`);
    for(const key of fields){const value=(command as unknown as Record<string,number>)[key];if(typeof value!=="number"||!Number.isFinite(value)||!Number.isFinite(Math.fround(value)))throw new Error(`Path ${command.op}.${key} must be finite and within Skia's scalar range`);}
    if(command.op==="M"){
      if(requireClosed&&opened)throw new Error("Boolean operations require explicitly closed contours");
      path.moveTo(command.x,command.y);opened=true;hasPoint=true;
    }else{
      if(!hasPoint||(requireClosed&&!opened))throw new Error("A contour must begin with M");
      if(command.op==="L")path.lineTo(command.x,command.y);
      else if(command.op==="Q")path.quadraticCurveTo(command.x1,command.y1,command.x,command.y);
      else if(command.op==="C")path.bezierCurveTo(command.x1,command.y1,command.x2,command.y2,command.x,command.y);
      else {path.closePath();opened=false;}
    }
  }
  if(requireClosed&&opened)throw new Error("Boolean operations require explicitly closed contours");
  return path;
}

function commandsOf(path:Path2D):PathCommand[]{
  return path.edges.map(([verb,...p]):PathCommand=>{
    if(p.some(value=>!Number.isFinite(value)))throw new Error("Native geometry operation returned non-finite coordinates");
    if(verb==="moveTo")return {op:"M",x:p[0]!,y:p[1]!};
    if(verb==="lineTo")return {op:"L",x:p[0]!,y:p[1]!};
    if(verb==="quadraticCurveTo")return {op:"Q",x1:p[0]!,y1:p[1]!,x:p[2]!,y:p[3]!};
    if(verb==="bezierCurveTo")return {op:"C",x1:p[0]!,y1:p[1]!,x2:p[2]!,y2:p[3]!,x:p[4]!,y:p[5]!};
    if(verb==="closePath")return {op:"Z"};
    throw new Error(`Native geometry produced unsupported ${verb}; no flattening was applied`);
  });
}

export function combinePaths(a:readonly PathCommand[],b:readonly PathCommand[],operation:PathBooleanOperation):PathCommand[]{
  if(!["union","intersect","difference","xor"].includes(operation))throw new Error(`Unsupported path operation: ${operation}`);
  const left=contourPath(a,true),right=contourPath(b,true);
  // Native operation results can carry even-odd fill semantics, absent from command arrays.
  return commandsOf(left[operation](right).unwind());
}

export function pathBounds(commands:readonly PathCommand[]){
  if(!commands.length)return null;
  const {left,top,right,bottom,width,height}=contourPath(commands).bounds;
  return {left,top,right,bottom,width,height};
}

export function pathContains(commands:readonly PathCommand[],x:number,y:number):boolean{
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(Math.fround(x))||!Number.isFinite(Math.fround(y)))throw new Error("Hit-test coordinates must be finite and within Skia's scalar range");
  return contourPath(commands,true).contains(x,y);
}
