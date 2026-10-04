import {Canvas,type CanvasRenderingContext2D} from "skia-canvas";
import type {SheetOptions,StoryboardDocument} from "../model/types.js";

export interface CaptionLine {text:string;title:boolean}
export interface SheetCell {panelIndex:number;part:number;parts:number;lines:CaptionLine[]}

function wrap(ctx:CanvasRenderingContext2D,text:string,width:number):string[]{
  const lines:string[]=[],graphemes=new Intl.Segmenter(undefined,{granularity:"grapheme"});
  for(const paragraph of text.replace(/\r\n?/g,"\n").split("\n")){
    let line="";
    for(const word of paragraph.trim().split(/\s+/u).filter(Boolean)){
      const candidate=line?`${line} ${word}`:word;
      if(ctx.measureText(candidate).width<=width){line=candidate;continue;}
      if(line){lines.push(line);line="";}
      for(const {segment} of graphemes.segment(word)){
        if(ctx.measureText(segment).width>width)throw new Error("Storyboard caption column is narrower than a glyph");
        if(line&&ctx.measureText(line+segment).width>width){lines.push(line);line="";}
        line+=segment;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function layoutStoryboard(document:Pick<StoryboardDocument,"title"|"panels">,options:SheetOptions={}){
  const {pageWidth=1440,pageHeight=1020,margin=64,gutter=28,columns=2,rows=2,captionHeight=126}=options;
  for(const [name,value] of Object.entries({pageWidth,pageHeight,margin,gutter,columns,rows,captionHeight}))
    if(!Number.isFinite(value)||value<0)throw new Error(`Invalid storyboard sheet ${name}: ${value}`);
  if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<1||rows<1)throw new Error("Storyboard sheet rows and columns must be positive integers");
  if(pageWidth*pageHeight>32*1024*1024)throw new Error("Storyboard sheet exceeds 32 megapixel page budget");
  const ctx=new Canvas(1,1).getContext("2d"),titleWidth=pageWidth-margin*2-180;
  if(titleWidth<=0)throw new Error("Storyboard sheet has no room for its header");
  ctx.font="700 25px sans-serif";
  const titleLines=wrap(ctx,document.title,titleWidth);
  const bodyTop=Math.max(margin,titleLines.length*30+20);
  const cellWidth=(pageWidth-margin*2-gutter*(columns-1))/columns;
  const cellHeight=(pageHeight-bodyTop-margin-gutter*(rows-1))/rows;
  const artHeight=cellHeight-captionHeight,lineCapacity=Math.floor((captionHeight-49)/18);
  if(cellWidth<=0||artHeight<=0||lineCapacity<1)throw new Error("Storyboard sheet needs room for artwork and at least one caption line per cell");
  const cells:SheetCell[]=[];
  document.panels.forEach((panel,panelIndex)=>{
    const lines:CaptionLine[]=[];
    for(const [label,text] of [["Title",panel.title],["Action",panel.action],["Dialogue",panel.dialogue],["Camera",panel.camera],["Notes",panel.notes]]){
      if(!text)continue;
      const title=label==="Title";ctx.font=title?"700 14px sans-serif":"14px sans-serif";
      for(const line of wrap(ctx,title?text:`${label}: ${text}`,cellWidth))lines.push({text:line,title});
    }
    const parts=Math.max(1,Math.ceil(lines.length/lineCapacity));
    for(let part=0;part<parts;part++)cells.push({panelIndex,part:part+1,parts,lines:lines.slice(part*lineCapacity,(part+1)*lineCapacity)});
  });
  const perPage=columns*rows,pages:SheetCell[][]=[];
  for(let start=0;start<cells.length;start+=perPage)pages.push(cells.slice(start,start+perPage));
  if(!pages.length)pages.push([]);
  return {pageWidth,pageHeight,margin,gutter,columns,rows,captionHeight,bodyTop,cellWidth,cellHeight,artHeight,titleLines,pages};
}
