import { writeFile, stat } from "node:fs/promises";
import { resolve,join } from "node:path";
import { createHash } from "node:crypto";
import {timeRain} from "./last-light/art.ts";
import {fitRainBed} from "./last-light/sound.ts";
import { StoryboardProject,ProjectStore,renderPanelPNG,renderContactSheet,renderDetail,exportStoryboard,exportMovie,polygonPixelSelection,fillPixels } from "codeboard-studio";

const root=resolve("examples/output/last-light"),p=await StoryboardProject.open(join(root,"last-light.cboard"));
const before=p.toJSON(),version=p.version;
if(before.metadata["example:repair-revision"]==="applied"){
  console.log("Repair revision is already applied; refreshing exports without another artwork edit");
  await exportCurrent(p);process.exit(0);
}
const file=join(root,"last-light.cboard"),suffix=before.updatedAt.replace(/[^0-9]/g,""),baseRevision=`before-repair-${suffix}`,newRevision=`after-repair-${suffix}`;
const bytesBefore=(await stat(file)).size;
const history=ProjectStore.open(file);try{history.saveRevision(baseRevision,{expectedVersion:version});}finally{history.close();}
const hash=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
const unaffected=hash(await renderPanelPNG(p,"panel:02"));
await writeFile(join(root,"revision-before.png"),await renderPanelPNG(p,"panel:06"));
const hand=p.production.find({name:"palm-contour",panelId:"panel:06"})[0]!;
const reflection=p.production.find({name:"amber-reflection-surface",panelId:"panel:04"})[0]!;
const paint=p.panel("panel:04").layer(reflection.parentId!),originalPixels=paint.readPixels(reflection.id);
const selected=polygonPixelSelection(originalPixels.width,originalPixels.height,[{x:72,y:4},{x:129,y:3},{x:199,y:47},{x:102,y:49}]);
await writeFile(join(root,"pixel-revision-before.png"),await renderPanelPNG(p,"panel:04"));
p.transaction("Shorten thumb, tighten repair framing, extend the breath before flight",()=>{
  p.panel("panel:06").layer(hand.parentId!).edit(hand.id,e=>{
    if(e.kind!=="vector-path")throw new Error("Expected editable palm contour");
    return {...e,commands:e.commands.map(c=>c.op==="Q"&&c.x===580?{...c,x:c.x-10,x1:c.x1-7}:c)};
  });
  for(const key of before.shots.find(s=>s.id==="shot:6")!.cameraKeyframes)if(key.zoom!==undefined)p.production.updateCameraKeyframe("shot:6",key.id,{zoom:key.zoom*1.075,x:20});
  p.production.setPanelDuration("panel:10",60);
  fitRainBed(p,p.production.inspect().durationFrames);
  const rain=p.production.find({panelId:"panel:10",name:"Rain / foreground streaks"})[0]!;
  const waiting=before.panels.find(panel=>panel.id==="panel:10")!;
  timeRain(p,rain.id,waiting.startFrame,60);
  paint.editPixels(reflection.id,{x:0,y:0,width:originalPixels.width,height:originalPixels.height},patch=>fillPixels(patch,[250,205,125,180],{selection:selected,mode:"source-atop"}));
  p.setMetadata("example:repair-revision","applied");
});
if(hash(await renderPanelPNG(p,"panel:02"))!==unaffected)throw new Error("Unrelated panel changed");
const after=p.toJSON(),edited=hash(await renderPanelPNG(p,"panel:06"));
const editedPixels=paint.readPixels(reflection.id);
let changedPixels=0;
for(let i=0;i<selected.coverage.length;i++){
  const at=i*4;
  if(originalPixels.pixels[at+3]!==editedPixels.pixels[at+3])throw new Error("Reflection tint changed alpha");
  const changed=[0,1,2].some(c=>originalPixels.pixels[at+c]!==editedPixels.pixels[at+c]);
  if(changed&&!selected.coverage[i])throw new Error("Reflection tint escaped selection");
  if(changed)changedPixels++;
}
if(!changedPixels)throw new Error("Reflection tint did not change source pixels");
p.undo();if(hash(await renderPanelPNG(p,"panel:06"))!==hash(await renderPanelPNG(before,"panel:06")))throw new Error("Undo did not restore artwork");
if(!Buffer.from(paint.readPixels(reflection.id).pixels).equals(Buffer.from(originalPixels.pixels)))throw new Error("Undo did not restore pixel artwork");
p.redo();if(hash(await renderPanelPNG(p,"panel:06"))!==edited)throw new Error("Redo did not restore revision");
await p.save(file);
const saved=ProjectStore.open(file);
try{
  saved.saveRevision(newRevision,{expectedVersion:p.version});
  if(hash(await renderPanelPNG(saved.readRevision(baseRevision),"panel:06"))!==hash(await renderPanelPNG(before,"panel:06")))throw new Error("Named base revision artwork changed");
}finally{saved.close();}
const reopened=await StoryboardProject.open(file);
if(!Buffer.from(reopened.panel("panel:04").layer(reflection.parentId!).readPixels(reflection.id).pixels).equals(Buffer.from(editedPixels.pixels)))throw new Error("Reopened pixels differ");
if(hash(await renderPanelPNG(reopened,"panel:06"))!==edited)throw new Error("Reopened render differs");
await writeFile(join(root,"revision-after.png"),await renderPanelPNG(reopened,"panel:06"));
await writeFile(join(root,"contact-sheet.revised.png"),await renderContactSheet(reopened));
await writeFile(join(root,"pixel-revision-after.png"),await renderPanelPNG(reopened,"panel:04"));
await writeFile(join(root,"pixel-revision-proof.json"),JSON.stringify({element:reflection.id,changedPixels,alphaPreserved:true,outsideSelectionUnchanged:true,undo:true,reopenBytesMatch:true},null,2));
await writeFile(join(root,"revision-proof.json"),JSON.stringify({file,baseRevision,newRevision,bytesBefore,bytesAfter:(await stat(file)).size,separateProjectCopy:false,unaffectedPanel:"panel:02",unaffectedHash:unaffected,editedElement:hand.id,beforeFrames:before.panels.reduce((n,p)=>n+p.durationFrames,0),afterFrames:after.panels.reduce((n,p)=>n+p.durationFrames,0),undo:true,redo:true,reopenPixelMatch:true,changed:reopened.production.changesSince(version),timing:after.panels.map(p=>({id:p.id,start:p.startFrame,duration:p.durationFrames}))},null,2));
await exportCurrent(reopened);
console.log("Revision proof passed: artwork, framing, timing, isolation, undo/redo and reopen");

async function exportCurrent(project:StoryboardProject){
  const document=project.toJSON(),files=await exportStoryboard(project,root,{columns:2,rows:2});
  await writeFile(join(root,"contact-sheet.png"),await renderContactSheet(project));
  await writeFile(join(root,"hand-detail.png"),await renderDetail(project,"panel:06",{x:280,y:190,width:570,height:340}));
  const closingPanel=document.panels.find(p=>p.id==="panel:14")!;
  await writeFile(join(root,"hero.png"),await renderPanelPNG(project,closingPanel.id,{annotations:false,frame:closingPanel.startFrame+48}));
  const frames=document.panels.reduce((n,p)=>n+p.durationFrames,0);
  await writeFile(join(root,"manifest.json"),JSON.stringify({panels:document.panels.map(p=>p.id),frames,seconds:frames/document.frameRate,version:project.version,files},null,2));
  if(process.argv.includes("--movie")){
    const stats=await exportMovie(project,join(root,"last-light.mp4"),{onProgress:(n,total)=>{if(n%24===0)console.log(`Movie ${n}/${total}`);}});
    await writeFile(join(root,"render-metrics.json"),JSON.stringify({...stats,sourceVersion:project.version,node:process.version,memory:process.memoryUsage()},null,2));
  }
}
