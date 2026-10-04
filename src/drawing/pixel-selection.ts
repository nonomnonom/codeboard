import sharp from "sharp";
import { Canvas } from "skia-canvas";
import type { PixelBuffer, Point } from "../model/types.js";
import { validateDimensions, validatePixels } from "./pixels.js";

export interface PixelSelection { width:number; height:number; coverage:Uint8Array }
export type PixelColor = readonly [number,number,number,number];

function validateSelection(selection:PixelSelection,width=selection.width,height=selection.height):void{
  validateDimensions(selection.width,selection.height);
  if(selection.width!==width||selection.height!==height||!(selection.coverage instanceof Uint8Array)||selection.coverage.length!==width*height)
    throw new Error("Selection must contain one coverage byte per source pixel with matching dimensions");
}

export function polygonPixelSelection(width:number,height:number,points:Pick<Point,"x"|"y">[],fillRule:"nonzero"|"evenodd"="nonzero"):PixelSelection{
  validateDimensions(width,height);
  if(points.length<3||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error("A polygon selection requires at least three finite points");
  if(fillRule!=="nonzero"&&fillRule!=="evenodd")throw new Error("Unknown selection fill rule");
  const ctx=new Canvas(width,height).getContext("2d");
  ctx.beginPath();ctx.moveTo(points[0]!.x,points[0]!.y);
  for(const point of points.slice(1))ctx.lineTo(point.x,point.y);
  ctx.closePath();ctx.fillStyle="#ffffff";ctx.fill(fillRule);
  const data=ctx.getImageData(0,0,width,height).data,coverage=new Uint8Array(width*height);
  for(let i=0;i<coverage.length;i++)coverage[i]=data[i*4+3]!;
  return {width,height,coverage};
}

/** Four-connected flood or all matching pixels, measured in premultiplied RGBA byte units. */
export function colorPixelSelection(image:PixelBuffer,x:number,y:number,options:{tolerance?:number;contiguous?:boolean}={}):PixelSelection{
  validatePixels(image);
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=image.width||y>=image.height)throw new Error("Selection seed must be inside the source surface");
  const tolerance=options.tolerance??0;
  if(!Number.isFinite(tolerance)||tolerance<0||tolerance>255)throw new Error("Selection tolerance must be between 0 and 255");
  const {width,height,pixels}=image,seed=y*width+x,coverage=new Uint8Array(width*height),offset=seed*4,alpha=pixels[offset+3]!;
  const target=[pixels[offset]!*alpha/255,pixels[offset+1]!*alpha/255,pixels[offset+2]!*alpha/255,alpha];
  const matches=(index:number)=>{
    const at=index*4,a=pixels[at+3]!;
    if(Math.abs(a-target[3]!)>tolerance)return false;
    for(let c=0;c<3;c++)if(Math.abs(pixels[at+c]!*a/255-target[c]!)>tolerance)return false;
    return true;
  };
  if(options.contiguous===false){
    for(let i=0;i<coverage.length;i++)if(matches(i))coverage[i]=255;
  }else{
    // Mark on insertion so each pixel can enter this bounded queue only once.
    const queue=new Uint32Array(width*height);let head=0,tail=1;
    queue[0]=seed;coverage[seed]=255;
    const add=(index:number)=>{if(!coverage[index]&&matches(index)){coverage[index]=255;queue[tail++]=index;}};
    while(head<tail){
      const index=queue[head++]!,column=index%width;
      if(column>0)add(index-1);if(column+1<width)add(index+1);
      if(index>=width)add(index-width);if(index+width<coverage.length)add(index+width);
    }
  }
  return {width,height,coverage};
}

export function combinePixelSelections(a:PixelSelection,b:PixelSelection,operation:"union"|"intersect"|"subtract"):PixelSelection{
  validateSelection(a);validateSelection(b,a.width,a.height);
  if(!["union","intersect","subtract"].includes(operation))throw new Error("Unknown selection combination");
  const coverage=new Uint8Array(a.coverage.length);
  for(let i=0;i<coverage.length;i++)coverage[i]=operation==="union"?Math.max(a.coverage[i]!,b.coverage[i]!):operation==="intersect"?Math.min(a.coverage[i]!,b.coverage[i]!):Math.max(0,a.coverage[i]!-b.coverage[i]!);
  return {width:a.width,height:a.height,coverage};
}

export function invertPixelSelection(selection:PixelSelection):PixelSelection{
  validateSelection(selection);
  return {...selection,coverage:selection.coverage.map(value=>255-value)};
}

/** Gaussian coverage feathering in source-pixel units; boundary samples repeat edge coverage. */
export async function featherPixelSelection(selection:PixelSelection,sigma:number):Promise<PixelSelection>{
  validateSelection(selection);
  if(!Number.isFinite(sigma)||(sigma!==0&&(sigma<.3||sigma>1000)))
    throw new Error("Selection feather sigma must be 0 or between 0.3 and 1000 source pixels");
  const {width,height}=selection,coverage=selection.coverage.slice();
  if(sigma===0)return {width,height,coverage};
  const result=await sharp(coverage,{raw:{width,height,channels:1}})
    .blur({sigma,precision:"float",minAmplitude:.01}).toColourspace("b-w").raw().toBuffer();
  return {width,height,coverage:new Uint8Array(result)};
}

/** Apply coverage without flattening the source surface or its later paint strokes. */
export function fillPixels(image:PixelBuffer,color:PixelColor,options:{selection?:PixelSelection;mode?:"source-over"|"copy"|"destination-out"|"source-atop"}={}):void{
  validatePixels(image);
  const rgba=Array.from(color);
  if(rgba.length!==4||rgba.some(c=>!Number.isInteger(c)||c<0||c>255))throw new Error("Fill color must contain four RGBA8 channel values");
  if(options.selection)validateSelection(options.selection,image.width,image.height);
  const mode=options.mode??"source-over";
  if(!["source-over","copy","destination-out","source-atop"].includes(mode))throw new Error("Unsupported pixel fill mode");
  const mask=options.selection?.coverage;
  const selected=mask?.buffer===image.pixels.buffer?mask.slice():mask;
  for(let i=0;i<image.width*image.height;i++){
    const coverage=(selected?.[i]??255)/255;if(!coverage)continue;
    const at=i*4,da=image.pixels[at+3]!/255,sa=rgba[3]!/255;
    if(mode==="destination-out"){image.pixels[at+3]=Math.round(255*da*(1-sa*coverage));continue;}
    if(mode==="source-atop"){
      if(!da)continue;
      for(let c=0;c<3;c++)image.pixels[at+c]=Math.round(rgba[c]!*sa*coverage+image.pixels[at+c]!*(1-sa*coverage));
      continue;
    }
    if(mode==="copy"&&coverage===1){image.pixels.set(rgba,at);continue;}
    const source=sa*coverage,destination=da*(mode==="copy"?1-coverage:1-source),alpha=source+destination;
    if(alpha)for(let c=0;c<3;c++)image.pixels[at+c]=Math.round((rgba[c]!*source+image.pixels[at+c]!*destination)/alpha);
    image.pixels[at+3]=Math.round(alpha*255);
  }
}
