import type {Panel} from "../model/types.js";

export function assertRenderFrame(frame:number):void{
  if(!Number.isSafeInteger(frame)||frame<0)throw new Error("Render frame must be a nonnegative safe integer");
}

export function selectFramePanels<T extends Pick<Panel,"startFrame"|"durationFrames"|"transition">>(source:readonly T[],frame:number){
  assertRenderFrame(frame);
  const panels=[...source].sort((a,b)=>a.startFrame-b.startFrame);
  const index=panels.findIndex(panel=>frame>=panel.startFrame&&frame<panel.startFrame+panel.durationFrames);
  const panel=panels[index];
  if(!panel)throw new Error(`No panel is exposed at frame ${frame}`);
  const transitionStart=panel.startFrame+panel.durationFrames-panel.transition.durationFrames;
  const incoming=panel.transition.type!=="cut"&&panel.transition.durationFrames>0&&frame>=transitionStart?panels[index+1]:undefined;
  return {panel,incoming,progress:incoming?(frame-transitionStart+1)/panel.transition.durationFrames:0};
}
