import type {PanelHandle,StoryboardProject} from '../../src/index.js';
import {keeper} from './art.js';

/** Authored replacement drawings, reused on threes; the support sole stays planted for each step. */
export function walkingPerformance(panel:PanelHandle,project:StoryboardProject,start:number,duration:number,x:number,y:number,scale:number,name='Keeper / walking performance'){
 const track=panel.addGroup(name,{transform:{x,y,scaleX:scale,scaleY:scale}});
 const drawings=[];
 for(let phase=0;phase<16;phase++){
  const drawing=keeper(panel,0,0,1,'walk',true,phase,track.id);
  drawing.set({name:`Walking drawing / ${phase+1} / ${phase<8?'left':'right'} support`});
  drawings.push(drawing.id);
 }
 const keys=[];
 for(let offset=0;offset<duration;offset+=3){
  keys.push({frame:start+offset,drawingId:drawings[(offset/3)%16]!});
  project.production.addLayerKeyframe(track.id,start+offset,{transform:{x:x+scale*196*offset/24},easing:'hold'});
 }
 project.production.setDrawingSequence(track.id,keys);
 return track;
}
