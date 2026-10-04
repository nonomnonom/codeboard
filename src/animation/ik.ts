import type {GroupLayer,Layer,TwoBoneRig} from '../model/types.js';

/** Check only rigs whose joints are affected, without copying artwork payloads. */
export function validateRigLayerChange(layers:readonly Layer[],proposed:Layer):void{
 for(const layer of layers){
  if(layer.kind!=='group')continue;
  const root=layer.id===proposed.id?proposed:layer;
  if(root.kind==='group'&&root.twoBoneRig&&(root.id===proposed.id||root.twoBoneRig.elbowId===proposed.id)){
   validateTwoBoneRig({...root,children:root.children.map(child=>child.id===proposed.id?proposed:child)},root.twoBoneRig);
  }
  validateRigLayerChange(layer.children,proposed);
 }
}

export interface TwoBoneSolution {
 rootRotation:number; elbowRotation:number;
 elbow:{x:number;y:number}; end:{x:number;y:number}; reachable:boolean; error:number;
}
export function solveTwoBoneIK(origin:{x:number;y:number},target:{x:number;y:number},upperLength:number,lowerLength:number,bend:1|-1=1):TwoBoneSolution{
 if(![origin.x,origin.y,target.x,target.y,upperLength,lowerLength].every(Number.isFinite)||upperLength<=0||lowerLength<=0||(bend!==1&&bend!==-1))throw new Error('IK requires finite coordinates, positive lengths and bend +1 or -1');
 const scale=Math.max(upperLength,lowerLength),minimum=Math.abs(upperLength-lowerLength),maximum=upperLength+lowerLength;
 if(!Number.isFinite(maximum)||Math.min(upperLength,lowerLength)/scale<Number.EPSILON)throw new Error('IK lengths exceed the supported numerical range');
 const dx=target.x-origin.x,dy=target.y-origin.y,distance=Math.hypot(dx,dy);
 if(!Number.isFinite(distance))throw new Error('IK target offset exceeds the supported numerical range');
 const reach=Math.max(minimum,Math.min(maximum,distance)),a=upperLength/scale,b=lowerLength/scale,d=reach/scale;
 const elbowRotation=bend*Math.acos(Math.max(-1,Math.min(1,(d*d-a*a-b*b)/(2*a*b))));
 const direction=distance===0?0:Math.atan2(dy,dx);
 const rootRotation=reach===0?direction:direction-Math.atan2(b*Math.sin(elbowRotation),a+b*Math.cos(elbowRotation));
 const elbow={x:origin.x+upperLength*Math.cos(rootRotation),y:origin.y+upperLength*Math.sin(rootRotation)};
 const end={x:elbow.x+lowerLength*Math.cos(rootRotation+elbowRotation),y:elbow.y+lowerLength*Math.sin(rootRotation+elbowRotation)};
 if(![elbow.x,elbow.y,end.x,end.y].every(Number.isFinite))throw new Error('IK result exceeds the supported numerical range');
 return {rootRotation,elbowRotation,elbow,end,reachable:distance>=minimum&&distance<=maximum,error:Math.hypot(end.x-target.x,end.y-target.y)};
}

export function validateTwoBoneRig(root:GroupLayer,rig:TwoBoneRig):GroupLayer{
 solveTwoBoneIK({x:0,y:0},{x:0,y:0},rig.upperLength,rig.lowerLength);
 const elbow=root.children.find(child=>child.id===rig.elbowId);
 if(elbow?.kind!=='group')throw new Error(`Rig elbow must be an immediate child group: ${rig.elbowId}`);
 if(root.drawingSequence!==undefined)throw new Error('A two-bone rig root cannot select drawing alternatives');
 for(const joint of [root,elbow]){
  if(joint.transform.scaleX!==1||joint.transform.scaleY!==1||joint.pivot?.x||joint.pivot?.y||joint.keyframes.some(key=>key.transform.scaleX!==undefined||key.transform.scaleY!==undefined))throw new Error('Two-bone joints require unit scale and origin pivots; scale an ancestor instead');
 }
 if(elbow.transform.x!==rig.upperLength||elbow.transform.y!==0||elbow.keyframes.some(key=>key.transform.x!==undefined||key.transform.y!==undefined))throw new Error('Rig elbow must stay at (upperLength, 0) in root coordinates');
 return elbow;
}
