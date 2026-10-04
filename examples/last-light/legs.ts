import type {PanelHandle,StoryboardProject} from 'codeboard-studio';
import {contour,ring,ink,amber} from './art.ts';

export function flightLegRigs(panel:PanelHandle,project:StoryboardProject,parentId:string,bodyId:string,start:number){
 const body=project.production.layer(bodyId);if(body.kind==='group')throw new Error('Expected thorax drawing');
 const removed=[];
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const stroke=body.elements.find(e=>e.kind==='vector-stroke'&&Math.abs(e.points[0]!.x-side*14)<1e-8&&Math.abs(e.points[0]!.y-i*9)<1e-8&&Math.abs(e.points.at(-1)!.x-side*(31+i*6))<1e-8);
  if(!stroke)throw new Error('Expected original insect leg stroke');removed.push(stroke.id);
 }
 project.select({panelId:panel.id,layerId:bodyId,elementIds:removed}).remove();
 const rigs=[];
 for(const side of [-1,1] as const)for(let i=0;i<3;i++){
  const upper=Math.hypot(11+i*4,3*i+5),lower=Math.hypot(6+i*2,13);
  const root=panel.addGroup(`Flight leg / ${side<0?'left':'right'} ${i+1}`,{transform:{x:side*14,y:i*9}},parentId);
  const elbow=panel.addGroup('Leg / hinge',{transform:{x:upper}},root.id);
  for(const [joint,length] of [[root,upper],[elbow,lower]] as const){
   const metal=panel.addVectorLayer('Leg / brass link',{},joint.id);
   contour(metal,`M 0 -1.1 Q ${length*.55} -1.8 ${length} -.8 L ${length} .8 Q ${length*.5} 1.5 0 1 Z`,'#9a916a',ink,.7);
   contour(metal,`M 2 -.4 L ${length-1} -.4`,'transparent',amber,.5);
   ring(metal,0,0,1.6,1.6,ink,.6,'#cfb577');
  }
  project.production.setTwoBoneRig(root.id,{elbowId:elbow.id,upperLength:upper,lowerLength:lower});
  project.production.poseTwoBoneRig(root.id,start,{x:side*(31+i*6),y:i*12+18},{bend:side,easing:'ease-in-out'});
  project.production.poseTwoBoneRig(root.id,start+12,{x:side*(20+i*2),y:i*9+18},{bend:side,easing:'hold'});
  rigs.push(root.id);
 }
 return rigs;
}
