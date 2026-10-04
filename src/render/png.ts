import type {Canvas} from "skia-canvas";

/** Consumes a private render surface after encoding; never pass a caller-owned canvas. */
export async function encodePNG(canvas:Canvas):Promise<Buffer>{
  try{return await canvas.toBuffer("png");}
  finally{canvas.getContext("2d").reset();}
}
