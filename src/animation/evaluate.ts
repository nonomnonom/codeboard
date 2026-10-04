import type { CameraKeyframe, Layer, Transform, DrawingExposure, LayerChannel, CameraChannel, Easing } from "../model/types.js";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Undefined is an ordinary group; null is a blank exposure. Keys are sorted on authoring. */
export function evaluateDrawing(sequence:readonly DrawingExposure[]|undefined,frame:number):string|null|undefined {
  if(sequence===undefined)return undefined;
  let low=0,high=sequence.length;
  while(low<high){const middle=(low+high)>>>1;if(sequence[middle]!.frame<=frame)low=middle+1;else high=middle;}
  return low?sequence[low-1]!.drawingId:null;
}
function ease(t: number, easing: Easing): number {
  if(easing === "hold")return 0;
  if(easing === "linear")return t;
  if(easing === "ease-in-out")return t*t*(3-2*t);
  if(t<=0)return 0;
  if(t>=1)return 1;
  const cubic=(u:number,a:number,b:number)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*b+u*u*u;
  // Time is the curve's x coordinate, not its parameter. Bisection also handles flat tangents.
  let low=0,high=1;
  for(let i=0;i<52;i++){
    const u=(low+high)/2;
    if(cubic(u,easing.x1,easing.x2)<t)low=u;else high=u;
  }
  return cubic((low+high)/2,easing.y1,easing.y2);
}

function propertyValue<K extends {frame:number;easing:Easing}>(keys:readonly K[],frame:number,value:(key:K)=>number|undefined,easing:(key:K)=>Easing,fallback:number):number {
  let before:K|undefined,after:K|undefined;
  for(const key of keys){
    if(value(key)===undefined)continue;
    if(key.frame<=frame&&(!before||key.frame>before.frame))before=key;
    if(key.frame>=frame&&(!after||key.frame<after.frame))after=key;
  }
  const a=before??after,b=after??before;
  if(!a||!b)return fallback;
  if(a.frame===b.frame)return value(a)!;
  return mix(value(a)!,value(b)!,ease((frame-a.frame)/(b.frame-a.frame),easing(a)));
}

export interface EvaluatedLayerState { transform: Transform; opacity: number; depth:number }

export function evaluateLayer(layer: Layer, frame: number): EvaluatedLayerState {
  const property=(channel:LayerChannel):number=>propertyValue(layer.keyframes,frame,
    key=>channel==="opacity"||channel==="depth"?key[channel]:key.transform[channel],
    key=>key.channelEasing?.[channel]??key.easing,
    channel==="opacity"||channel==="depth"?layer[channel]:layer.transform[channel]);
  return {
    transform: {
      x:property("x"),y:property("y"),scaleX:property("scaleX"),scaleY:property("scaleY"),rotation:property("rotation"),
    },
    opacity:property("opacity"),
    depth:property("depth"),
  };
}

export interface EvaluatedCamera { x: number; y: number; zoom: number; rotation: number }

export function evaluateCamera(keyframes: readonly CameraKeyframe[], frame: number): EvaluatedCamera {
  const property=(channel:CameraChannel)=>propertyValue(keyframes,frame,key=>key[channel],key=>key.channelEasing?.[channel]??key.easing,channel==="zoom"?1:0);
  return {x:property("x"),y:property("y"),zoom:property("zoom"),rotation:property("rotation")};
}
