import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {expect,it} from "vitest";
import {StoryboardProject,renderPanelPNG,brushes,customizeBrush,type StoryboardDocument,type DrawingLayer} from "../src/index.js";

function fixture(){
  const p=StoryboardProject.create({title:"Stored component validation"});
  const panel=p.addScene("S").addShot("S").addPanel(),group=panel.addGroup("Prop");
  const paint=panel.addRasterLayer("Surface",{},group.id);
  paint.rasterStroke([{x:0,y:0,time:0},{x:4,y:4,time:10}],customizeBrush(brushes.cleanInk,{
    tip:{kind:"bitmap",width:2,height:1,alpha:[1,.5],angle:0,rotationMode:"stroke"},
    paperTexture:{width:2,height:1,alpha:[.2,.9],scale:1,strength:.4},
  }));
  p.production.captureComponent(group.id,"Reusable prop");
  return p.toJSON();
}
function source(d:StoryboardDocument):DrawingLayer{
  const group=d.components[0]!.layers[0]!;
  if(group.kind!=="group"||group.children[0]!.kind==="group")throw new Error("Expected fixture group");
  return group.children[0]!;
}
const corruptions:[string,(d:StoryboardDocument)=>void,RegExp][]=[
  ["source reference",d=>{source(d).componentSource={id:"missing",version:1};},/Missing component source/],
  ["missing mask",d=>{source(d).maskLayerId="missing";},/Missing layer dependency/],
  ["mask cycle",d=>{source(d).maskLayerId=d.components[0]!.layers[0]!.id;},/Circular/],
  ["incompatible element",d=>{source(d).kind="vector";},/incompatible/],
  ["tip dimensions",d=>{const e=source(d).elements[0]!;if(e.kind==="raster-stroke"&&e.brush.tip.kind==="bitmap")e.brush.tip.alpha.pop();},/bitmap tip/],
  ["texture dimensions",d=>{const e=source(d).elements[0]!;if(e.kind==="raster-stroke")e.brush.paperTexture!.alpha.pop();},/paper texture/],
  ["pen timing",d=>{const e=source(d).elements[0]!;if(e.kind==="raster-stroke")e.points[0]!.time=20;},/timestamps/],
  ["keyframe positions",d=>{const l=source(d);l.keyframes=[{id:"key:a",frame:0,transform:l.transform,opacity:1,easing:"linear"},{id:"key:b",frame:0,transform:l.transform,opacity:1,easing:"linear"}];},/Duplicate keyframe/],
  ["keyframe identity",d=>{const l=source(d);l.keyframes=[{id:d.panels[0]!.id,frame:0,transform:l.transform,opacity:1,easing:"linear"}];},/Duplicate stable id/],
];
it.each(corruptions)("rejects an unused component with invalid %s",(_name,corrupt,message)=>{
  const document=fixture();expect(()=>StoryboardProject.fromJSON(document)).not.toThrow();
  corrupt(document);expect(()=>StoryboardProject.fromJSON(document)).toThrow(message);
});
it("rejects a malformed texture in a library preset before any stroke uses it",()=>{
  const document=fixture();document.brushes[0]!.paperTexture={width:2,height:1,alpha:[1],scale:1,strength:.5};
  expect(()=>StoryboardProject.fromJSON(document)).toThrow(/paper texture/);
});

it("preflights descendant comments and explicitly retains them on a refreshed instance",async()=>{
 const p=StoryboardProject.create({title:"Reviewed component"}),panel=p.addScene("S").addShot("S").addPanel(),source=panel.addVectorLayer("Source");
 const element=source.vectorStroke([{x:10,y:10}],{width:5}),component=p.production.captureComponent(source.id,"Prop"),instance=p.production.instantiateComponent(component,panel.id);
 const tree=p.production.layer(instance);if(tree.kind!=="group"||tree.children[0]!.kind==="group")throw new Error("Fixture");
 const child=tree.children[0]!,copied=child.elements[0]!;
 const note=p.production.comment("Correct this contour",{panelId:panel.id,layerId:child.id,elementId:copied.id,frame:3,x:10,y:10});
 p.production.comment("Root note",{layerId:instance});
 source.edit(element,e=>({...e,opacity:.4}));p.production.reviseComponent(component,source.id);
 const before=p.toJSON();
 p.transaction("Handle refresh rejection",()=>{
  const staged=p.toJSON();expect(()=>p.production.refreshComponentInstance(instance)).toThrow(/anchor-to-instance/);expect(p.toJSON()).toEqual(staged);
 });
 p.production.refreshComponentInstance(instance,{comments:"anchor-to-instance"});
 const after=p.toJSON(),updated=after.comments.find(c=>c.id===note)!;
 expect(updated).toEqual({...before.comments.find(c=>c.id===note)!,anchor:{panelId:panel.id,layerId:instance,frame:3,x:10,y:10}});
 expect(after.comments[1]).toEqual(before.comments[1]);
 expect(p.production.layer(instance).componentSource?.version).toBe(2);
 expect(()=>p.production.element(copied.id)).toThrow();
 p.undo();expect(p.toJSON().comments).toEqual(before.comments);expect(p.production.element(copied.id)).toEqual(copied);
 p.redo();expect(p.toJSON().comments).toEqual(after.comments);
 const directory=await mkdtemp(join(tmpdir(),"refreshed-component-"));
 try{
  const file=join(directory,"project.cboard");await p.save(file);const reopened=await StoryboardProject.open(file);
  expect(reopened.toJSON().comments).toEqual(after.comments);
  expect(reopened.production.layer(instance)).toEqual(p.production.layer(instance));
  expect(await renderPanelPNG(reopened,panel.id,{frame:3})).toEqual(await renderPanelPNG(p,panel.id,{frame:3}));
 }finally{await rm(directory,{recursive:true,force:true});}

});

it("preflights locked descendants, mask consumers and drawing references before a caught refresh",()=>{
 const p=StoryboardProject.create({title:"Refresh dependencies"}),panel=p.addScene("S").addShot("S").addPanel(),source=panel.addVectorLayer("Source");
 source.vectorStroke([{x:10,y:10}],{width:5});
 const component=p.production.captureComponent(source.id,"Prop"),instance=p.production.instantiateComponent(component,panel.id);
 const tree=p.production.layer(instance);if(tree.kind!=="group")throw new Error("Fixture");const child=tree.children[0]!;
 const maskConsumer=panel.addVectorLayer("Paint",{maskLayerId:child.id});
 p.transaction("Caught mask rejection",()=>{const before=p.toJSON();expect(()=>p.production.refreshComponentInstance(instance)).toThrow(/descendant mask/);expect(p.toJSON()).toEqual(before);});
 maskConsumer.set({maskLayerId:null});
 const lock=p.production.lock("layer",child.id,"Approved");
 p.transaction("Caught lock rejection",()=>{const before=p.toJSON();expect(()=>p.production.refreshComponentInstance(instance)).toThrow(/unlock/);expect(p.toJSON()).toEqual(before);});
 p.production.unlock(lock);
 p.production.setDrawingSequence(instance,[{frame:0,drawingId:child.id}]);
 p.transaction("Caught drawing rejection",()=>{const before=p.toJSON();expect(()=>p.production.refreshComponentInstance(instance)).toThrow(/drawing sequence/);expect(p.toJSON()).toEqual(before);});
 p.production.setDrawingSequence(instance,null);p.production.refreshComponentInstance(instance);
 expect(p.production.layer(instance).componentSource?.version).toBe(1);
});

it("does not consume IDs or replace a library source when invalid capture/revision is caught",()=>{
 const p=StoryboardProject.create({title:"Atomic library revision"}),panel=p.addScene("S").addShot("S").addPanel(),source=panel.addVectorLayer("Source");
 const component=p.production.captureComponent(source.id,"Prop"),track=panel.addGroup("Animated"),cel=panel.addVectorLayer("Cel",{},track.id);
 p.production.setDrawingSequence(track.id,[{frame:0,drawingId:cel.id}]);
 const mask=panel.addVectorLayer("External mask"),masked=panel.addVectorLayer("External dependency",{maskLayerId:mask.id});
 p.transaction("Catch invalid component sources",()=>{
  for(const layerId of [track.id,masked.id])for(const operation of [()=>p.production.captureComponent(layerId,"Invalid"),()=>p.production.reviseComponent(component,layerId)]){
   const before=p.toJSON();expect(operation).toThrow();expect(p.toJSON()).toEqual(before);
  }
 });
});
