import {isDrawingColor} from "../drawing/color.js";
import { Canvas } from "skia-canvas";
import { StoryboardProject } from "../core/project.js";
import { createRenderSession, renderPanelCanvas, renderFrameCanvas, type RenderSource } from "./panel-renderer.js";
import {assertRenderFrame} from "../animation/frame.js";
import {encodePNG} from "./png.js";

export interface CompositionGuides {
  frame?:number;
  thirds?:boolean;
  /** Fraction of frame width/height inset on each edge; not a broadcast standard. */
  safeInset?:number;
  /** Output-frame pixel coordinates, after camera placement. */
  horizonY?:number;
  vanishingPoints?:readonly {x:number;y:number}[];
}

export async function renderCompositionGuides(source:RenderSource,panelId:string,options:CompositionGuides={}):Promise<Buffer>{
  if(options.thirds!==undefined&&typeof options.thirds!=="boolean")throw new Error("Guide thirds must be boolean");
  if(options.frame!==undefined)assertRenderFrame(options.frame);
  if(options.safeInset!==undefined&&(!Number.isFinite(options.safeInset)||options.safeInset<0||options.safeInset>=.5))throw new Error("Guide safeInset must be within 0 inclusive and 0.5 exclusive");
  if(options.horizonY!==undefined&&!Number.isFinite(options.horizonY))throw new Error("Guide horizonY must be finite");
  if(options.vanishingPoints?.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)))throw new Error("Guide vanishing points must have finite coordinates");
  const canvas=renderPanelCanvas(source,panelId,{annotations:false,...(options.frame===undefined?{}:{frame:options.frame})});
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  ctx.beginPath();
  const line=(x0:number,y0:number,x1:number,y1:number)=>{ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);};
  if(options.thirds??true)for(const part of [1/3,2/3]){line(w*part,0,w*part,h);line(0,h*part,w,h*part);}
  if(options.safeInset!==undefined){const inset=options.safeInset;ctx.rect(w*inset,h*inset,w*(1-2*inset),h*(1-2*inset));}
  if(options.horizonY!==undefined)line(0,options.horizonY,w,options.horizonY);
  for(const point of options.vanishingPoints??[]){
    for(const [x,y]of [[0,0],[w,0],[w,h],[0,h]])line(point.x,point.y,x!,y!);
    ctx.moveTo(point.x+5,point.y);ctx.arc(point.x,point.y,5,0,Math.PI*2);
  }
  ctx.strokeStyle="#10191d";ctx.lineWidth=3;ctx.stroke();
  ctx.strokeStyle="#50e3ff";ctx.lineWidth=1;ctx.stroke();
  return encodePNG(canvas);
}

export async function renderContactSheet(source:RenderSource,options:{columns?:number;thumbnailWidth?:number;panelIds?:readonly string[]}={}):Promise<Buffer> {
  const doc=source instanceof StoryboardProject?source.toJSON():source;
  const columns=options.columns??3,width=options.thumbnailWidth??400;
  if(!Number.isInteger(columns)||columns<1||columns>12||!Number.isInteger(width)||width<80||width>1920)throw new Error("Contact sheet columns must be 1..12; thumbnail width 80..1920");
  const byId=new Map(doc.panels.map(panel=>[panel.id,panel]));
  if(options.panelIds!==undefined&&(!Array.isArray(options.panelIds)||!options.panelIds.length||new Set(options.panelIds).size!==options.panelIds.length))throw new Error("Contact sheet panelIds must be a nonempty list of unique panel IDs");
  const ids=options.panelIds??doc.scenes.flatMap(scene=>scene.shotIds.flatMap(id=>doc.shots.find(shot=>shot.id===id)!.panelIds));
  const panels=ids.map(id=>{const panel=byId.get(id);if(!panel)throw new Error(`Panel not found: ${id}`);return panel;});
  const height=Math.round(width*doc.canvas.height/doc.canvas.width),rows=Math.ceil(panels.length/columns),gap=16;
  const canvasWidth=columns*(width+gap)+gap,canvasHeight=Math.max(1,rows)*(height+55)+gap;
  if(canvasWidth*canvasHeight>32*1024*1024)throw new Error("Contact sheet exceeds 32 megapixels; reduce thumbnail size or select fewer panels");
  const canvas=new Canvas(canvasWidth,canvasHeight);
  const ctx=canvas.getContext("2d"),session=createRenderSession(doc);ctx.fillStyle="#e8e0cd";ctx.fillRect(0,0,canvas.width,canvas.height);
  panels.forEach((p,i)=>{
    const x=gap+(i%columns)*(width+gap),y=gap+Math.floor(i/columns)*(height+55);
    const panel=session.panel(p.id,p.startFrame+Math.floor(p.durationFrames*.6));
    try{ctx.drawImage(panel,x,y,width,height);}finally{panel.getContext("2d").reset();}
    ctx.fillStyle="#171c20";ctx.font="14px sans-serif";
    ctx.fillText(`${p.number}  ${p.title}`,x,y+height+20,width);
    ctx.font="12px sans-serif";ctx.fillText(`${p.startFrame}f / ${p.durationFrames}f`,x,y+height+37,width);
  });
  return encodePNG(canvas);
}

export async function renderDetail(source:RenderSource,panelId:string,crop:{x:number;y:number;width:number;height:number},frame?:number):Promise<Buffer>{
  if(Object.values(crop).some(v=>!Number.isFinite(v))||crop.width<1||crop.height<1||crop.width*crop.height>16*1024*1024)throw new Error("Invalid detail crop");
  const art=renderPanelCanvas(source,panelId,{annotations:false,...(frame===undefined?{}:{frame})});
  try{
    const canvas=new Canvas(crop.width,crop.height),ctx=canvas.getContext("2d");
    try{
      ctx.drawImage(art,-crop.x,-crop.y);
      art.getContext("2d").reset();
      return await canvas.toBuffer("png");
    }finally{ctx.reset();}
  }finally{art.getContext("2d").reset();}
}

export interface OnionSkinSample {panelId:string;frame?:number;layerIds?:readonly string[];tint?:string;opacity?:number}

export async function renderOnionSkin(source:RenderSource,samples:readonly OnionSkinSample[],options:{opacity?:number;camera?:boolean}={}):Promise<Buffer>{
  const opacity=options.opacity??.3;
  if(!samples.length||samples.length>8||!Number.isFinite(opacity)||opacity<0||opacity>1)throw new Error("Onion skin requires 1..8 samples and opacity 0..1");
  for(const sample of samples){
    if(sample.frame!==undefined)assertRenderFrame(sample.frame);
    if(sample.tint!==undefined&&!isDrawingColor(sample.tint))throw new Error("Invalid onion skin tint");
    if(sample.opacity!==undefined&&(!Number.isFinite(sample.opacity)||sample.opacity<0||sample.opacity>1))throw new Error("Onion skin sample opacity must be between 0 and 1");
  }
  const doc=source instanceof StoryboardProject?source._readRenderPanels(samples.map(sample=>sample.panelId)):source;
  const panels=samples.map(sample=>{
    const panel=doc.panels.find(panel=>panel.id===sample.panelId);
    if(!panel)throw new Error(`Panel not found: ${sample.panelId}`);
    return panel;
  });
  const first=panels[0]!;
  if(panels.some(panel=>panel.width!==first.width||panel.height!==first.height))throw new Error("Onion skin panels must have matching dimensions");
  const canvas=new Canvas(first.width,first.height),ctx=canvas.getContext("2d");
  const transparent={...doc,canvas:{...doc.canvas,background:"transparent"}};
  try{
   for(const [i,sample]of samples.entries()){
    ctx.globalAlpha=sample.opacity??(i===0?1:opacity);
    const isolated=sample.tint!==undefined||sample.layerIds!==undefined;
    const art=renderPanelCanvas(i===0&&!isolated?doc:transparent,sample.panelId,{annotations:false,camera:options.camera??false,...(sample.frame===undefined?{}:{frame:sample.frame}),...(sample.layerIds?{layerIds:sample.layerIds}:{})});
    try{
      if(sample.tint!==undefined){const tint=art.getContext("2d");tint.globalCompositeOperation="source-in";tint.fillStyle=sample.tint;tint.fillRect(0,0,art.width,art.height);}
      ctx.drawImage(art,0,0);
    }finally{art.getContext("2d").reset();}
   }
   return await canvas.toBuffer("png");
  }finally{ctx.reset();}
}

/** Timeline samples in caller order, including drawing substitutions and shot transitions. */
export async function renderFrameSheet(source:RenderSource,frames:readonly number[],options:{columns?:number;thumbnailWidth?:number}={}):Promise<Buffer>{
  const columns=options.columns??4,width=options.thumbnailWidth??320,gap=16,caption=28;
  if(!Array.isArray(frames)||!frames.length)throw new Error("Frame sheet requires a nonempty frame list");
  for(const frame of frames)assertRenderFrame(frame);
  if(!Number.isInteger(columns)||columns<1||columns>12||!Number.isInteger(width)||width<80||width>1920)throw new Error("Frame sheet columns must be 1..12; thumbnail width 80..1920");
  const first=renderFrameCanvas(source,frames[0]!);
  try{
    const height=Math.round(width*first.height/first.width),rows=Math.ceil(frames.length/columns);
    const canvasWidth=columns*(width+gap)+gap,canvasHeight=rows*(height+caption+gap)+gap;
    if(canvasWidth*canvasHeight>32*1024*1024)throw new Error("Frame sheet exceeds 32 megapixels; reduce thumbnail size or select fewer frames");
    const canvas=new Canvas(canvasWidth,canvasHeight),ctx=canvas.getContext("2d");
    try{
      ctx.fillStyle="#e8e0cd";ctx.fillRect(0,0,canvas.width,canvas.height);
      for(const [index,frame] of frames.entries()){
        const art=index===0?first:renderFrameCanvas(source,frame);
        try{
          const x=gap+(index%columns)*(width+gap),y=gap+Math.floor(index/columns)*(height+caption+gap);
          ctx.drawImage(art,x,y,width,height);
          ctx.fillStyle="#171c20";ctx.font="14px sans-serif";ctx.fillText(`${frame}f`,x,y+height+20,width);
        }finally{art.getContext("2d").reset();}
      }
      return await canvas.toBuffer("png");
    }finally{ctx.reset();}
  }finally{first.getContext("2d").reset();}
}
