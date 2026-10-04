import {expect,it} from "vitest";
import {StoryboardProject,createPixels,brushes,customizeBrush,type DrawingElement,type BrushPreset} from "../src/index.js";

it("gives derived brushes independent tips, textures, provenance and dynamics",()=>{
  const base:BrushPreset={...structuredClone(brushes.cleanInk),
    tip:{kind:"bitmap",width:2,height:2,alpha:[1,.3,0,.7],angle:0,rotationMode:"stroke"},
    paperTexture:{width:2,height:1,alpha:[1,.3],scale:1,strength:.5},
    provenance:{source:"Authored fixture",license:"CC0-1.0",redistribution:"allowed",resourceChecksum:"fixture"}};
  const original=structuredClone(base),derived=customizeBrush(base,{name:"Independent variant"});
  if(derived.tip.kind!=="bitmap")throw new Error("Expected bitmap");
  derived.tip.alpha.fill(0);derived.tip.angle=1;
  derived.paperTexture!.alpha.fill(0);derived.provenance!.source="Variant";
  derived.dynamics.pressureSize=.1;
  expect(base).toEqual(original);
  const changes={tip:original.tip,paperTexture:original.paperTexture!,provenance:original.provenance!,dynamics:{pressureSize:.3}};
  const replacement=customizeBrush(base,changes),snapshot=structuredClone(replacement);
  if(changes.tip.kind!=="bitmap")throw new Error("Expected bitmap");
  changes.tip.alpha[0]=0;changes.paperTexture!.alpha[0]=0;
  changes.provenance!.license="Changed";changes.dynamics.pressureSize=.8;
  expect(replacement).toEqual(snapshot);
});

function fixture(){
  const project=StoryboardProject.create({title:"Owned inputs",width:64,height:64});
  const panel=project.addScene("Scene").addShot("Shot").addPanel({durationFrames:24});
  return {project,panel};
}

it("detaches accepted element edits from references retained by the callback",()=>{
  const {project,panel}=fixture(),layer=panel.addVectorLayer("Ink");
  const id=layer.vectorStroke([{x:3,y:4},{x:30,y:40}]);
  let retained!:DrawingElement;
  layer.edit(id,e=>{retained=e;e.opacity=.6;return e;});
  const committed=project.toJSON();
  retained.opacity=.1;
  if(retained.kind==="vector-stroke")retained.points[0]!.x=900;
  expect(project.toJSON()).toEqual(committed);
  project.undo();project.redo();expect(project.toJSON().panels).toEqual(committed.panels);
});

it("owns layer exposure and motion annotation inputs",()=>{
  const {project,panel}=fixture(),exposure={startFrame:0,endFrame:12};
  panel.addVectorLayer("Pose",{exposure});
  const before=project.toJSON();exposure.endFrame=1;
  expect(project.toJSON()).toEqual(before);
  const from={x:1,y:2},to={x:30,y:40};panel.addMotion("Reach",from,to);
  const annotated=project.toJSON();from.x=99;to.y=99;
  expect(project.toJSON()).toEqual(annotated);
});

it("owns replacement keyframe transforms",()=>{
  const {project,panel}=fixture(),layer=panel.addVectorLayer("Pose");
  const key=project.production.addLayerKeyframe(layer.id,0,{opacity:1});
  const transform={x:3,y:4,scaleX:1,scaleY:1,rotation:0};
  project.production.updateLayerKeyframe(layer.id,key,{transform});
  const before=project.toJSON();transform.x=800;
  expect(project.toJSON()).toEqual(before);
});

it("owns source paint arrays, brush settings and imported pixel buffers",()=>{
  const {project,panel}=fixture(),paint=panel.addRasterLayer("Paint");
  const points=[{x:3,y:4}],brush=structuredClone(brushes.cleanInk),pixels=createPixels(4,4);
  paint.rasterStroke(points,brush);paint.rasterSurface(pixels);
  const before=project.toJSON();points[0]!.x=90;brush.tip.angle=2;pixels.pixels[0]=255;
  expect(project.toJSON()).toEqual(before);
  const imported=StoryboardProject.fromJSON(before),surface=before.panels[0]!.layers[0]!;
  if(surface.kind!=="raster")throw new Error("Expected paint layer");
  const element=surface.elements[1]!;if(element.kind!=="raster-surface")throw new Error("Expected surface");
  element.pixels[0]=98;
  const owned=imported.production.layer(paint.id);
  if(owned.kind!=="raster"||owned.elements[1]!.kind!=="raster-surface")throw new Error("Expected imported surface");
  expect(owned.elements[1]!.pixels[0]).toBe(0);
});

it("isolates a pixel buffer retained by an element edit callback",()=>{
  const {project,panel}=fixture(),paint=panel.addRasterLayer("Paint"),id=paint.rasterSurface(createPixels(4,4));
  let retained!:Uint8Array;
  paint.edit(id,e=>{
    if(e.kind!=="raster-surface")throw new Error("Expected pixels");
    e.pixels[0]=70;retained=e.pixels;return e;
  });
  retained[0]=250;
  expect(paint.readPixels(id).pixels[0]).toBe(70);
  project.undo();expect(paint.readPixels(id).pixels[0]).toBe(0);
  project.redo();expect(paint.readPixels(id).pixels[0]).toBe(70);
});
