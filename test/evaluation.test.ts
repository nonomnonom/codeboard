import {expect,it} from "vitest";
import sharp from "sharp";
import {StoryboardProject,evaluateLayer,evaluateCamera,pathCommands,renderPanelPNG} from "../src/index.js";

it.each(["linear","ease-in-out","hold"] as const)("matches evaluated %s motion, opacity and depth camera to rendered pixels",async easing=>{
  const project=StoryboardProject.create({title:"Evaluated frame",width:160,height:80,background:"#ffffff"});
  const shot=project.addScene("S").addShot("Shot"),panel=shot.addPanel({durationFrames:30});
  const layer=panel.addVectorLayer("Moving ink",{depth:2});
  layer.path(pathCommands("M 0 0 L 12 0 L 12 12 L 0 12 Z"),{fill:"#000000",stroke:"#000000",strokeWidth:0});
  project.production.addLayerKeyframe(layer.id,4,{transform:{x:40,y:30},opacity:1,easing});
  project.production.addLayerKeyframe(layer.id,20,{transform:{x:104,y:30},opacity:.5});
  project.production.addCameraKeyframe(shot.id,4,{x:0,y:0,zoom:1,rotation:0,easing});
  project.production.addCameraKeyframe(shot.id,20,{x:32,y:0,zoom:1,rotation:0,easing:"linear"});
  const drawing=project.production.layer(layer.id),cameraKeys=project.production.inspect().scenes[0]!.shots[0]!.cameraKeyframes;
  for(const frame of [0,4,8,12,19,20,29]){
    const t=Math.max(0,Math.min(1,(frame-4)/16));
    const progress=t===1?1:easing==="hold"?0:easing==="linear"?t:t*t*(3-2*t);
    const artwork=evaluateLayer(drawing,frame),camera=evaluateCamera(cameraKeys,frame);
    expect(artwork.transform.x).toBeCloseTo(40+64*progress);
    expect(artwork.opacity).toBeCloseTo(1-.5*progress);
    expect(camera.x).toBeCloseTo(32*progress);
    const png=await renderPanelPNG(project,panel.id,{annotations:false,frame});
    const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const x=Math.round(artwork.transform.x-camera.x/2+6),y=36,at=(y*info.width+x)*4;
    const expected=Math.round(255*(1-artwork.opacity));
    expect(Math.abs(data[at]!-expected)).toBeLessThanOrEqual(1);
    expect(data[at+1]).toBe(data[at]);expect(data[at+2]).toBe(data[at]);expect(data[at+3]).toBe(255);
    expect(data[(y*info.width+10)*4]).toBe(255);
  }
});
