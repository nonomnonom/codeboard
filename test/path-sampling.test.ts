import {expect,it} from "vitest";
import {samplePath,pathCommands,withPressure,StoryboardProject,brushes,renderPanelPNG} from "../src/index.js";

it("keeps pen lifts and authored endpoints, including a closed seam",()=>{
  const commands=pathCommands("M 2 3 L 12 3 L 12 13 Z M 40 20 Q 45 30 50 20"),before=structuredClone(commands);
  const paths=samplePath(commands,{step:4});
  expect(paths).toHaveLength(2);expect(paths[0]![0]).toMatchObject({x:2,y:3,time:0});
  expect(paths[0]!.at(-1)).toMatchObject({x:2,y:3});
  expect(paths[1]![0]).toMatchObject({x:40,y:20,time:0});expect(paths[1]!.at(-1)).toMatchObject({x:50,y:20});
  expect(commands).toEqual(before);
  const following=samplePath(pathCommands("M 0 0 L 10 0 Z L 20 0"));
  expect(following).toHaveLength(2);expect(following[1]![0]).toMatchObject({x:0,y:0});
});

it("rejects unbounded allocations and invalid geometry without reducing requested detail",()=>{
  expect(()=>samplePath(pathCommands("M 0 0 L 1000000 0"),{step:.001,maxSamples:100})).toThrow(/exceeds maxSamples/);
  expect(()=>samplePath([],{step:0})).toThrow(/positive/);
  expect(()=>samplePath([{op:"L",x:1,y:2}])).toThrow(/begin with M/);
  expect(samplePath(pathCommands("M 5 5"))).toEqual([]);
});

it("paints a curved contour with varying pressure and no ink across pen lifts",async()=>{
  const p=StoryboardProject.create({title:"Sampled contour",width:120,height:80,background:"transparent"});
  const panel=p.addScene("S").addShot("Shot").addPanel(),layer=panel.addRasterLayer("Pen");
  const paths=samplePath(pathCommands("M 10 50 C 10 10 50 10 50 50 M 85 50 L 110 50"),{step:1});
  for(const points of paths)layer.rasterStroke(withPressure(points,t=>.2+.8*Math.sin(Math.PI*t)),{...brushes.cleanInk,size:8});
  const {decodePixels}=await import("../src/index.js");
  const pixels=await decodePixels(await renderPanelPNG(p,panel.id,{annotations:false}));
  const alpha=(x:number,y:number)=>pixels.pixels[(y*120+x)*4+3]!;
  expect(alpha(30,20)).toBeGreaterThan(0);expect(alpha(65,50)).toBe(0);
});
