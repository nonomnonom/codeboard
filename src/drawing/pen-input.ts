import type {Point} from "../model/types.js";

export function interpolateRotation(a:number|undefined,b:number|undefined,t:number):number|undefined{
  if(a===undefined)return b;
  if(b===undefined)return a;
  const delta=Math.atan2(Math.sin(b-a),Math.cos(b-a));
  return a+delta*t;
}

/** Supplied timestamps are anchors; omitted ones interpolate or continue at the default cadence. */
export function timedPoints(points:readonly Point[],defaultStep:number):Point[]{
  const result=points.map(p=>({...p}));
  if(!result.length)return result;
  result[0]!.time??=0;
  let previous=0;
  for(let i=0;i<result.length;i++){
    const time=result[i]!.time;
    if(time===undefined)continue;
    if(!Number.isFinite(time)||time<0||time<result[previous]!.time!)throw new Error("Pen timestamps must be finite, nonnegative and nondecreasing milliseconds");
    for(let j=previous+1;j<i;j++)result[j]!.time=result[previous]!.time!+(time-result[previous]!.time!)*(j-previous)/(i-previous);
    previous=i;
  }
  for(let i=previous+1;i<result.length;i++)result[i]!.time=result[previous]!.time!+(i-previous)*defaultStep;
  return result;
}
