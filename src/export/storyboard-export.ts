import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Canvas } from "skia-canvas";
import type { SheetOptions } from "../model/types.js";
import { StoryboardProject } from "../core/project.js";
import { renderPanelCanvas, type RenderSource } from "../render/panel-renderer.js";
import {layoutStoryboard} from "./sheet-layout.js";

export async function exportStoryboard(source: RenderSource, outputDir: string, sheet: SheetOptions = {}): Promise<{ panelFiles: string[]; pdfFile: string; pageCount:number }> {
  const document=source instanceof StoryboardProject?source.toJSON():structuredClone(source);
  const layout=layoutStoryboard(document,sheet);
  const {pageWidth,pageHeight,margin,gutter,columns,bodyTop,cellWidth,cellHeight,artHeight,pages,titleLines}=layout;
  const panelsDir=join(outputDir,"panels");await mkdir(panelsDir,{recursive:true});
  const panelImages:Canvas[]=[];
  const panelFiles:string[]=[];
  const pdf=new Canvas(pageWidth,pageHeight);
  try{
  for(let i=0;i<document.panels.length;i++){
    const file=join(panelsDir,`${String(i+1).padStart(3,"0")}-${document.panels[i]!.id.replace(/[^a-z0-9_-]/gi,"-")}.png`);
    const panel=document.panels[i]!;
    const artwork=renderPanelCanvas(document,panel.id,{frame:panel.startFrame+Math.floor(panel.durationFrames*.6)});
    const image=new Canvas(panel.width,panel.height);
    panelImages.push(image);
    try{
      image.getContext("2d").drawImage(artwork,0,0);
      await writeFile(file,await artwork.toBuffer("png"));panelFiles.push(file);
    }finally{artwork.getContext("2d").reset();}
  }
  for(const [pageIndex,cells] of pages.entries()){
    const ctx=pageIndex===0?pdf.getContext("2d"):pdf.newPage(pageWidth,pageHeight);
    ctx.fillStyle="#f4f0e7";ctx.fillRect(0,0,pageWidth,pageHeight);
    ctx.fillStyle="#1e1d1a";ctx.font="700 25px sans-serif";
    titleLines.forEach((line,i)=>ctx.fillText(line,margin,30+i*30));
    ctx.font="15px sans-serif";ctx.textAlign="right";
    ctx.fillText(`Page ${pageIndex+1} / ${pages.length}`,pageWidth-margin,30);ctx.textAlign="left";
    for(const [slot,cell] of cells.entries()){
      const panel=document.panels[cell.panelIndex]!;
      const x=margin+(slot%columns)*(cellWidth+gutter),y=bodyTop+Math.floor(slot/columns)*(cellHeight+gutter);
      const scale=Math.min(cellWidth/panel.width,artHeight/panel.height),width=panel.width*scale,height=panel.height*scale;
      ctx.fillStyle="#ffffff";ctx.fillRect(x,y,cellWidth,artHeight);
      ctx.drawImage(panelImages[cell.panelIndex]!,x+(cellWidth-width)/2,y+(artHeight-height)/2,width,height);
      ctx.strokeStyle="#292722";ctx.lineWidth=2;ctx.strokeRect(x,y,cellWidth,artHeight);
      ctx.fillStyle="#292722";ctx.font="700 16px sans-serif";
      ctx.fillText(`${panel.number} · ${panel.durationFrames}f${cell.parts>1?` · text ${cell.part}/${cell.parts}`:""}`,x,y+artHeight+22);
      cell.lines.forEach((line,i)=>{
        ctx.font=line.title?"700 14px sans-serif":"14px sans-serif";
        ctx.fillText(line.text,x,y+artHeight+43+i*18);
      });
      ctx.fillStyle="#5a554b";ctx.font="12px sans-serif";
      ctx.fillText(`rev ${panel.revision} · start ${panel.startFrame}f`,x,y+cellHeight-8);
    }
  }
  const pdfFile=join(outputDir,"storyboard.pdf");
  await writeFile(pdfFile,await pdf.toBuffer("pdf"));
  return {panelFiles,pdfFile,pageCount:pages.length};
  }finally{for(const page of pdf.pages)page.reset();for(const image of panelImages)image.getContext("2d").reset();}
}
