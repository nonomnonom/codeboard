import sharp from "sharp";
import type { PixelBuffer, PixelRegion } from "../model/types.js";

export function validateDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > 32 * 1024 * 1024)
    throw new Error("Pixel surface dimensions must be positive integers within the 32 megapixel render budget");
}
export function validatePixels(image: PixelBuffer): void {
  validateDimensions(image.width, image.height);
  if (!(image.pixels instanceof Uint8Array) || image.pixels.length !== image.width * image.height * 4)
    throw new Error("Pixel surface requires exactly width × height × 4 RGBA8 bytes");
}

export function createPixels(width: number, height: number): PixelBuffer {
  // Validate dimensions before allocating user-controlled memory.
  validateDimensions(width, height);
  return { width, height, pixels: new Uint8Array(width * height * 4) };
}

export function validatePixelRegion(image: PixelBuffer, region: PixelRegion): void {
  validatePixels(image);
  if (![region.x, region.y, region.width, region.height].every(Number.isSafeInteger) || region.x < 0 || region.y < 0 || region.width < 1 || region.height < 1 || region.x + region.width > image.width || region.y + region.height > image.height)
    throw new Error("Pixel region must be an integer rectangle inside the source surface");
}

export function readPixelRegion(image: PixelBuffer, region: PixelRegion): PixelBuffer {
  validatePixelRegion(image, region);
  const result = createPixels(region.width, region.height);
  for (let row = 0; row < region.height; row++) {
    const start = ((region.y + row) * image.width + region.x) * 4;
    result.pixels.set(image.pixels.subarray(start, start + region.width * 4), row * region.width * 4);
  }
  return result;
}

export function writePixelRegion(image: PixelBuffer, x: number, y: number, patch: PixelBuffer): void {
  validatePixels(patch);
  validatePixelRegion(image, { x, y, width: patch.width, height: patch.height });
  const bytes = patch.pixels.slice();
  for (let row = 0; row < patch.height; row++) image.pixels.set(bytes.subarray(row * patch.width * 4, (row + 1) * patch.width * 4), ((y + row) * image.width + x) * 4);
}

export async function decodePixels(bytes: Uint8Array): Promise<PixelBuffer> {
  const { data, info } = await sharp(bytes, { limitInputPixels: 32 * 1024 * 1024 }).toColourspace("srgb").ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = { width: info.width, height: info.height, pixels: new Uint8Array(data) };
  validatePixels(result); return result;
}

export async function encodePixels(image: PixelBuffer): Promise<Buffer> {
  validatePixels(image);
  return sharp(image.pixels, { raw: { width: image.width, height: image.height, channels: 4 } }).png().toBuffer();
}

export interface PixelComparison {
  width:number;height:number;changedPixels:number;maxChannelDelta:number;meanAbsoluteDelta:number;bounds:PixelRegion|null;
}

/** Compare visible premultiplied RGBA, ignoring hidden RGB under zero alpha. */
export function comparePixels(before:PixelBuffer,after:PixelBuffer,options:{threshold?:number}={}):PixelComparison{
  validatePixels(before);validatePixels(after);
  if(before.width!==after.width||before.height!==after.height)throw new Error("Pixel comparison requires matching dimensions");
  const threshold=options.threshold??0;
  if(!Number.isFinite(threshold)||threshold<0||threshold>255)throw new Error("Comparison threshold must be between 0 and 255");
  const {width,height}=before;let changedPixels=0,maxChannelDelta=0,total=0,left=width,top=height,right=-1,bottom=-1;
  for(let i=0;i<width*height;i++){
    const at=i*4,aa=before.pixels[at+3]!,ba=after.pixels[at+3]!;let difference=Math.abs(aa-ba);total+=difference;
    for(let c=0;c<3;c++){
      const delta=Math.abs(before.pixels[at+c]!*aa/255-after.pixels[at+c]!*ba/255);total+=delta;difference=Math.max(difference,delta);
    }
    maxChannelDelta=Math.max(maxChannelDelta,difference);
    if(difference>threshold){const x=i%width,y=Math.floor(i/width);changedPixels++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  return {width,height,changedPixels,maxChannelDelta,meanAbsoluteDelta:total/(width*height*4),bounds:changedPixels?{x:left,y:top,width:right-left+1,height:bottom-top+1}:null};
}
