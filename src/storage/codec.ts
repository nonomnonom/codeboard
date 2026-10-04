import { createHash } from "node:crypto";
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import type { DatabaseSync } from "node:sqlite";

export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Payload references are internal tagged tuples; user objects are always escaped. */
export class PayloadCodec {
  private select: ReturnType<DatabaseSync["prepare"]>;
  private exists: ReturnType<DatabaseSync["prepare"]>;
  private reading=0;
  private decoded=new Map<string,unknown>();
  private raw=new Map<string,Buffer>();
  constructor(private db: DatabaseSync) {
    this.select=db.prepare("SELECT kind,codec,raw_size,data FROM payloads WHERE hash=?");
    this.exists=db.prepare("SELECT 1 FROM payloads WHERE hash=?");
  }

  put(kind: string, bytes: Buffer): string {
    const hash = digest(Buffer.concat([Buffer.from(`${kind}\0`), bytes]));
    if (!this.exists.get(hash)) {
      const compressed = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } });
      const codec = compressed.length < bytes.length ? "br" : "raw";
      this.db.prepare("INSERT INTO payloads VALUES(?,?,?,?,?)").run(hash, kind, codec, bytes.length, codec === "br" ? compressed : bytes);
      if (kind === "tree") {
        const visit = (node: any): void => {
          if (!Array.isArray(node)) return;
          const child=node[0]==="$ref"||node[0]==="$commands"||node[0]==="$bytes"?node[1]:node[0]==="$numbers"||node[0]==="$points"?node[2]:undefined;
          if (child) this.db.prepare("INSERT OR IGNORE INTO payload_links VALUES(?,?)").run(hash,child);
          else for(const item of node) visit(item);
        };
        visit(JSON.parse(bytes.toString()));
      }
    }
    return hash;
  }

  get(hash: string, kind?: string): Buffer {
    const cacheKey=`${kind??""}:${hash}`;
    if(this.reading && this.raw.has(cacheKey))return this.raw.get(cacheKey)!;
    const row = this.select.get(hash);
    if (!row || (kind && row.kind !== kind)) throw new Error(`Missing or invalid payload ${hash}`);
    const data = Buffer.from(row.data as Uint8Array);
    const raw = row.codec === "br" ? brotliDecompressSync(data, { maxOutputLength: Number(row.raw_size) }) : data;
    if (raw.length !== row.raw_size || digest(Buffer.concat([Buffer.from(`${row.kind}\0`), raw])) !== hash) throw new Error(`Corrupt payload ${hash}`);
    if(this.reading)this.raw.set(cacheKey,raw);
    return raw;
  }

  write(value: unknown): string {
    return this.put("tree", Buffer.from(JSON.stringify(this.encode(value))));
  }

  retain(parent:string, children:Iterable<string>):void {
    const insert=this.db.prepare("INSERT OR IGNORE INTO payload_links VALUES(?,?)");
    for(const child of children)insert.run(parent,child);
  }

  read<T>(hash: string): T {
    this.reading++;
    try {
      if(this.decoded.has(hash))return structuredClone(this.decoded.get(hash)) as T;
      const value=this.decode(JSON.parse(this.get(hash, "tree").toString()));
      this.decoded.set(hash,value);
      return value as T;
    }finally{if(--this.reading===0){this.decoded.clear();this.raw.clear();}}
  }

  private encode(value: unknown, key = ""): unknown {
    if(value instanceof Uint8Array){
      const blocks=[];
      for(let offset=0;offset<value.length;offset+=65536)blocks.push(["$bytes",this.put("bytes",Buffer.from(value.subarray(offset,offset+65536)))]);
      return ["$byteChunks",value.length,blocks];
    }
    if (Array.isArray(value)) {
      if(key==="elements") {
        // Small blocks keep local edits bounded without a database row for every mark.
        const blocks=[];
        for(let i=0;i<value.length;i+=32) blocks.push(["$ref",this.write(value.slice(i,i+32))]);
        return ["$ref",this.put("tree",Buffer.from(JSON.stringify(["$elementChunks",blocks])))];
      }
      if(key==="commands" && value.length) {
        const fields:Record<string,string[]>={M:["x","y"],L:["x","y"],C:["x1","y1","x2","y2","x","y"],Q:["x1","y1","x","y"],Z:[]};
        const ops=Object.keys(fields),bytes=Buffer.alloc(value.reduce((n,c)=>n+1+fields[c.op]!.length*8,0));let at=0;
        for(const command of value){bytes[at++]=ops.indexOf(command.op);for(const field of fields[command.op]!){bytes.writeDoubleLE(command[field],at);at+=8;}}
        return ["$commands",this.put("path-f64",bytes)];
      }
      if (value.length && value.every(v => typeof v === "number" && Number.isFinite(v))) {
        // Alpha masks are bytes only when every source value is exactly representable.
        const byte = key === "alpha" && value.every(v => Number.isInteger(v) && v >= 0 && v <= 255);
        const buffer = Buffer.alloc(value.length * (byte ? 1 : 8));
        value.forEach((n, i) => byte ? buffer.writeUInt8(n, i) : buffer.writeDoubleLE(n, i * 8));
        return ["$numbers", byte ? "u8" : "f64", this.put(byte ? "u8" : "f64", buffer)];
      }
      if (key === "points" && value.length) {
        const keys = [...new Set(value.flatMap(p => Object.keys(p)))].sort();
        if (value.every(p => keys.every(k => p[k] === undefined || typeof p[k] === "number"))) {
          const bytes = Buffer.alloc(value.length * keys.length * 9);
          value.forEach((p, i) => keys.forEach((k, j) => {
            const at = (i * keys.length + j) * 9;
            if (p[k] !== undefined) { bytes[at] = 1; bytes.writeDoubleLE(p[k], at + 1); }
          }));
          return ["$points", keys, this.put("points-f64", bytes)];
        }
      }
      return ["$array", value.map(v => this.encode(v))];
    }
    if (value && typeof value === "object") {
      const pairs = Object.entries(value).filter(([, v]) => v !== undefined)
        .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k, v]) => [k, this.encode(v, k)]);
      if (key === "brush" || key === "tip" || key === "paperTexture") return ["$ref", this.put("tree", Buffer.from(JSON.stringify(["$object", pairs])))];
      return ["$object", pairs];
    }
    return Object.is(value,-0)?["$negativeZero"]:value;
  }

  private decode(value: any): unknown {
    if (!Array.isArray(value)) return value;
    if(value[0]==="$negativeZero")return -0;
    if(value[0]==="$bytes")return new Uint8Array(this.get(value[1],"bytes"));
    if(value[0]==="$byteChunks"){
      const length=value[1];
      if(!Number.isSafeInteger(length)||length<0||length>128*1024*1024)throw new Error("Invalid byte surface length");
      const result=new Uint8Array(length);let offset=0;
      for(const block of value[2]){const bytes=this.decode(block);if(!(bytes instanceof Uint8Array)||offset+bytes.length>length)throw new Error("Invalid byte block");result.set(bytes,offset);offset+=bytes.length;}
      if(offset!==length)throw new Error("Truncated byte surface");return result;
    }
    if(value[0]==="$commands") {
      const bytes=this.get(value[1],"path-f64"),fields=[["x","y"],["x","y"],["x1","y1","x2","y2","x","y"],["x1","y1","x","y"],[]],ops=["M","L","C","Q","Z"],commands=[];let at=0;
      while(at<bytes.length){const op=bytes[at++]!;if(!fields[op]||at+fields[op]!.length*8>bytes.length)throw new Error("Corrupt path payload");const command:Record<string,unknown>={op:ops[op]};for(const field of fields[op]!){command[field]=bytes.readDoubleLE(at);at+=8;}commands.push(command);}
      return commands;
    }
    if (value[0] === "$ref") return this.read(value[1]);
    if (value[0] === "$elementChunks") return value[1].flatMap((v: unknown) => this.decode(v));
    if (value[0] === "$array") return value[1].map((v: unknown) => this.decode(v));
    if (value[0] === "$object") return Object.fromEntries(value[1].map(([k, v]: [string, unknown]) => [k, this.decode(v)]));
    if (value[0] === "$numbers") {
      const bytes = this.get(value[2], value[1]);
      if (value[1] === "u8") return [...bytes];
      if (bytes.length % 8) throw new Error("Invalid Float64 payload length");
      return Array.from({ length: bytes.length / 8 }, (_, i) => bytes.readDoubleLE(i * 8));
    }
    if (value[0] === "$points") {
      const keys: string[] = value[1], bytes = this.get(value[2], "points-f64"), stride = keys.length * 9;
      if (!stride || bytes.length % stride) throw new Error("Invalid point payload length");
      return Array.from({ length: bytes.length / stride }, (_, i) => Object.fromEntries(keys.flatMap((k, j) => bytes[i * stride + j * 9] ? [[k, bytes.readDoubleLE(i * stride + j * 9 + 1)]] : [])));
    }
    throw new Error("Unknown payload tag");
  }
}
