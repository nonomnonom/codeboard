import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {StoryboardProject,solveTwoBoneIK,renderPanelPNG,decodePixels,transformPoint,ProjectStore} from '../src/index.js';

it('solves both bend directions and reports outer/inner unreachable targets without stretching',()=>{
 for(const bend of [1,-1] as const)for(const target of [{x:80,y:40},{x:-60,y:20},{x:0,y:-50}]){
  const result=solveTwoBoneIK({x:0,y:0},target,60,40,bend);
  expect(result.reachable).toBe(true);expect(result.error).toBeLessThan(1e-10);
  expect(Math.hypot(result.elbow.x,result.elbow.y)).toBeCloseTo(60,10);
  expect(Math.hypot(result.end.x-result.elbow.x,result.end.y-result.elbow.y)).toBeCloseTo(40,10);
  expect(Math.sign(result.elbowRotation)).toBe(bend);
 }
 const far=solveTwoBoneIK({x:0,y:0},{x:200,y:0},60,40);
 expect(far).toMatchObject({reachable:false,error:100,end:{x:100,y:0}});
 const near=solveTwoBoneIK({x:0,y:0},{x:0,y:0},60,40);expect(near.reachable).toBe(false);expect(near.error).toBeCloseTo(20,10);
 expect(solveTwoBoneIK({x:5,y:7},{x:5,y:7},40,40).error).toBeLessThan(1e-10);
 expect(()=>solveTwoBoneIK({x:0,y:0},{x:Infinity,y:0},1,1)).toThrow();
 expect(()=>solveTwoBoneIK({x:0,y:0},{x:1,y:0},0,1)).toThrow();
});

function fixture(){
 const p=StoryboardProject.create({title:'Two-bone rig',width:180,height:160,background:'transparent'}),panel=p.addScene('S').addShot('S').addPanel({durationFrames:25});
 const root=panel.addGroup('Shoulder',{transform:{x:30,y:60}}),elbow=panel.addGroup('Elbow',{transform:{x:60}},root.id);
 panel.addVectorLayer('Upper arm',{},root.id).vectorStroke([{x:0,y:0},{x:60,y:0}],{width:10,color:'black'});
 const hand=panel.addVectorLayer('Hand',{},elbow.id),tip=hand.vectorStroke([{x:40,y:0}],{width:10,color:'red',pressureSize:0});
 p.production.setTwoBoneRig(root.id,{elbowId:elbow.id,upperLength:60,lowerLength:40});
 return {p,panel,root,elbow,tip};
}

it('authors two editable rotation keys, preserves other channels, renders the target and survives save/open/retime',async()=>{
 const {p,panel,root,elbow,tip}=fixture();
 p.production.addLayerKeyframe(root.id,12,{opacity:.75});
 const result=p.production.poseTwoBoneRig(root.id,12,{x:110,y:100},{bend:-1});expect(result.error).toBeLessThan(1e-10);
 const ids=[p.production.layerKeyframes(root.id)[0]!.id,p.production.layerKeyframes(elbow.id)[0]!.id];
 p.production.poseTwoBoneRig(root.id,12,{x:110,y:100},{bend:-1});
 expect([p.production.layerKeyframes(root.id)[0]!.id,p.production.layerKeyframes(elbow.id)[0]!.id]).toEqual(ids);
 expect(p.production.layerKeyframes(root.id)[0]!.opacity).toBe(.75);
 const endpoint=transformPoint(p.production.coordinates(tip,{frame:12,camera:false}).localToFrame,{x:40,y:0});
 expect(endpoint.x).toBeCloseTo(110,10);expect(endpoint.y).toBeCloseTo(100,10);
 const image=await renderPanelPNG(p,panel.id,{frame:12,annotations:false}),pixels=await decodePixels(image);
 expect([...pixels.pixels.slice((100*180+110)*4,(100*180+110)*4+4)]).toEqual([255,0,0,191]);
 const directory=await mkdtemp(join(tmpdir(),'two-bone-'));
 try{
  const file=join(directory,'rig.cboard');await p.save(file);const opened=await StoryboardProject.open(file),store=ProjectStore.open(file);
  try{expect(await renderPanelPNG(store.panelDocument(panel.id),panel.id,{frame:12,annotations:false})).toEqual(image);}finally{store.close();}
  expect(opened.production.twoBoneRig(root.id)).toEqual(p.production.twoBoneRig(root.id));
  opened.production.setPanelDuration(panel.id,49);
  expect(opened.production.layerKeyframes(root.id)[0]!.frame).toBe(24);
  expect(await renderPanelPNG(opened,panel.id,{frame:24,annotations:false})).toEqual(image);
  const copy=opened.production.duplicatePanel(panel.id),group=opened.toJSON().panels.find(panel=>panel.id===copy)!.layers.find(layer=>layer.name==='Shoulder')!;
  if(group.kind!=='group')throw new Error('Fixture');expect(group.twoBoneRig!.elbowId).not.toBe(elbow.id);
  expect(group.children.some(child=>child.id===group.twoBoneRig!.elbowId)).toBe(true);
 }finally{await rm(directory,{recursive:true,force:true});}
});

it('preflights invalid poses, preserves undo, and protects joint hierarchy invariants',()=>{
 const {p,panel,root,elbow}=fixture(),before=p.toJSON();
 p.transaction('Catch errors',()=>{
  const unchanged=p.toJSON();
  for(const action of [
   ()=>p.production.poseTwoBoneRig(root.id,1,{x:NaN,y:0}),
   ()=>p.production.poseTwoBoneRig(root.id,1.5,{x:50,y:0}),
   ()=>p.production.poseTwoBoneRig(root.id,1,{x:50,y:0},{easing:'bad' as never}),
   ()=>p.production.removeLayer(elbow.id),()=>p.production.reparentLayer(elbow.id,null),
  ]){expect(action).toThrow();expect(p.toJSON()).toEqual(unchanged);}
 });
 p.production.poseTwoBoneRig(root.id,0,{x:80,y:70});p.undo();expect(p.toJSON().panels).toEqual(before.panels);p.redo();
 expect(()=>elbow.set({transform:{x:50,y:0,rotation:0,scaleX:1,scaleY:1}})).toThrow(/upperLength/);
 expect(()=>p.production.addLayerKeyframe(root.id,2,{transform:{scaleX:2}})).toThrow(/unit scale/);
 p.production.setTwoBoneRig(root.id,null);p.production.reparentLayer(elbow.id,null);
 expect(p.production.twoBoneRig(root.id)).toBeNull();expect(p.toJSON().panels[0]!.layers.some(layer=>layer.id===elbow.id)).toBe(true);
});

it('rejects generic joint edits before mutation so a caught error does not poison an authoring transaction',()=>{
 const {p,root,elbow}=fixture();
 const key=p.production.addLayerKeyframe(elbow.id,0,{transform:{rotation:.2}}),before=p.toJSON();
 p.transaction('Revise rig with recoverable mistakes',()=>{
  for(const action of [
   ()=>root.set({pivot:{x:1,y:0}}),
   ()=>elbow.set({transform:{x:59,y:0,rotation:0,scaleX:1,scaleY:1}}),
   ()=>p.production.addLayerKeyframe(root.id,3,{transform:{scaleX:2}}),
   ()=>p.production.addLayerKeyframe(elbow.id,3,{transform:{y:2}}),
   ()=>p.production.updateLayerKeyframe(elbow.id,key,{transform:{x:60}}),
  ]){
   const unchanged=p.toJSON();expect(action).toThrow();expect(p.toJSON()).toEqual(unchanged);
  }
  p.production.poseTwoBoneRig(root.id,12,{x:100,y:90});
 });
 expect(p.production.layerKeyframes(root.id)).toHaveLength(1);
 expect(p.production.layerKeyframes(elbow.id)).toHaveLength(2);
 p.undo();expect(p.toJSON().panels).toEqual(before.panels);
 p.redo();expect(p.production.layerKeyframes(root.id)[0]!.frame).toBe(12);
});
