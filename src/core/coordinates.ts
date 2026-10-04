import type {AffineMatrix,Layer,StoryboardDocument,DrawingElement} from "../model/types.js";
import {evaluateCamera,evaluateLayer} from "../animation/evaluate.js";
import {assertRenderFrame} from "../animation/frame.js";
import {cameraPlane} from "../animation/camera-plane.js";
import {invertMatrix,matrixFromTransform,multiplyMatrices} from "../drawing/math.js";

export interface CoordinateOptions {frame?:number;camera?:boolean}
export interface CoordinateSpace {
  panelId:string;layerId:string;rootLayerId:string;targetId:string;frame:number;
  localToFrame:AffineMatrix;frameToLocal:AffineMatrix|null;
}
function locate(layers:Layer[],id:string,ancestors:Layer[]=[]):{path:Layer[];element?:DrawingElement}|undefined{
  for(const layer of layers){
    const path=[...ancestors,layer];
    if(layer.id===id)return {path};
    if(layer.kind==="group"){const found=locate(layer.children,id,path);if(found)return found;}
    else {const element=layer.elements.find(e=>e.id===id);if(element)return {path,element};}
  }
  return undefined;
}
export function coordinateSpace(document:StoryboardDocument,targetId:string,options:CoordinateOptions={}):CoordinateSpace{
  for(const panel of document.panels){
    const found=locate(panel.layers,targetId);if(!found)continue;
    const frame=options.frame??panel.startFrame;assertRenderFrame(frame);
    let localToFrame:AffineMatrix=[1,0,0,1,0,0];
    if(options.camera!==false){
      const shot=document.shots.find(s=>s.id===panel.shotId),camera=evaluateCamera(shot?.cameraKeyframes??[],frame),depth=evaluateLayer(found.path[0]!,frame).depth;
      localToFrame=cameraPlane(camera,depth,panel.width,panel.height).matrix;
    }
    for(const layer of found.path)localToFrame=multiplyMatrices(localToFrame,matrixFromTransform(evaluateLayer(layer,frame).transform,layer.pivot));
    if(found.element?.matrix)localToFrame=multiplyMatrices(localToFrame,found.element.matrix);
    let frameToLocal:AffineMatrix|null=null;
    try{frameToLocal=invertMatrix(localToFrame);}catch{ /* Forward mapping remains useful when inversion is unstable. */ }
    return {panelId:panel.id,layerId:found.path.at(-1)!.id,rootLayerId:found.path[0]!.id,targetId,frame,localToFrame,frameToLocal};
  }
  throw new Error(`Coordinate target is not a layer or drawing element in a panel: ${targetId}`);
}
