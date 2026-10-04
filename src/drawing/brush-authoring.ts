import type { BrushTip } from "../model/types.js";

export function brushTipFromFunction(width:number,height:number,sample:(x:number,y:number)=>number,options:{angle?:number;rotationMode?:"fixed"|"stroke"|"stylus"}={}):BrushTip{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>512||height>512)throw new Error("Tip dimensions must be whole numbers 1..512");
  const alpha=Array.from({length:width*height},(_,i)=>{
    const value=sample(((i%width)+.5)/width*2-1,(Math.floor(i/width)+.5)/height*2-1);
    if(!Number.isFinite(value))throw new Error(`Non-finite brush sample ${i}`);
    return Math.min(1,Math.max(0,value));
  });
  return {kind:"bitmap",width,height,alpha,angle:options.angle??0,rotationMode:options.rotationMode??"stroke"};
}
