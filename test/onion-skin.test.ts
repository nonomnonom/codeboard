import {expect,it} from "vitest";
import {StoryboardProject,renderOnionSkin,renderPanelPNG,decodePixels} from "../src/index.js";

it("retains an unselected hidden mask and its ancestor exposure in a selected ghost",async()=>{
 const p=StoryboardProject.create({title:"Selected mask",width:80,height:60,background:"white"});
 const panel=p.addScene("S").addShot("S").addPanel();
 const parent=panel.addGroup("Mask parent",{transform:{x:20},opacity:.5,visible:false,exposure:{startFrame:0,endFrame:4}});
 const mask=panel.addVectorLayer("Mask",{},parent.id);
 const rect=[{op:"M" as const,x:0,y:0},{op:"L" as const,x:30,y:0},{op:"L" as const,x:30,y:60},{op:"L" as const,x:0,y:60},{op:"Z" as const}];
 mask.path(rect,{fill:"black"});
 const art=panel.addVectorLayer("Paint",{transform:{x:40},maskLayerId:mask.id});art.path(rect,{fill:"red"});
 const sample=async(frame:number)=>decodePixels(await renderOnionSkin(p,[{panelId:panel.id,frame,layerIds:[art.id],tint:"blue"}]));
 const shown=await sample(0),hidden=await sample(4);
 const at=(30*80+45)*4;expect([...shown.pixels.slice(at,at+4)]).toEqual([0,0,255,128]);
 expect(shown.pixels[(30*80+60)*4+3]).toBe(0);expect(hidden.pixels[at+3]).toBe(0);
});

it("compares chosen drawing frames without washing out the base with canvas background",async()=>{
  const project=StoryboardProject.create({title:"Onion",width:80,height:60,background:"#ffffff"});
  const shot=project.addScene("S").addShot("A"),panel=shot.addPanel();
  const layer=panel.addVectorLayer("Moving pose");
  layer.path([{op:"M",x:5,y:20},{op:"L",x:20,y:20},{op:"L",x:20,y:40},{op:"L",x:5,y:40},{op:"Z"}],{fill:"#000000"});
  project.production.addLayerKeyframe(layer.id,0,{transform:{x:0}});
  project.production.addLayerKeyframe(layer.id,10,{transform:{x:40}});
  const before=project.toJSON(),base=await renderPanelPNG(project,panel.id,{frame:0,camera:false,annotations:false});
  const samples=[{panelId:panel.id,frame:0},{panelId:panel.id,frame:10}];
  const output=await decodePixels(await renderOnionSkin(project,samples,{opacity:.5}));
  const at=(x:number)=>[...output.pixels.slice((30*80+x)*4,(30*80+x)*4+3)];
  expect(at(10)).toEqual([0,0,0]);
  for(const channel of at(50))expect(Math.abs(channel-128)).toBeLessThanOrEqual(1);
  expect(at(30)).toEqual([255,255,255]);
  expect((await renderOnionSkin(project,samples,{opacity:0})).equals(base)).toBe(true);
  expect(project.toJSON()).toEqual(before);
  project.production.addCameraKeyframe(shot.id,0,{x:5,y:0,zoom:1,rotation:0,easing:"hold"});
  expect((await renderOnionSkin(project,[samples[0]!],{camera:true})).equals(await renderPanelPNG(project,panel.id,{frame:0,annotations:false}))).toBe(true);
  expect(project.toJSON().panels).toEqual(before.panels);
  await expect(renderOnionSkin(project,[{panelId:panel.id,frame:.5}])).rejects.toThrow(/integer/);
  await expect(renderOnionSkin(project,[])).rejects.toThrow(/samples/);
  await expect(renderOnionSkin(project,[{panelId:"missing"}])).rejects.toThrow(/Panel not found/);
});

it("isolates layer ghosts while retaining parent transforms, masks and clipping dependencies",async()=>{
 const p=StoryboardProject.create({title:"Layer onion",width:80,height:60,background:"transparent"});
 const panel=p.addScene("s").addShot("s").addPanel(),base=panel.addGroup("Clip source");
 const left=panel.addVectorLayer("Left base",{},base.id),right=panel.addVectorLayer("Right base",{},base.id);
 const rect=(x:number,w:number)=>[{op:"M" as const,x,y:20},{op:"L" as const,x:x+w,y:20},{op:"L" as const,x:x+w,y:40},{op:"L" as const,x,y:40},{op:"Z" as const}];
 left.path(rect(10,10),{fill:"red"});right.path(rect(40,10),{fill:"red"});
 const upper=panel.addVectorLayer("Clipped ink",{clipToBelow:true,opacity:.5});upper.path(rect(0,80),{fill:"blue"});
 const before=p.toJSON();
 const output=await decodePixels(await renderPanelPNG(p,panel.id,{layerIds:[left.id,upper.id],annotations:false}));
 const rgba=(x:number)=>[...output.pixels.slice((30*80+x)*4,(30*80+x)*4+4)];
 expect(rgba(15)).toEqual([127,0,128,255]);expect(rgba(45)).toEqual([0,0,255,128]);expect(rgba(30)).toEqual([0,0,0,0]);
 expect(p.toJSON()).toEqual(before);
 const ghost=await decodePixels(await renderOnionSkin(p,[{panelId:panel.id,layerIds:[upper.id],tint:"#00ff00",opacity:.5}]));
 const at=(30*80+45)*4;expect([...ghost.pixels.slice(at,at+3)]).toEqual([0,255,0]);expect(ghost.pixels[at+3]).toBe(64);
 await expect(renderOnionSkin(p,[{panelId:panel.id,layerIds:["missing"]}])).rejects.toThrow(/Render layer not found/);
 await expect(renderOnionSkin(p,[{panelId:panel.id,tint:"invalid"}])).rejects.toThrow(/tint/);
 await expect(renderOnionSkin(p,[{panelId:panel.id,opacity:2}])).rejects.toThrow(/opacity/);
 await expect(renderPanelPNG(p,panel.id,{layerIds:[]})).rejects.toThrow(/unique/);
});

it("onion-skins exposure drawings on a selected nested layer without its backdrop",async()=>{
 const p=StoryboardProject.create({title:"Drawing exposures",width:80,height:60,background:"white"});
 const panel=p.addScene("s").addShot("s").addPanel(),background=panel.addVectorLayer("Backdrop");
 background.path([{op:"M",x:0,y:0},{op:"L",x:80,y:0},{op:"L",x:80,y:60},{op:"L",x:0,y:60},{op:"Z"}],{fill:"#222222"});
 const group=panel.addGroup("Drawings",{transform:{x:5,y:0,scaleX:1,scaleY:1,rotation:0}});
 for(const [frame,x] of [[0,10],[2,30]]){
  const pose=panel.addVectorLayer(`Pose ${frame}`,{},group.id);
  pose.vectorStroke([{x:x!,y:30}],{width:10,color:"black",pressureSize:0});p.production.setExposure(pose.id,{startFrame:frame!,endFrame:frame!+2});
 }
 const pixels=await decodePixels(await renderOnionSkin(p,[{panelId:panel.id,frame:0,layerIds:[group.id],tint:"red"},{panelId:panel.id,frame:2,layerIds:[group.id],tint:"blue"}],{opacity:.5}));
 const at=(x:number)=>[...pixels.pixels.slice((30*80+x)*4,(30*80+x)*4+4)];
 expect(at(15)).toEqual([255,0,0,255]);expect(at(35)).toEqual([0,0,255,128]);expect(at(0)).toEqual([0,0,0,0]);
});
