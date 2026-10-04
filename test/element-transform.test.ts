import {it,expect} from "vitest";
import {Canvas} from "skia-canvas";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {StoryboardProject,brushes,customizeBrush,createPixels,pathCommands,renderPanelPNG,type DrawingElement,type Transform} from "../src/index.js";
import {drawElement} from "../src/render/vector-renderer.js";

const movement={x:126,y:35,scaleX:1.7,scaleY:.8,rotation:.6};
function render(element:DrawingElement,transform?:Transform){
  const canvas=new Canvas(320,240);canvas.gpu=false;const ctx=canvas.getContext("2d");
  if(transform){
    const c=Math.cos(transform.rotation),s=Math.sin(transform.rotation);
    // Apply one affine matrix, matching native scalar rounding on CPU and GPU.
    ctx.transform(c*transform.scaleX,s*transform.scaleX,-s*transform.scaleY,c*transform.scaleY,transform.x,transform.y);
  }
  drawElement(ctx,element);
  return Buffer.from(ctx.getImageData(0,0,320,240).data);
}

it("transforms whole artwork while preserving editable source geometry and pen dynamics",async()=>{
  const board=StoryboardProject.create({title:"Element placement",width:320,height:240});
  const panel=board.addScene("Scene").addShot("Shot").addPanel();
  const vector=panel.addVectorLayer("Vector"),raster=panel.addRasterLayer("Raster");
  vector.vectorStroke([{x:10,y:10,pressure:.2},{x:50,y:15,pressure:1}],{width:8});
  vector.path(pathCommands("M 12 28 C 32 5 53 42 61 30 L 54 51 Z"),{stroke:"#ab3300",strokeWidth:4,fill:"#ddaa77"});
  vector.text("Ink",9,65,{font:"18px sans-serif"});
  raster.rasterStroke([{x:10,y:90,time:0,pressure:.3,tiltX:35},{x:60,y:103,time:30,pressure:1,rotation:.2}],customizeBrush(brushes.cleanInk,{size:12,tip:{kind:"chisel",aspect:.25,angle:.3,rotationMode:"stylus"},dynamics:{speedSize:1}}));
  const image=createPixels(12,8);image.pixels.fill(255);
  raster.rasterSurface(image,{matrix:[1,0,0,1,25,112]});
  const originals=[vector,raster].map(handle=>{
    const layer=board.production.layer(handle.id);if(layer.kind==="group")throw new Error("Expected drawing");return {handle,elements:layer.elements};
  });
  const before=await renderPanelPNG(board,panel.id);
  board.transaction("Place all artwork",()=>{
    for(const {handle,elements} of originals)board.select({panelId:panel.id,layerId:handle.id,elementIds:elements.map(e=>e.id)}).transform(movement);
  });
  for(const {handle,elements} of originals){
    const layer=board.production.layer(handle.id);if(layer.kind==="group")throw new Error("Expected drawing");
    for(let i=0;i<elements.length;i++){
      const original=elements[i]!,placed=layer.elements[i]!;
      const actual=render(placed),expected=render(original,movement);
      const deltas=actual.map((value,index)=>Math.abs(value-expected[index]!));
      expect(actual.equals(expected), `${original.kind}: max=${deltas.reduce((a,b)=>Math.max(a,b),0)}, changed=${deltas.filter(v=>v!==0).length}`).toBe(true);
      const {matrix:oldMatrix,...source}=original,{matrix:newMatrix,...after}=placed;
      expect(after).toEqual(source);expect(newMatrix).not.toEqual(oldMatrix);
    }
  }
  const after=await renderPanelPNG(board,panel.id);expect(after.equals(before)).toBe(false);
  board.undo();expect((await renderPanelPNG(board,panel.id)).equals(before)).toBe(true);
  board.redo();expect((await renderPanelPNG(board,panel.id)).equals(after)).toBe(true);
  const directory=await mkdtemp(join(tmpdir(),"element-transform-"));
  try{
    const file=join(directory,"project.cboard");await board.save(file);
    const reopened=await StoryboardProject.open(file);
    expect(reopened.toJSON()).toEqual(board.toJSON());
    expect((await renderPanelPNG(reopened,panel.id)).equals(after)).toBe(true);
  }finally{await rm(directory,{recursive:true,force:true});}
});

it("composes successive placement transforms and rejects nonfinite matrices atomically",()=>{
  const board=StoryboardProject.create({title:"Composition"});
  const panel=board.addScene("S").addShot("S").addPanel();
  const layer=panel.addVectorLayer("Ink"),id=layer.text("A",5,15);
  const selection=board.select({panelId:panel.id,layerId:layer.id,elementIds:[id]});
  selection.transform({scaleX:2,scaleY:3,x:10,y:20});selection.transform({x:5,y:-7,scaleX:-1});
  const state=board.production.layer(layer.id);if(state.kind==="group")throw new Error("Expected drawing");
  [-2,0,0,3,-5,13].forEach((v,i)=>expect(state.elements[0]!.matrix![i]).toBeCloseTo(v));
  const before=board.toJSON();expect(()=>selection.transform({scaleX:Infinity})).toThrow();expect(board.toJSON()).toEqual(before);
});
