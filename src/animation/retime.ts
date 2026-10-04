import type { Layer, StoryboardDocument } from "../model/types.js";

/** Frame positions are global; stroke point.time remains pen-input milliseconds. */
export function retimePanel(document: StoryboardDocument, panelId: string, duration: number): string[] {
  const panel = document.panels.find(p => p.id === panelId);
  if (!panel) throw new Error(`Panel not found: ${panelId}`);
  if (!Number.isSafeInteger(duration) || duration < 1) throw new Error("Panel duration must be a positive safe integer frame count");
  const oldDuration = panel.durationFrames;
  const end = panel.startFrame + oldDuration;
  const delta = duration - oldDuration;
  if (!delta) return [];
  if (panel.transition.durationFrames >= duration) throw new Error("Shortened panel would truncate its transition; revise the transition first");
  const affected = new Set<string>([panelId]);
  const updates:(()=>void)[]=[];
  const safe=(frame:number)=>{
    if(!Number.isSafeInteger(frame)||frame<0)throw new Error("Retiming exceeds the safe integer frame range");
    return frame;
  };
  for(const p of document.panels)safe(p.id===panelId?p.startFrame+duration:p.startFrame>=end?safe(p.startFrame+delta)+p.durationFrames:p.startFrame+p.durationFrames);
  const map = (frame: number) => {
    if(frame<panel.startFrame)return frame;
    if(frame>=end)return safe(frame+delta);
    if(oldDuration===1)return panel.startFrame;
    // Round the rational position without losing frame precision in the product.
    const numerator=BigInt(frame-panel.startFrame)*BigInt(duration-1),denominator=BigInt(oldDuration-1);
    return safe(panel.startFrame+Number((2n*numerator+denominator)/(2n*denominator)));
  };
  const keys = <T extends { id: string; frame: number }>(entries: T[]) => {
    const positions = new Set<number>();
    for (const key of entries) {
      const frame = map(key.frame);
      if (positions.has(frame)) throw new Error(`Retiming collapses keyframes at frame ${frame}; remove or move a keyframe first`);
      positions.add(frame);
      if (frame !== key.frame) affected.add(key.id);
      updates.push(()=>{key.frame=frame;});
    }
  };
  const visit = (layers: Layer[]) => {
    for (const layer of layers) {
      keys(layer.keyframes);
      if (layer.exposure) {
        const exposure=layer.exposure,startFrame=map(exposure.startFrame),endFrame=map(exposure.endFrame);
        if(endFrame<=startFrame)throw new Error(`Retiming collapses drawing exposure ${layer.id}`);
        updates.push(()=>{exposure.startFrame=startFrame;exposure.endFrame=endFrame;});
      }
      if (layer.kind === "group") {
        if(layer.drawingSequence){
          const positions=new Set<number>();
          for(const key of layer.drawingSequence){
            const frame=map(key.frame);
            if(positions.has(frame))throw new Error(`Retiming collapses drawing exposures in ${layer.id}; revise the drawing sequence first`);
            positions.add(frame);
            if(frame!==key.frame)affected.add(layer.id);
            updates.push(()=>{key.frame=frame;});
          }
        }
        visit(layer.children);
      }
      else for (const e of layer.elements) if (e.kind === "raster-stroke" && e.reveal) {
        const startFrame=map(e.reveal.startFrame),endFrame=map(e.reveal.endFrame);
        if(endFrame<=startFrame)throw new Error(`Retiming collapses stroke reveal ${e.id}`);
        updates.push(()=>{e.reveal={startFrame,endFrame};});
      }
    }
  };
  for (const p of document.panels) {
    if (p.startFrame >= end) { const startFrame=map(p.startFrame);updates.push(()=>{p.startFrame=startFrame;}); affected.add(p.id); }
    visit(p.layers);
  }
  for (const shot of document.shots) keys(shot.cameraKeyframes);
  for (const track of document.audioTracks) for (const clip of track.clips) {
    // Sound is never time-stretched: later cues ripple, crossing ambience keeps its source duration.
    if (clip.startFrame >= end) {
      if (track.locked) throw new Error(`Retiming would move a clip on locked audio track ${track.id}`);
      const startFrame=map(clip.startFrame);safe(startFrame+clip.durationFrames);updates.push(()=>{clip.startFrame=startFrame;});
      affected.add(clip.id);
    }
  }
  for (const comment of document.comments) if (comment.anchor.frame !== undefined) {
    const frame=map(comment.anchor.frame);updates.push(()=>{comment.anchor.frame=frame;});
  }
  for(const update of updates)update();
  panel.durationFrames = duration;
  for (const p of document.panels) if (affected.has(p.id)) p.revision++;
  return [...affected];
}
