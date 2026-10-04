import {expect,it} from "vitest";
import sharp from "sharp";
import {StoryboardProject,pathCommands,renderPanelPNG} from "../src/index.js";

it("does not expose clipped paint when no lower layer is available",async()=>{
  const project=StoryboardProject.create({title:"Clipping exposure",width:64,height:64,background:"#ffffff"});
  const panel=project.addScene("S").addShot("A").addPanel();
  const base=panel.addVectorLayer("Base");
  base.path(pathCommands("M 0 0 L 32 0 L 32 64 L 0 64 Z"),{fill:"#0000ff",strokeWidth:0});
  project.production.setExposure(base.id,{startFrame:0,endFrame:4});
  const clipped=panel.addVectorLayer("Clipped red",{clipToBelow:true});
  clipped.path(pathCommands("M 0 0 L 64 0 L 64 64 L 0 64 Z"),{fill:"#ff0000",strokeWidth:0});
  const pixel=async(frame:number,x:number)=>Array.from(await sharp(await renderPanelPNG(project,panel.id,{annotations:false,frame})).extract({left:x,top:32,width:1,height:1}).ensureAlpha().raw().toBuffer());
  expect(await pixel(0,16)).toEqual([255,0,0,255]);
  expect(await pixel(0,48)).toEqual([255,255,255,255]);
  expect(await pixel(4,16)).toEqual([255,255,255,255]);
  base.set({visible:false});
  expect(await pixel(0,16)).toEqual([255,255,255,255]);
  project.production.removeLayer(base.id);
  expect(await pixel(0,16)).toEqual([255,255,255,255]);
});

it("does not switch clipping to an earlier sibling across a hidden base",async()=>{
  const project=StoryboardProject.create({title:"Clipping siblings",width:64,height:64,background:"#ffffff"});
  const panel=project.addScene("S").addShot("A").addPanel(),group=panel.addGroup("Animated group",{opacity:.5});
  const shape=pathCommands("M 0 0 L 64 0 L 64 64 L 0 64 Z");
  panel.addVectorLayer("Background",{},group.id).path(shape,{fill:"#0000ff",strokeWidth:0});
  panel.addVectorLayer("Hidden base",{visible:false},group.id).path(shape,{fill:"#000000",strokeWidth:0});
  panel.addVectorLayer("Clipped paint",{clipToBelow:true},group.id).path(shape,{fill:"#ff0000",strokeWidth:0});
  const bytes=await sharp(await renderPanelPNG(project,panel.id,{annotations:false})).extract({left:32,top:32,width:1,height:1}).ensureAlpha().raw().toBuffer();
  expect(Math.abs(bytes[0]!-128)).toBeLessThanOrEqual(2);
  expect(bytes[1]).toBe(bytes[0]);expect(bytes[2]).toBe(255);expect(bytes[3]).toBe(255);
});

it("uses the base layer's evaluated opacity in the clipping alpha",async()=>{
  const project=StoryboardProject.create({title:"Clipping fade",width:64,height:64,background:"#ffffff"});
  const panel=project.addScene("S").addShot("A").addPanel();
  const shape=pathCommands("M 0 0 L 64 0 L 64 64 L 0 64 Z");
  const base=panel.addVectorLayer("Fading base");base.path(shape,{fill:"#0000ff",strokeWidth:0});
  project.production.addLayerKeyframe(base.id,0,{opacity:1});
  project.production.addLayerKeyframe(base.id,10,{opacity:0});
  panel.addVectorLayer("Clipped paint",{clipToBelow:true}).path(shape,{fill:"#ff0000",strokeWidth:0});
  for(const [frame,expected] of [[0,[255,0,0]],[5,[191,64,128]],[10,[255,255,255]]] as const){
    const bytes=await sharp(await renderPanelPNG(project,panel.id,{annotations:false,frame})).extract({left:32,top:32,width:1,height:1}).ensureAlpha().raw().toBuffer();
    for(let c=0;c<3;c++)expect(Math.abs(bytes[c]!-expected[c]!)).toBeLessThanOrEqual(2);
  }
});
