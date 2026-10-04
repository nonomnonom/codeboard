import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect,it} from 'vitest';
import {StoryboardProject,ProjectStore,pathCommands,renderPanelPNG,decodePixels,createRenderSession,type VectorFill} from '../src/index.js';

it('composites a gradient through a translated half-opacity mask with an element matrix',async()=>{
 const p=StoryboardProject.create({title:'Masked gradient',width:100,height:40,background:'transparent'}),panel=p.addScene('S').addShot('S').addPanel();
 const mask=panel.addVectorLayer('Mask',{visible:false,opacity:.5,transform:{x:20}});
 mask.path(pathCommands('M 0 0 L 40 0 L 40 40 L 0 40 Z'),{fill:'white'});
 const art=panel.addVectorLayer('Gradient',{maskLayerId:mask.id}),id=art.path(pathCommands('M 0 0 L 30 0 L 30 40 L 0 40 Z'),{fill:{kind:'linear',from:{x:0,y:0},to:{x:30,y:0},stops:[{offset:0,color:'black'},{offset:1,color:'white'}]}});
 art.edit(id,e=>({...e,matrix:[2,0,0,1,10,0]}));
 const png=await renderPanelPNG(p,panel.id),image=await decodePixels(png),at=(x:number)=>(20*100+x)*4;
 expect(image.pixels[at(15)+3]).toBe(0);expect(image.pixels[at(65)+3]).toBe(0);
 expect(image.pixels[at(40)+3]).toBe(128);expect(image.pixels[at(40)]).toBeGreaterThan(120);expect(image.pixels[at(40)]).toBeLessThan(140);
 const canvas=createRenderSession(p).panel(panel.id);try{expect(await canvas.toBuffer('png')).toEqual(png);}finally{canvas.getContext('2d').reset();}
});

it.each(['linear','radial'] as const)('renders editable %s fill with local placement, cached parity, undo and binary reopen',async kind=>{
 const directory=await mkdtemp(join(tmpdir(),'gradient-'));
 try{
  const p=StoryboardProject.create({title:'Gradient',width:100,height:60,background:'transparent'}),panel=p.addScene('S').addShot('S').addPanel();
  const layer=panel.addVectorLayer('Shading',{transform:{x:10}});
  const fill:VectorFill=kind==='linear'?{kind,from:{x:0,y:0},to:{x:60,y:0},stops:[{offset:0,color:'black'},{offset:1,color:'white'}]}:{kind,from:{x:0,y:20,radius:0},to:{x:0,y:20,radius:60},stops:[{offset:0,color:'black'},{offset:1,color:'white'}]};
  const id=layer.path(pathCommands('M 0 0 L 60 0 L 60 40 L 0 40 Z'),{fill});
  const image=await renderPanelPNG(p,panel.id),pixels=await decodePixels(image);
  const value=(x:number)=>pixels.pixels[(20*100+x)*4]!;
  expect(value(15)).toBeLessThan(35);expect(value(40)).toBeGreaterThan(120);expect(value(40)).toBeLessThan(140);expect(value(65)).toBeGreaterThan(225);
  expect(pixels.pixels[(20*100+5)*4+3]).toBe(0);
  fill.stops[0]!.color='red';expect(await renderPanelPNG(p,panel.id)).toEqual(image);
  const session=createRenderSession(p),canvas=session.panel(panel.id);try{expect(await canvas.toBuffer('png')).toEqual(image);}finally{canvas.getContext('2d').reset();}
  layer.edit(id,e=>e.kind==='vector-path'?{...e,fill}:e);expect((await renderPanelPNG(p,panel.id)).equals(image)).toBe(false);
  p.undo();expect(await renderPanelPNG(p,panel.id)).toEqual(image);p.redo();
  const revised=await renderPanelPNG(p,panel.id),file=join(directory,'gradient.cboard');await p.save(file);
  const reopened=await StoryboardProject.open(file);expect(await renderPanelPNG(reopened,panel.id)).toEqual(revised);
  const store=ProjectStore.open(file);try{expect(await renderPanelPNG(store.panelDocument(panel.id),panel.id)).toEqual(revised);store.verify();}finally{store.close();}
  const input=p.toJSON(),other=StoryboardProject.fromJSON(input),drawing=input.panels[0]!.layers[0]!;
  if(drawing.kind==='group'||drawing.elements[0]?.kind!=='vector-path'||typeof drawing.elements[0].fill==='string'||!drawing.elements[0].fill)throw new Error('Fixture');
  drawing.elements[0].fill.stops[0]!.color='green';expect(await renderPanelPNG(other,panel.id)).toEqual(revised);
 }finally{await rm(directory,{recursive:true,force:true});}
});

it('rejects invalid fills before a caught edit changes artwork',()=>{
 const p=StoryboardProject.create({title:'Validation'}),layer=p.addScene('S').addShot('S').addPanel().addVectorLayer('Ink');
 const id=layer.path(pathCommands('M 0 0 L 20 0 L 20 20 Z'),{fill:'black'});
 const base={kind:'linear',from:{x:0,y:0},to:{x:20,y:0},stops:[{offset:0,color:'black'},{offset:1,color:'white'}]};
 p.transaction('Recover invalid fills',()=>{
  const before=p.toJSON();
  for(const fill of [{...base,to:base.from},{...base,stops:[{offset:1,color:'black'},{offset:0,color:'white'}]},{...base,to:{x:Infinity,y:0}},{...base,stops:[{offset:0,color:'nonsense'},{offset:1,color:'white'}]},{...base,kind:'radial',from:{x:0,y:0,radius:-1},to:{x:0,y:0,radius:20}}]){
   expect(()=>layer.edit(id,e=>e.kind==='vector-path'?{...e,fill:fill as VectorFill}:e)).toThrow(/fill/);expect(p.toJSON()).toEqual(before);
  }
  layer.edit(id,e=>e.kind==='vector-path'?{...e,fill:'white'}:e);
 });
});
