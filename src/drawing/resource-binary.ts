export interface Sample { name: string; width: number; height: number; alpha: Uint8Array; spacing?: number }

export class Reader {
  offset = 0;
  constructor(readonly data: Buffer) {}
  take(n: number): Buffer {
    if (!Number.isInteger(n) || n < 0 || this.offset+n > this.data.length) throw new Error(`Truncated brush resource at byte ${this.offset} (requested ${n})`);
    const out = this.data.subarray(this.offset,this.offset+n); this.offset += n; return out;
  }
  u8() { return this.take(1).readUInt8(); }
  u16() { return this.take(2).readUInt16BE(); }
  u32() { return this.take(4).readUInt32BE(); }
  i32() { return this.take(4).readInt32BE(); }
}

function dimensions(w:number,h:number) {
  if(w<1||h<1||w>8192||h>8192||w*h>16*1024*1024) throw new Error(`Brush dimensions exceed 16 megapixel decode limit: ${w} x ${h}`);
}

export function readGBR(r:Reader): Sample {
  const start=r.offset, header=r.u32(),version=r.u32(),width=r.u32(),height=r.u32(),channels=r.u32();
  if(version!==1&&version!==2) throw new Error(`GBR version ${version} is unsupported (only 1 and 2)`);
  dimensions(width,height);
  if(channels!==1&&channels!==4) throw new Error(`GBR ${channels}-byte color format unsupported`);
  let spacing=.25;
  if(version===2) { if(r.take(4).toString()!=="GIMP") throw new Error("Invalid GBR magic"); spacing=r.u32()/100; }
  const name=r.take(header-(r.offset-start)).toString("utf8").replace(/\0+$/,"");
  const pixels=r.take(width*height*channels);
  const alpha=channels===1?new Uint8Array(pixels):Uint8Array.from({length:width*height},(_,i)=>pixels[i*4+3]!);
  return {name,width,height,alpha,spacing};
}

function sampled(r:Reader,name:string):Sample {
  const top=r.i32(),left=r.i32(),bottom=r.i32(),right=r.i32();
  const width=right-left,height=bottom-top; dimensions(width,height);
  const depth=r.u16(),compression=r.u8();
  if(depth!==8) throw new Error(`ABR ${depth}-bit samples are unsupported`);
  let alpha:Uint8Array;
  if(compression===0) alpha=new Uint8Array(r.take(width*height));
  else if(compression===1) {
    const lengths=Array.from({length:height},()=>r.u16()); alpha=new Uint8Array(width*height);
    for(let row=0;row<height;row++) {
      const scan=new Reader(r.take(lengths[row]!)); let column=0;
      while(scan.offset<scan.data.length) {
        const code=scan.u8();
        if(code===128) continue;
        const count=code<128?code+1:257-code;
        if(column+count>width) throw new Error("ABR RLE row overflow");
        if(code<128) alpha.set(scan.take(count),row*width+column);
        else alpha.fill(scan.u8(),row*width+column,row*width+column+count);
        column+=count;
      }
      if(column!==width) throw new Error("ABR RLE row is incomplete");
    }
  } else throw new Error(`ABR compression ${compression} is unsupported`);
  return {name,width,height,alpha};
}

export function readABR(data:Buffer):{samples:Sample[];unsupported:string[]} {
  const r=new Reader(data),version=r.u16(),second=r.u16(),samples:Sample[]=[],unsupported:string[]=[];
  if(version===1||version===2) {
    if(second>4096) throw new Error("ABR sample count exceeds 4096");
    for(let i=0;i<second;i++) {
      const type=r.u16(),record=new Reader(r.take(r.u32()));
      if(type!==2) {unsupported.push(`ABR entry ${i}: computed/unknown brush type ${type}`);continue;}
      try {
        record.take(4); const spacing=record.u16()/100; let name=`Sample ${i+1}`;
        if(version===2) { const length=record.u32();const text=Buffer.from(record.take(length*2)); name=text.swap16().toString("utf16le").replace(/\0+$/,""); }
        record.take(9);
        samples.push({...sampled(record,name),spacing});
      } catch(e) {unsupported.push(`ABR entry ${i}: ${(e as Error).message}`);}
    }
  } else if(version===6&&(second===1||second===2)) {
    while(r.offset<data.length) {
      if(r.take(4).toString()!=="8BIM") throw new Error("Invalid ABR section signature");
      const kind=r.take(4).toString(),section=new Reader(r.take(r.u32()));
      if(kind!=="samp") {unsupported.push(`ABR ${kind} section not mapped to stroke behavior`);continue;}
      while(section.offset<section.data.length) {
        const size=section.u32(),record=new Reader(section.take(size));section.take((4-size%4)%4);
        try {record.take(37+(second===1?10:264));samples.push(sampled(record,`Sample ${samples.length+1}`));}
        catch(e){unsupported.push(`ABR sample: ${(e as Error).message}`);}
        if(samples.length>4096) throw new Error("ABR sample limit exceeded");
      }
    }
  } else unsupported.push(`ABR version ${version}.${second} is unsupported; supported sampled formats: 1, 2, 6.1, 6.2`);
  unsupported.push("Photoshop brush dynamics, dual brush, wet mixing and texture behavior are not emulated");
  return {samples,unsupported};
}
