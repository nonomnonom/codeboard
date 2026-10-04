import { expect, it } from "vitest";
import { Canvas } from "skia-canvas";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, brushes, customizeBrush, renderPanelCanvas, renderPanelPNG, createRenderSession } from "../src/index.js";
import { compositeLayers } from "../src/render/layer-compositor.js";

const pixels=(canvas:ReturnType<typeof renderPanelCanvas>)=>canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;
const differing=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>a.reduce((n,value,i)=>n+(value!==b[i]?1:0),0);
function inkBounds(data:Uint8ClampedArray,width:number){
  let minX=width,minY=data.length/4/width,maxX=0,maxY=0;
  for(let i=0;i<data.length;i+=4)if(data[i]!<240){const x=i/4%width,y=Math.floor(i/4/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  return [minX,minY,maxX,maxY];
}
function uncached(board:StoryboardProject){
  const doc=board.toJSON(),panel=doc.panels[0]!,canvas=new Canvas(panel.width,panel.height),ctx=canvas.getContext("2d");
  ctx.fillStyle=doc.canvas.background;ctx.fillRect(0,0,panel.width,panel.height);
  compositeLayers(panel,panel.layers,ctx);return pixels(canvas);
}

it("keeps tall rotated bitmap tips intact in cached artwork",()=>{
  const board=StoryboardProject.create({title:"Tall tip",width:256,height:256,background:"#ffffff"});
  const panel=board.addScene("S").addShot("A").addPanel();
  const brush=customizeBrush(brushes.cleanInk,{size:18,hardness:1,flow:1,taperStart:0,taperEnd:0,
    tip:{kind:"bitmap",width:4,height:40,alpha:Array.from({length:160},(_,i)=>i%4===1||i%4===2?1:.4),angle:.36,rotationMode:"fixed"}});
  panel.addRasterLayer("Paint").rasterStroke([{x:128,y:128,pressure:1}],brush);
  const direct=uncached(board);
  const cached=pixels(createRenderSession(board).panel(panel.id));
  const expected=inkBounds(direct,256),actual=inkBounds(cached,256);
  expect(expected[3]!-expected[1]!).toBeGreaterThan(140);
  // Native display lists and flattened canvases can differ at antialiased edges.
  for(let i=0;i<4;i++)expect(Math.abs(actual[i]!-expected[i]!)).toBeLessThanOrEqual(1);
});

it("anchors paper texture in artwork coordinates for direct and cached rendering",()=>{
  const board=StoryboardProject.create({title:"Texture origin",width:240,height:180,background:"#ffffff"});
  const panel=board.addScene("S").addShot("A").addPanel();
  const brush=customizeBrush(brushes.cleanInk,{size:40,hardness:1,flow:1,taperStart:0,taperEnd:0,
    tip:{kind:"chisel",aspect:1,angle:0,rotationMode:"fixed"},
    paperTexture:{width:7,height:5,alpha:Array.from({length:35},(_,i)=>(i%7)/6),scale:1,strength:1}});
  panel.addRasterLayer("Paint").rasterStroke([{x:83,y:92,pressure:1}],brush);
  const direct=uncached(board),cached=pixels(createRenderSession(board).panel(panel.id));
  for(let y=80;y<104;y++)expect(differing(direct.slice((y*240+71)*4,(y*240+95)*4),cached.slice((y*240+71)*4,(y*240+95)*4))).toBe(0);
});

it("replays an edited early stroke before later erasing and repainting, with undo and reopen",async()=>{
  function author(y:number,color:string){
    const board=StoryboardProject.create({title:"Ordered revision",width:128,height:128,background:"#ffffff"});
    const panel=board.addScene("S").addShot("A").addPanel({id:"p"});
    const layer=panel.addRasterLayer("Paint",{id:"paint"});
    const brush=customizeBrush(brushes.cleanInk,{size:34,hardness:1,flow:1,taperStart:0,taperEnd:0});
    const base=layer.rasterStroke([{x:20,y,pressure:1},{x:108,y,pressure:1}],brush,{color});
    layer.erase([{x:64,y:64,pressure:1}],{...brush,size:25});
    layer.rasterStroke([{x:64,y:64,pressure:1}],{...brush,size:8},{color:"#0000ff"});
    return {board,panel,layer,base};
  }
  const {board,panel,layer,base}=author(64,"#cc3300"),frozen=createRenderSession(board);
  const before=await renderPanelPNG(board,panel.id,{annotations:false});
  layer.edit(base,e=>{if(e.kind!=="raster-stroke")throw new Error("Expected stroke");e.color="#008800";e.points=e.points.map(p=>({...p,y:72}));return e;});
  const after=await renderPanelPNG(board,panel.id,{annotations:false}),expected=author(72,"#008800");
  expect(after.equals(before)).toBe(false);
  expect(after.equals(await renderPanelPNG(expected.board,expected.panel.id,{annotations:false}))).toBe(true);
  expect((await frozen.panel(panel.id).toBuffer("png")).equals(before)).toBe(true);
  board.undo();expect((await renderPanelPNG(board,panel.id,{annotations:false})).equals(before)).toBe(true);
  board.redo();expect((await renderPanelPNG(board,panel.id,{annotations:false})).equals(after)).toBe(true);
  const directory=await mkdtemp(join(tmpdir(),"raster-replay-"));
  try{
    const file=join(directory,"project.cboard");await board.save(file);
    const reopened=await StoryboardProject.open(file);
    expect((await renderPanelPNG(reopened,panel.id,{annotations:false})).equals(after)).toBe(true);
  }finally{await rm(directory,{recursive:true,force:true});}
});
