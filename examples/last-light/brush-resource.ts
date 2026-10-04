import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { StoryboardProject, pathCommands, renderPanelPNG, importBrushResource, brushFromResource, brushes, catmullRom, type BrushPreset } from "codeboard-studio";

export async function makeBrushResource(directory:string):Promise<BrushPreset> {
  await mkdir(directory,{recursive:true});
  const tipProject=StoryboardProject.create({title:"Original split feather tip",width:128,height:128,background:"transparent"});
  const panel=tipProject.addScene("Source").addShot("Tip").addPanel();
  tipProject.transaction("draw torn feather",()=>{
    const l=panel.addVectorLayer("Feather silhouette");
    l.path(pathCommands("M 24 110 C 30 90 18 85 21 68 L 34 79 L 27 53 L 41 65 L 32 34 L 50 49 L 47 19 L 62 36 L 71 8 L 78 30 L 101 16 L 91 44 L 116 35 L 99 60 L 118 58 L 94 77 L 108 81 L 81 91 Q 60 95 43 109 L 29 123 Z"),{fill:"#202020"});
    for(let i=0;i<21;i++) {
      const x=32+(i*17%58),y=35+(i*29%62);
      l.path(pathCommands(`M ${x} ${y} Q ${x+3} ${y-4} ${x+5} ${y+1} L ${x+1} ${y+7} Z`),{fill:"#8b8b8b"});
    }
    for(let i=0;i<9;i++)l.path(pathCommands(`M ${34+i*4} ${103-i*7} Q ${58+i*2} ${75-i*5} ${87+i*2} ${41+i*3}`),{stroke:"#dddddd",strokeWidth:1.4});
  });
  await tipProject.save(join(directory,"feather-tip.source.cboard"),{overwrite:true});
  await writeFile(join(directory,"feather-tip.png"),await renderPanelPNG(tipProject,panel.id,{annotations:false}));
  const report=await importBrushResource(join(directory,"feather-tip.png"),{
    origin:{source:"examples/last-light/brush-resource.ts",author:"CodeBoard original example",license:"CC0-1.0",redistribution:"allowed"},
    maskMode:"inverse-luminance",maxTipSize:128,
  });
  await writeFile(join(directory,"import-report.json"),JSON.stringify({...report,resources:report.resources.map(({tip,...resource})=>({...resource,tip:{kind:tip.kind,width:tip.width,height:tip.height,angle:tip.angle,rotationMode:tip.rotationMode}}))},null,2));
  const brush=brushFromResource(report.resources[0]!,{...brushes.cleanInk,id:"brush:feather-dry",name:"Torn feather / imported PNG",size:64,flow:.42,spacing:.24,hardness:1,taperStart:.04,taperEnd:.12,dynamics:{...brushes.cleanInk.dynamics,pressureSize:.9,pressureOpacity:.7,speedSize:0}});
  const swatch=StoryboardProject.create({title:"Imported feather / pressure and curvature",width:1280,height:720,background:"#e8e0cd"});
  const s=swatch.addScene("Brush proof").addShot("Swatches").addPanel();
  swatch.transaction("draw swatch",()=>{
    swatch.production.createBrush(brush);
    const labels=s.addVectorLayer("Labels");
    labels.text("TORN FEATHER",48,60,{font:"32px Georgia",color:"#171c20"});
    labels.text("Original PNG tip  /  explicit luminance mask  /  immutable preset snapshot",48,95,{font:"18px sans-serif",color:"#41494a"});
    const paint=s.addRasterLayer("Imported bitmap painting");
    paint.rasterStroke([{x:112,y:202,pressure:1}],{...brush,size:155,flow:1,taperStart:0,taperEnd:0},{color:"#171c20"});
    paint.rasterStroke(catmullRom([{x:250,y:210,pressure:.1},{x:425,y:160,pressure:.9},{x:620,y:245,pressure:1},{x:865,y:161,pressure:.5},{x:1200,y:220,pressure:.08}],14),{...brush,size:100},{color:"#171c20"});
    for(let i=0;i<3;i++) {
      paint.rasterStroke(catmullRom([{x:65,y:366+i*100,pressure:.12},{x:350,y:324+i*100,pressure:.9},{x:650,y:392+i*100,pressure:.45},{x:940,y:331+i*100,pressure:1},{x:1210,y:377+i*100,pressure:.15}],12),{...brush,size:40+i*20,spacing:[.14,.32,.7][i]!},{color:i===2?"#b07935":"#171c20",seed:5});
    }
    labels.text("single stamp",50,301,{font:"16px sans-serif"});
    labels.text("pressure 0.1 → 1.0 → 0.1   •   three spacing values below",310,296,{font:"16px sans-serif"});
    labels.text("Tip source, imported asset report, preset and swatch project are retained alongside this image.",48,680,{font:"17px sans-serif",color:"#41494a"});
  });
  await swatch.save(join(directory,"swatch.cboard"),{overwrite:true});
  await writeFile(join(directory,"swatch.png"),await renderPanelPNG(swatch,s.id,{annotations:false}));
  return brush;
}
