import {walkingPerformance} from "./last-light/walk.ts";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { StoryboardProject, exportStoryboard, exportMovie, renderPanelPNG, renderContactSheet, catmullRom, createPixels } from "codeboard-studio";
import { city, keeper, hands, supportingHand, insect, rain, contour, stroke, ink, paper, amber, reed, dry } from "./last-light/art.ts";
import { makeBrushResource } from "./last-light/brush-resource.ts";
import { sound } from "./last-light/sound.ts";
import { payoff } from "./last-light/payoff.ts";
import { opening } from "./last-light/opening.ts";
import { flight } from "./last-light/flight.ts";
import {flightWingCycle} from './last-light/wings.ts';
import { relay } from "./last-light/relay.ts";
import { closeupPerformance, placeLantern, extinguishLantern } from "./last-light/acting.ts";

const output=resolve("examples/output/last-light");
await mkdir(output,{recursive:true});
const imported=await makeBrushResource(join(output,"brushes"));
const board=StoryboardProject.create({id:"project:last-light",title:"THE LAST LIGHT / PENJAGA CAHAYA",width:1280,height:720,background:paper,frameRate:24,seed:42});
const scene=board.addScene("The city without power","scene:city");
const specifications:[string,string,number,string][]=[
  ["A single light","A keeper crosses the drowned city. One lantern remains.",72,"Extreme wide / slow approach"],
  ["Against the rain","He leans into the wind, shielding the last flame.",48,"Medium profile / tracking"],
  ["Something in the water","A broken mechanical firefly catches beneath his boot.",36,"Ground insert / rack of attention"],
  ["A sheltering hand","He sets down the lantern and releases its handle. His other hand slides beneath the machine, pauses, then lifts it from the water.",48,"Low insert / placement, contact, lift"],
  ["A fragile machine","Bent brass wings lie across his open palm. The left edge is chipped.",48,"Macro / damaged wing and exposed escapement"],
  ["Repair","A fine tool reconnects the tiny escapement.",72,"Extreme close-up / hands"],
  ["The price","He looks from the mechanism to his last light.",36,"Close profile / hold"],
  ["First spark","Amber travels into the etched wings.",36,"Insert / tiny ignition"],
  ["The lantern dies","The keeper gives the last flame. Darkness returns.",48,"Lantern close-up"],
  ["Wait","Nothing happens. He waits, refusing to close his hand.",48,"Close-up / stillness"],
  ["It lives","The wings unfold. The little machine lifts from his palm.",48,"Hand close-up / lift"],
  ["Flight","The firefly climbs between the wet facades.",48,"Low angle / climb between roof planes"],
  ["A city remembers","The firefly touches a street lamp. Its light answers, then the windows follow.",60,"Close-up / lamp relay and cascading windows"],
  ["Light carried onward","The keeper watches a thousand reflections take his place.",72,"Extreme wide / settle"],
];
let frame=0;
let fireflyComponent="";
const ids:string[]=[];
for(let i=0;i<specifications.length;i++) {
  const [title,action,duration,camera]=specifications[i]!;
  board.transaction(`Author panel ${i+1}: ${title}`,()=>{
    const shot=scene.addShot(title,`shot:${i+1}`);
    const p=shot.addPanel({id:`panel:${String(i+1).padStart(2,"0")}`,number:String(i+1).padStart(2,"0"),title,action,durationFrames:duration,camera});ids.push(p.id);
    if(i===0)opening(p,board,frame,duration);
    if(i===1) {
      city(p);
      walkingPerformance(p,board,frame,duration,230,36,1.08);
    }
    if(i===2) {
      const l=p.addVectorLayer("Puddle / fallen machine");
      contour(l,"M -80 -80 L 1360 -80 L 1360 800 L -80 800 Z","#303e40");
      // Broad paving courses converge upward; broken edges interrupt the flooded surface.
      for(const [y,depth] of [[28,55],[91,75],[179,98],[292,131],[442,174],[640,226]]){
        contour(l,`M -80 ${y} Q 530 ${y!-31} 1360 ${y!+22} L 1360 ${y!+depth!-9} Q 600 ${y!+depth!-44} -80 ${y!+depth!} Z`,"#414e4e",ink,1.2);
        stroke(l,[[-40,y!+depth!-7],[292,y!+depth!-23],[580,y!+depth!-29],[854,y!+depth!-17],[1300,y!+depth!+5]],1.3,"#64716a");
        const width=160+y!*.3;
        for(let x=-130+(y!%3)*51;x<1340;x+=width){
          const lean=(x-790)*.09;
          stroke(l,[[x,y!+4],[x+lean*.4,y!+depth!*.47],[x+lean,y!+depth!-13]],2,ink);
        }
      }
      contour(l,"M 593 328 C 732 294 893 326 1026 303 Q 1183 290 1330 361 L 1330 693 C 1199 639 1107 678 966 637 Q 805 597 632 620 C 524 605 544 526 682 502 Q 781 465 659 436 C 562 408 517 363 593 328 Z","#26383b","#26383b");
      stroke(l,[[592,330],[740,321],[885,333],[1026,310],[1180,318]],1.4,"#64776f");
      stroke(l,[[667,616],[801,603],[965,642],[1092,658]],1.7,"#526860");
      const reflection=p.addVectorLayer("Puddle / lantern reflection",{opacity:.65});
      for(let j=0;j<18;j++){
        const yy=429+j*15,xx=475+Math.sin(j*.8)*8,half=14+j*2.2;
        stroke(reflection,[[xx-half,yy],[xx-4,yy-1]],2+j%3,j%5===0?paper:amber);
        if(j%3!==0)stroke(reflection,[[xx+5,yy+1],[xx+half,yy-2]],1.6,amber);
      }
      keeper(p,-64,-696,2.2);insect(p,864,480,.65,false,false);
      for(let j=0;j<4;j++)stroke(l,[[808-j*27,505+j*13],[866,510+j*13],[923+j*29,503+j*14]],1.2,j===0?"#abb5a0":"#607b73");
    }
    if(i===3) {
      const ground=p.addVectorLayer("Pickup / flooded paving");
      contour(ground,"M 0 0 L 1280 0 L 1280 720 L 0 720 Z","#414e4e");
      contour(ground,"M 0 330 C 253 307 455 361 672 317 Q 997 279 1280 306 L 1280 550 Q 1014 529 846 582 C 524 634 272 529 0 620 Z","#26383b","#26383b");
      for(const y of [105,253,398,612])stroke(ground,[[0,y],[395,y-23],[889,y+36],[1280,y+20]],3,ink);
      for(const [x,y]of [[130,105],[696,253],[374,398],[1030,612]])stroke(ground,[[x!,y!],[x!+48,y!+138]],2,ink);
      for(let j=0;j<9;j++)stroke(ground,[[638-j*17,540+j*8],[776,546+j*8],[889+j*12,538+j*9]],1.2,"#abb2a2");
      const contact=p.addVectorLayer("Lantern / pavement contact");
      contour(contact,"M 1009 682 Q 1089 664 1175 683 Q 1209 697 1128 703 Q 1026 706 1009 696 Z",ink,ink,1);
      const reflected=createPixels(240,56);
      for(let y=0;y<reflected.height;y++)for(let x=0;x<reflected.width;x++){
        const u=(x-120)/120,v=(y-16)/40;
        const envelope=Math.max(0,1-u*u-v*v);
        const ripple=Math.pow(Math.max(0,Math.cos(y*.67+x*.008)),8);
        reflected.pixels.set([237,182,93,Math.round(95*envelope*ripple)],(y*reflected.width+x)*4);
      }
      const reflection=p.addRasterLayer("Lantern / painted pixel reflections");
      reflection.rasterSurface(reflected,{matrix:[1,0,0,1,970,684],name:"amber-reflection-surface"});
      placeLantern(p,board,frame);
      for(const [layer,initial]of [[contact,.12],[reflection,.35]] as const){
        board.production.addLayerKeyframe(layer.id,frame,{opacity:initial,easing:"ease-in-out"});
        board.production.addLayerKeyframe(layer.id,frame+12,{opacity:1});
      }
      const shadow=p.addVectorLayer("Machine / contact shadow",{opacity:.65});
      contour(shadow,"M 738 535 Q 780 526 820 536 Q 800 545 752 543 Z",ink,ink,1);
      const scale=.85,rotation=-.18;
      const x=780-scale*(609*Math.cos(rotation)-340*Math.sin(rotation));
      const y=490-scale*(609*Math.sin(rotation)+340*Math.cos(rotation));
      const hand=supportingHand(p);
      hand.set({transform:{x,y,scaleX:scale,scaleY:scale,rotation}});
      const resting=insect(p,780,490,.84*scale,false,false);
      resting.group.set({transform:{x:780,y:490,scaleX:.84*scale,scaleY:.84*scale,rotation}});
      board.production.setExposure(resting.group.id,{startFrame:frame,endFrame:frame+20});
      const carried=insect(p,609,340,.84,false,false,hand.id);
      board.production.setExposure(carried.group.id,{startFrame:frame+20,endFrame:frame+duration});
      for(const [offset,dx,dy,angle] of [[0,-165,115,rotation],[12,-38,28,rotation],[20,0,0,rotation],[26,0,0,rotation],[40,-70,-160,-.04],[47,-78,-164,-.04]])
        board.production.addLayerKeyframe(hand.id,frame+offset!,{transform:{x:x+dx!,y:y+dy!,rotation:angle!},easing:"ease-in-out"});
      board.production.addLayerKeyframe(shadow.id,frame,{opacity:.65,easing:"hold"});
      board.production.addLayerKeyframe(shadow.id,frame+26,{opacity:.65,easing:"ease-in-out"});
      board.production.addLayerKeyframe(shadow.id,frame+40,{opacity:0});
    }
    if(i===4)hands(p,"find");
    if(i===5){
      const {repairHand,repairGear}=hands(p,"repair");
      for(const [offset,x,y,rotation] of [[0,26,-14,-.065],[18,0,0,-.065],[25,0,0,-.065],[39,0,0,.045],[47,0,0,.045],[56,10,-6,.025],[71,32,-22,0]])
        board.production.addLayerKeyframe(repairHand!.id,frame+offset!,{transform:{x:609+x!,y:344.2+y!,rotation:rotation!},easing:"ease-in-out"});
      for(const [offset,rotation] of [[0,0],[25,0],[39,.8],[71,.8]])
        board.production.addLayerKeyframe(repairGear!.id,frame+offset!,{transform:{rotation:rotation!},easing:"ease-in-out"});
    }
    if(i===6||i===9) {
      const l=p.addVectorLayer("Close-up background");contour(l,"M 0 0 L 1280 0 L 1280 720 L 0 720 Z",i===9?"#10191d":"#35464a");
      closeupPerformance(p,board,frame,duration,i===9);
      if(i===9){const veil=p.addVectorLayer("Afterlight",{opacity:.40});contour(veil,"M 0 0 L 1280 0 L 1280 720 L 0 720 Z","#111c22");}
    }
    if(i===7){
      const {transfer,dormant,ignition,sparks}=hands(p,"spark",frame);
      for(const [offset,opacity] of [[0,0],[8,1],[23,1],[35,0]])
        board.production.addLayerKeyframe(transfer!.id,frame+offset!,{opacity:opacity!,easing:"ease-in-out"});
      board.production.addLayerKeyframe(ignition!.id,frame,{opacity:0,easing:"hold"});
      board.production.addLayerKeyframe(ignition!.id,frame+8,{opacity:1,easing:"hold"});
      for(const [offset,scale,opacity]of [[0,.2,0],[7,.2,0],[8,.2,1],[12,.65,.9],[18,1,.35],[24,1.3,0]])
        board.production.addLayerKeyframe(sparks!.id,frame+offset!,{transform:{x:609*(1-scale!),y:339*(1-scale!),scaleX:scale!,scaleY:scale!},opacity:opacity!,easing:offset===7?"hold":"linear"});
      board.production.addLayerKeyframe(dormant!.id,frame,{opacity:1,easing:"hold"});
      board.production.addLayerKeyframe(dormant!.id,frame+8,{opacity:0,easing:"hold"});
    }
    if(i===8)extinguishLantern(p,board,frame);
    if(i===10) {
      hands(p,"lift");const bug=insect(p,609,340,.85,true,true);
      board.production.addLayerKeyframe(bug.group.id,frame,{transform:{x:609,y:340}});
      board.production.addLayerKeyframe(bug.group.id,frame+9,{transform:{x:608,y:347},easing:"ease-in-out"});
      board.production.addLayerKeyframe(bug.group.id,frame+22,{transform:{x:659,y:283},easing:"ease-in-out"});
      board.production.addLayerKeyframe(bug.group.id,frame+duration-1,{transform:{x:783,y:125},easing:"ease-in-out"});
      fireflyComponent=board.production.captureComponent(bug.group.id,"Mechanical firefly / open wings",{id:"component:firefly"});
      flightWingCycle(p,board,bug.group.id,bug.wings.id,frame,duration);
    }
    if(i===11)flight(p,board,frame,duration);
    if(i===12) {
      relay(p,board,frame);
    }
    if(i===13) {
      const {firefly}=payoff(p,board,frame);
      const finalFly=board.production.instantiateComponent(fireflyComponent,p.id,{...firefly,scaleX:.28,scaleY:.28},{id:"instance:final-firefly"});
      const wings=board.production.find({panelId:p.id,name:"Etched brass wings"})[0]!;
      for(let f=0;f<duration;f+=3)
        board.production.addLayerKeyframe(wings.id,frame+f,{transform:{scaleY:f%6===0?1:.16},easing:"hold"});
      for(const [offset,dx,dy] of [[0,0,0],[18,4,-3],[36,11,-5],[54,8,-2],[71,14,-4]])
        board.production.addLayerKeyframe(finalFly,frame+offset!,{transform:{x:firefly.x+dx!,y:firefly.y+dy!},easing:"ease-in-out"});
      const head=board.production.find({panelId:p.id,name:"Keeper / head and gaze"})[0]!;
      for(const [offset,angle] of [[0,0],[12,0],[18,-.045],[24,-.13],[30,-.18],[71,-.18]])
        board.production.addLayerKeyframe(head.id,frame+offset!,{transform:{rotation:angle!},easing:"ease-in-out"});
    }
    if(![4,5,7,8,10].includes(i))rain(p,board,frame,duration,i===9?22:70);
    if([0,1,3,13].includes(i)){
      const accents=p.addRasterLayer("Imported feather / worn pavement");
      if(i===13)for(const [offset,opacity]of [[0,0],[28,0],[38,1]])board.production.addLayerKeyframe(accents.id,frame+offset!,{opacity:opacity!,easing:"linear"});
      for(let j=0;j<5;j++)accents.rasterStroke(catmullRom([{x:850+j*35,y:585+j*21,pressure:.1},{x:920+j*35,y:578+j*21,pressure:.5},{x:1130+j*12,y:593+j*21,pressure:.1}],7),{...imported,size:18,flow:.18},{color:i===13?amber:paper,seed:12+j});
    }
    board.production.addCameraKeyframe(shot.id,frame,{x:i===4?-31:0,y:i===4?-20:0,zoom:i===4?3:1,rotation:0,easing:"ease-in-out"});
    board.production.addCameraKeyframe(shot.id,frame+duration-1,{x:i===4?-31:i===11?20:i===1?90:0,y:i===4?-20:0,zoom:i===4?3.08:[0,5,6,7].includes(i)?1.045:1,rotation:0,easing:"linear"});
  });
  frame+=duration;
  console.log(`Authored ${i+1}/14`);
}
board.transaction("Register authored brushes and credits",()=>{
  for(const b of [reed,dry,imported])board.production.createBrush(b);
  board.setMetadata("artwork","Original code-authored contours, hatching and bitmap painting. No generated or stock illustration.");
  board.setMetadata("sound","Original synthesized rain, mechanism, first-spark transient and harmonic light; examples/last-light/sound.ts. CC0-1.0.");
});
await mkdir(join(output,"audio"),{recursive:true});
const soundPanels=board.toJSON().panels;
const panelStart=(id:string)=>soundPanels.find(panel=>panel.id===id)!.startFrame;
for(const [kind,seconds,start,duration,volume] of [["rain",34,0,frame,.9],["mechanism",3,panelStart("panel:06")+25,20,.8],["ignition",.75,panelStart("panel:08")+8,18,.55],["light",9.5,panelStart("panel:11"),228,1]] as const) {
  const bytes=sound(kind,seconds),path=`audio/${kind}.wav`;await writeFile(join(output,path),bytes);
  board.transaction(`Place ${kind}`,()=>{
    const asset=board.production.addAsset({id:`asset:${kind}`,name:kind,kind:"audio",path,mimeType:"audio/wav",source:"managed",checksum:createHash("sha256").update(bytes).digest("hex")});
    const track=board.production.addAudioTrack(kind);
    board.production.addAudioClip(track,{assetId:asset,name:kind,startFrame:start,sourceInFrame:0,durationFrames:duration,volume,fadeInFrames:kind==="rain"?24:kind==="ignition"?0:4,fadeOutFrames:kind==="mechanism"?4:kind==="ignition"?3:24});
    if(kind==="mechanism"){
      const relayPanel=board.toJSON().panels.find(p=>p.id===ids[12])!;
      board.production.addAudioClip(track,{assetId:asset,name:"Lamp relay contact",startFrame:relayPanel.startFrame+17,sourceInFrame:9,durationFrames:4,volume:.65,fadeInFrames:0,fadeOutFrames:2});
    }
  });
}
await board.save(join(output,"last-light.cboard"),{overwrite:true});
console.log("Rendering storyboard");
const exported=await exportStoryboard(board,output,{columns:2,rows:2});
const closingPanel=board.toJSON().panels.find(p=>p.id===ids[13])!;
await writeFile(join(output,"hero.png"),await renderPanelPNG(board,closingPanel.id,{annotations:false,frame:closingPanel.startFrame+48}));
await writeFile(join(output,"contact-sheet.png"),await renderContactSheet(board));
await writeFile(join(output,"manifest.json"),JSON.stringify({panels:ids,frames:frame,seconds:frame/24,files:exported},null,2));
if(process.argv.includes("--movie")){
  const stats=await exportMovie(board,join(output,"last-light.mp4"),{assetRoot:output,onProgress:(n,total)=>{if(n%24===0)console.log(`Movie ${n}/${total}`);}});
  await writeFile(join(output,"render-metrics.json"),JSON.stringify({...stats,node:process.version,memory:process.memoryUsage()},null,2));
}
console.log(`Complete: ${output}`);
