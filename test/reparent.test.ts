import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it,vi} from 'vitest';
import {StoryboardProject,renderPanelPNG,createRenderSession,decodePixels,ProjectStore} from '../src/index.js';

it('reparents editable artwork with stable IDs, local curves, scoped copying and render/save/undo parity',async()=>{
 const p=StoryboardProject.create({title:'Hierarchy',width:100,height:80,background:'transparent'}),shot=p.addScene('S').addShot('S'),panel=shot.addPanel({durationFrames:11});shot.addPanel({id:'unrelated'});
 const joint=panel.addGroup('Joint',{transform:{x:20,y:10}}),ink=panel.addVectorLayer('Ink',{transform:{x:5}}),element=ink.vectorStroke([{x:5,y:10}],{color:'red',width:8,pressureSize:0});
 p.production.addLayerKeyframe(joint.id,0,{transform:{x:20}});p.production.addLayerKeyframe(joint.id,10,{transform:{x:40}});
 p.production.addLayerKeyframe(ink.id,0,{transform:{x:5}});p.production.addLayerKeyframe(ink.id,10,{transform:{x:15}});
 p.production.comment('Keep this contour',{panelId:panel.id,layerId:ink.id,elementId:element});
 const before=p.toJSON(),layer=p.production.layer(ink.id),initial=await renderPanelPNG(p,panel.id,{frame:10}),spy=vi.spyOn(globalThis,'structuredClone');
 try{
  p.production.reparentLayer(ink.id,joint.id);
  expect(spy.mock.calls.some(([v]:any[])=>v?.id==='unrelated'||v?.schemaVersion===3)).toBe(false);
 }finally{spy.mockRestore();}
 expect(p.production.layer(ink.id)).toEqual(layer);expect(p.production.find({name:"Ink",panelId:panel.id})[0]!.parentId).toBe(joint.id);
 expect(p.toJSON().comments).toEqual(before.comments);
 const image=await renderPanelPNG(p,panel.id,{frame:10,annotations:false}),pixels=await decodePixels(image);
 expect([...pixels.pixels.slice((20*100+60)*4,(20*100+60)*4+4)]).toEqual([255,0,0,255]);
 const directory=await mkdtemp(join(tmpdir(),'reparent-'));
 try{
  const file=join(directory,'project.cboard');await p.save(file);const opened=await StoryboardProject.open(file),store=ProjectStore.open(file);
  try{expect(await renderPanelPNG(store.panelDocument(panel.id),panel.id,{frame:10,annotations:false})).toEqual(image);}finally{store.close();}
  expect(await renderPanelPNG(opened,panel.id,{frame:10,annotations:false})).toEqual(image);
  expect(await createRenderSession(opened).panel(panel.id,10).toBuffer('png')).toEqual(image);
 }finally{await rm(directory,{recursive:true,force:true});}
 p.undo();expect(p.toJSON().panels).toEqual(before.panels);expect(await renderPanelPNG(p,panel.id,{frame:10})).toEqual(initial);
 p.redo();p.production.reparentLayer(ink.id,null,{beforeLayerId:joint.id});
 expect(p.toJSON().panels[0]!.layers.map(l=>l.id)).toEqual([ink.id,joint.id]);expect(p.production.layer(ink.id)).toEqual(layer);
});

it('rejects cycles, cross-panel parents, referenced drawings and invalid insertion before changing a caught transaction',()=>{
 const p=StoryboardProject.create({title:'Hierarchy validation'}),shot=p.addScene('S').addShot('S'),panel=shot.addPanel(),other=shot.addPanel();
 const parent=panel.addGroup('Parent'),child=panel.addGroup('Child',{},parent.id),ink=panel.addVectorLayer('Ink',{},child.id),foreign=other.addGroup('Other panel');
 const track=panel.addGroup('Drawings'),cel=panel.addVectorLayer('Cel',{},track.id);p.production.setDrawingSequence(track.id,[{frame:0,drawingId:cel.id}]);
 const mask=panel.addGroup('Mask group'),paint=panel.addVectorLayer('Masked paint',{maskLayerId:mask.id});
 p.transaction('Catch invalid moves',()=>{
  for(const move of [
   ()=>p.production.reparentLayer(parent.id,child.id),()=>p.production.reparentLayer(parent.id,parent.id),
   ()=>p.production.reparentLayer(ink.id,foreign.id),()=>p.production.reparentLayer(child.id,ink.id),
   ()=>p.production.reparentLayer(ink.id,null,{beforeLayerId:ink.id}),
   ()=>p.production.reparentLayer(cel.id,null),()=>p.production.reparentLayer(paint.id,mask.id),
  ]){const before=p.toJSON();expect(move).toThrow();expect(p.toJSON()).toEqual(before);}
  p.production.setDrawingSequence(track.id,[]);p.production.reparentLayer(cel.id,null);
 });
 expect(p.production.find({name:"Cel",panelId:panel.id})[0]!.parentId).toBe(panel.id);
});

it('requires unlocking affected hierarchy and retains masks and drawing schedules when a whole group moves',()=>{
 const p=StoryboardProject.create({title:'Move rig'}),panel=p.addScene('S').addShot('S').addPanel(),root=panel.addGroup('Root'),rig=panel.addGroup('Rig');
 const mask=panel.addVectorLayer('Mask',{},rig.id),paint=panel.addVectorLayer('Paint',{maskLayerId:mask.id},rig.id);
 const lock=p.production.lock('layer',paint.id,'Approved ink'),before=p.toJSON();
 expect(()=>p.production.reparentLayer(rig.id,root.id)).toThrow(/unlock/);expect(p.toJSON()).toEqual(before);
 p.production.unlock(lock);p.production.reparentLayer(rig.id,root.id);
 expect(p.production.layer(paint.id).maskLayerId).toBe(mask.id);
 const track=panel.addGroup('Track'),cel=panel.addVectorLayer('Cel',{},track.id);p.production.setDrawingSequence(track.id,[{frame:0,drawingId:cel.id}]);
 const schedule=p.production.drawingSequence(track.id);p.production.reparentLayer(track.id,root.id);
 expect(p.production.drawingSequence(track.id)).toEqual(schedule);
 const clipped=panel.addVectorLayer('Clipped',{clipToBelow:true});
 expect(()=>p.production.reparentLayer(clipped.id,track.id)).toThrow(/clipping group/);
});
