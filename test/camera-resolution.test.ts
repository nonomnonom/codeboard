import {expect,it} from "vitest";
import {Canvas} from "skia-canvas";
import {StoryboardProject,renderPanelPNG,renderPanelCanvas,decodePixels,createRenderSession} from "../src/index.js";

it("keeps nested vector groups as sharp as direct vector artwork under camera magnification",async()=>{
  const project=StoryboardProject.create({title:"Camera resolution",width:96,height:64,background:"transparent"});
  const shot=project.addScene("S").addShot("S"),panel=shot.addPanel(),outer=panel.addGroup("Outer"),inner=panel.addGroup("Inner",{},outer.id);
  const ink=panel.addVectorLayer("Fine contour",{},inner.id);
  ink.path([{op:"M",x:33,y:24},{op:"C",x1:41,y1:15,x2:51,y2:49,x:63,y:36}],{stroke:"#101820",strokeWidth:.45});
  ink.path([{op:"M",x:43,y:28},{op:"L",x:52,y:28},{op:"L",x:48,y:39},{op:"Z"}],{fill:"#bb7020"});
  project.production.addCameraKeyframe(shot.id,0,{x:0,y:0,zoom:3,rotation:0,easing:"hold"});
  const document=project.toJSON(),flat=structuredClone(document),root=flat.panels[0]!.layers[0]!;
  if(root.kind!=="group"||root.children[0]!.kind!=="group")throw new Error("Expected nested groups");
  flat.panels[0]!.layers=root.children[0]!.children;
  const grouped=await renderPanelPNG(document,panel.id,{annotations:false}),direct=await renderPanelPNG(flat,panel.id,{annotations:false});
  const a=await decodePixels(grouped),b=await decodePixels(direct);
  const magnified=new Canvas(96,64),ctx=magnified.getContext("2d");
  ctx.translate(48,32);ctx.scale(3,3);ctx.translate(-48,-32);
  ctx.drawImage(renderPanelCanvas(document,panel.id,{camera:false,annotations:false}),0,0);
  const old=await decodePixels(await magnified.toBuffer("png"));
  const alphaError=(pixels:Uint8Array)=>{let error=0;for(let i=3;i<pixels.length;i+=4)error+=Math.abs(pixels[i]!-b.pixels[i]!);return error;};
  // Native offscreen/direct antialiasing can differ; compare against magnifying the old low-resolution composite.
  expect(alphaError(a.pixels)).toBeLessThan(alphaError(old.pixels)*.5);
  expect((await createRenderSession(project).frame(0).toBuffer("png")).equals(grouped)).toBe(true);
});

it("rejects oversized zoom composition instead of silently reducing vector resolution",async()=>{
  const project=StoryboardProject.create({title:"Composition budget",width:1280,height:720});
  const shot=project.addScene("S").addShot("S"),panel=shot.addPanel(),group=panel.addGroup("Ink");
  panel.addVectorLayer("Line",{},group.id).vectorStroke([{x:620,y:350},{x:650,y:370}]);
  project.production.addCameraKeyframe(shot.id,0,{x:0,y:0,zoom:8,rotation:0,easing:"hold"});
  await expect(renderPanelPNG(project,panel.id)).rejects.toThrow(/32 megapixel camera composition bounds/);
});

it.each(["mask","clip"] as const)("preserves %s placement and fractional alpha in zoomed groups",async kind=>{
  const project=StoryboardProject.create({title:"Zoom compositing",width:96,height:64,background:"transparent"});
  const shot=project.addScene("S").addShot("S"),panel=shot.addPanel();
  const base=panel.addVectorLayer("Alpha source",{visible:kind==="clip",opacity:kind==="clip"?.5:1,depth:2});
  base.path([{op:"M",x:40,y:24},{op:"L",x:48,y:24},{op:"L",x:48,y:40},{op:"L",x:40,y:40},{op:"Z"}],{fill:"red"});
  const group=panel.addGroup("Composite",kind==="mask"?{maskLayerId:base.id,opacity:.5}:{clipToBelow:true});
  panel.addVectorLayer("Ink",{},group.id).path([{op:"M",x:40,y:24},{op:"L",x:56,y:24},{op:"L",x:56,y:40},{op:"L",x:40,y:40},{op:"Z"}],{fill:"blue"});
  project.production.addCameraKeyframe(shot.id,0,{x:0,y:0,zoom:3,rotation:0,easing:"hold"});
  const pixels=await decodePixels(await renderPanelPNG(project,panel.id,{annotations:false}));
  const at=(32*96+28)*4;expect([...pixels.pixels.slice(at,at+4)]).toEqual([0,0,255,128]);
  expect(pixels.pixels[(32*96+60)*4+3]).toBe(0);
});
it.each(["group","mask","clip"] as const)("retains off-frame %s artwork during camera travel",async kind=>{
  const project=StoryboardProject.create({title:"Off-frame composition",width:96,height:64,background:"transparent"});
  const shot=project.addScene("S").addShot("S"),panel=shot.addPanel();
  const rectangle=[{op:"M" as const,x:150,y:24},{op:"L" as const,x:170,y:24},{op:"L" as const,x:170,y:40},{op:"L" as const,x:150,y:40},{op:"Z" as const}];
  const base=panel.addVectorLayer("Off-frame mask",{visible:kind==="clip"});
  base.path(rectangle,{fill:"red"});
  const group=panel.addGroup("Off-frame group",{opacity:.5,...(kind==="mask"?{maskLayerId:base.id}:kind==="clip"?{clipToBelow:true}:{})});
  const nested=panel.addGroup("Nested",{},group.id);
  panel.addVectorLayer("Artwork",{},nested.id).path(rectangle,{fill:"blue"});
  project.production.addCameraKeyframe(shot.id,0,{x:112,y:0,zoom:2,rotation:.3,easing:"hold"});
  const result=await renderPanelPNG(project,panel.id,{annotations:false});
  const pixels=await decodePixels(result),at=(32*96+48)*4;
  expect([...pixels.pixels.slice(at,at+4)]).toEqual(kind==="clip"?[127,0,128,255]:[0,0,255,128]);
  expect((await createRenderSession(project).frame(0).toBuffer("png")).equals(result)).toBe(true);
});
