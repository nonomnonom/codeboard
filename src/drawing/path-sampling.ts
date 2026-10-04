import type {PathCommand,Point} from "../model/types.js";
import {contourPath} from "./path-geometry.js";

export interface PathSamplingOptions {
  /** Maximum intended spacing in local canvas units; native curve measurement is approximate. */
  step?:number;
  /** Reject before native sampling if the control-polygon estimate exceeds this allocation budget. */
  maxSamples?:number;
}

/** Sample separate pen-down paths. The original editable contour commands remain untouched. */
export function samplePath(commands:readonly PathCommand[],options:PathSamplingOptions={}):Point[][]{
  const step=options.step??2,maxSamples=options.maxSamples??1_000_000;
  if(!Number.isFinite(step)||step<=0)throw new Error("Path sampling step must be positive and finite");
  if(!Number.isSafeInteger(maxSamples)||maxSamples<2)throw new Error("Path sampling maxSamples must be a whole number of at least two");
  contourPath(commands);
  const contours:PathCommand[][]=[];
  let current:PathCommand[]=[],origin:{x:number;y:number}|undefined;
  const finish=()=>{if(current.length>1)contours.push(current);current=[];};
  for(const command of commands){
    if(command.op==="M"){
      finish();origin={x:command.x,y:command.y};current=[command];
    }else if(command.op==="Z"){
      // Native closed sampling offsets the first point. An explicit closing line preserves the seam.
      if(current.length>1){current.push({op:"L",...origin!});finish();}
    }else{
      if(!current.length)current=[{op:"M",...origin!}];
      current.push(command);
    }
  }
  finish();
  let estimated=0;
  for(const contour of contours){
    const start=contour[0]! as Pick<Point,"x"|"y">;
    let x=start.x,y=start.y,length=0;
    const to=(xx:number,yy:number)=>{length+=Math.hypot(xx-x,yy-y);x=xx;y=yy;};
    for(const command of contour.slice(1)){
      if(command.op==="Q"||command.op==="C")to(command.x1,command.y1);
      if(command.op==="C")to(command.x2,command.y2);
      if(command.op!=="Z")to(command.x,command.y);
    }
    estimated+=Math.ceil(length/step)+2;
    if(estimated>maxSamples)throw new Error(`Path sampling estimate ${estimated} exceeds maxSamples ${maxSamples}; increase the explicit budget or step`);
  }
  const result:Point[][]=[];
  for(const contour of contours){
    const sampled=contourPath(contour).points(step);
    if(!sampled.length)continue;
    const first=contour[0]! as Pick<Point,"x"|"y">,last=contour.at(-1)! as Pick<Point,"x"|"y">;
    const points=sampled.map(([x,y],index)=>({x,y,time:index*8}));
    Object.assign(points[0]!,{x:first.x,y:first.y});
    Object.assign(points.at(-1)!,{x:last.x,y:last.y});
    result.push(points);
  }
  return result;
}
