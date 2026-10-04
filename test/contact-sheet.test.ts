import {expect,it} from "vitest";
import {StoryboardProject,renderContactSheet,decodePixels} from "../src/index.js";

function fixture(){
  const project=StoryboardProject.create({title:"Contact selection",width:96,height:54});
  const shot=project.addScene("Sequence").addShot("Color studies");
  for(const [id,color]of [["red","#ff0000"],["green","#00ff00"],["blue","#0000ff"]]){
    shot.addPanel({id:id!}).addVectorLayer("Artwork").path([
      {op:"M",x:0,y:0},{op:"L",x:96,y:0},{op:"L",x:96,y:54},{op:"L",x:0,y:54},{op:"Z"},
    ],{fill:color!});
  }
  return project;
}

it("renders only selected panels in requested order without changing document order",async()=>{
  const project=fixture(),before=project.toJSON(),ids=["blue","red"];
  const selected=await decodePixels(await renderContactSheet(project,{panelIds:ids,columns:2,thumbnailWidth:96}));
  expect([selected.width,selected.height]).toEqual([240,125]);
  const color=(image:typeof selected,x:number,y:number)=>[...image.pixels.slice((y*image.width+x)*4,(y*image.width+x)*4+3)];
  expect(color(selected,64,43)).toEqual([0,0,255]);
  expect(color(selected,176,43)).toEqual([255,0,0]);
  const all=await decodePixels(await renderContactSheet(project,{columns:2,thumbnailWidth:96}));
  expect([all.width,all.height]).toEqual([240,234]);
  expect(color(all,64,43)).toEqual([255,0,0]);
  expect(color(all,176,43)).toEqual([0,255,0]);
  expect(color(all,64,152)).toEqual([0,0,255]);
  expect(ids).toEqual(["blue","red"]);
  expect(project.toJSON()).toEqual(before);
});

it("rejects empty, duplicate, missing and malformed panel selections",async()=>{
  const project=fixture();
  for(const panelIds of [[],["red","red"],["red","missing"],"red",null]){
    await expect(renderContactSheet(project,{panelIds:panelIds as string[]})).rejects.toThrow(/panelIds|Panel not found/);
  }
});
