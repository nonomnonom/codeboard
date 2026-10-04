import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import assert from "node:assert/strict";
import {StoryboardProject,brushes,catmullRom,renderPanelPNG,ProjectStore,createPixels,polygonPixelSelection,featherPixelSelection,fillPixels,pathCommands} from "codeboard-studio";

const directory=await mkdtemp(join(tmpdir(),"codeboard-package-"));
try{
  const board=StoryboardProject.create({title:"Public package",width:128,height:96});
  const panel=board.addScene("Street").addShot("Arrival").addPanel({id:"arrival"});
  const paint=panel.addRasterLayer("Rough",{id:"rough"});
  const stroke=paint.rasterStroke(catmullRom([{x:20,y:70,pressure:.2},{x:50,y:20,pressure:1},{x:105,y:65,pressure:.3}],12),brushes.roughPencil,{seed:12});
  const ink=panel.addVectorLayer("Editable contour"),line=ink.vectorStroke([{x:25,y:80,pressure:.2},{x:110,y:80,pressure:1}],{width:8});
  ink.outlineStroke(line);
  ink.booleanPath(line,pathCommands("M 60 0 L 70 0 L 70 96 L 60 96 Z"),"difference");
  const pixels=createPixels(24,24),selection=await featherPixelSelection(polygonPixelSelection(24,24,[{x:6,y:6},{x:18,y:6},{x:18,y:18},{x:6,y:18}]),2);
  fillPixels(pixels,[180,110,30,255],{selection});
  const surface=paint.rasterSurface(pixels);
  const original=await renderPanelPNG(board,panel.id,{annotations:false}),file=join(directory,"arrival.cboard");
  await board.save(file);
  const reopened=await StoryboardProject.open(file);
  assert.deepEqual(reopened.production.element(stroke),board.production.element(stroke),"Opened element changed authoring data");
  assert((await renderPanelPNG(reopened,panel.id,{annotations:false})).equals(original),"Opened project changed render");
  assert.deepEqual(reopened.production.element(line),board.production.element(line),"Outlined contour changed on reopen");
  assert.deepEqual(reopened.panel(panel.id).layer(paint.id).readPixels(surface),pixels,"Feathered pixel data changed on reopen");
  const store=ProjectStore.open(file);
  try{
    const panel=store.readPanel("arrival");panel.layers[0].transform.x+=15;
    store.updatePanel(panel,{expectedVersion:store.version});
    const revised=await renderPanelPNG(store.panelDocument("arrival"),"arrival",{annotations:false});
    assert(!revised.equals(original),"Targeted revision did not affect render");
    store.verify();
  }finally{store.close();}
  console.log("Public package: import, drawing, save/open parity, partial revision and integrity passed");
}finally{await rm(directory,{recursive:true,force:true});}
