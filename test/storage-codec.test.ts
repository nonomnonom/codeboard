import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { PayloadCodec } from "../src/storage/codec.js";

it("addresses equal objects identically regardless of property insertion order",()=>{
  const db=new DatabaseSync(":memory:");
  try{
    db.exec("CREATE TABLE payloads(hash TEXT PRIMARY KEY,kind TEXT,codec TEXT,raw_size INTEGER,data BLOB); CREATE TABLE payload_links(parent TEXT,child TEXT,PRIMARY KEY(parent,child));");
    const codec=new PayloadCodec(db);
    expect(codec.write({name:"ink",brush:{size:3,opacity:1}})).toBe(codec.write({brush:{opacity:1,size:3},name:"ink"}));
  }finally{db.close();}
});

it("shares unchanged artwork blocks across edits and preserves exact order and values", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE payloads(hash TEXT PRIMARY KEY,kind TEXT,codec TEXT,raw_size INTEGER,data BLOB);
      CREATE TABLE payload_links(parent TEXT,child TEXT,PRIMARY KEY(parent,child));`);
    const codec = new PayloadCodec(db);
    const drawing = {
      elements: Array.from({ length: 96 }, (_, i) => ({
        id: `stroke:${i}`, opacity: 1,
        points: [{ x: i, y: -0, pressure: 0.37 }, { x: i + 0.1, y: 13.2 }],
      })),
    };
    const original = structuredClone(drawing);
    const before = codec.write(drawing);
    const count = () => Number(db.prepare("SELECT count(*) AS n FROM payloads").get()!.n);
    const initialCount = count();
    drawing.elements[40]!.opacity = 0.3;
    const after = codec.write(drawing);
    // Changed block, ordered block references and containing object; geometry stays shared.
    expect(count() - initialCount).toBe(3);
    expect(codec.read(before)).toEqual(original);
    expect(codec.read(after)).toEqual(drawing);
    const changedCount = count();
    expect(codec.write(drawing)).toBe(after);
    expect(count()).toBe(changedCount);
    drawing.elements.splice(31, 1);
    drawing.elements.reverse();
    expect(codec.read(codec.write(drawing))).toEqual(drawing);
    const empty = { elements: [] };
    expect(codec.read(codec.write(empty))).toEqual(empty);
  } finally { db.close(); }
});

it("shares unchanged binary blocks and retains original surface bytes",()=>{
  const db=new DatabaseSync(":memory:");
  try{
    db.exec("CREATE TABLE payloads(hash TEXT PRIMARY KEY,kind TEXT,codec TEXT,raw_size INTEGER,data BLOB); CREATE TABLE payload_links(parent TEXT,child TEXT,PRIMARY KEY(parent,child));");
    const codec=new PayloadCodec(db),pixels=new Uint8Array(256*256*4),before=codec.write({pixels});
    const count=()=>Number(db.prepare("SELECT count(*) AS n FROM payloads").get()!.n);
    const initial=count();pixels[70000]=191;
    const after=codec.write({pixels});
    expect(count()-initial).toBe(2);
    expect(codec.read<{pixels:Uint8Array}>(before).pixels[70000]).toBe(0);
    expect(codec.read<{pixels:Uint8Array}>(after).pixels).toEqual(pixels);
    expect(db.prepare("SELECT count(*) AS n FROM payload_links").get()!.n).toBeGreaterThan(0);
  }finally{db.close();}
});
