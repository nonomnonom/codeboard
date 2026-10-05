import { createHash } from "node:crypto";
import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { remark } from "remark";
import GithubSlugger from "github-slugger";
import { documentationFiles } from "./docs-source.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "dist/docs");
await mkdir(output, { recursive: true });
const temporary = join(output, `index-${process.pid}.sqlite`);
const hash = (data) => createHash("sha256").update(data).digest("hex");
const normalize = (text) => text.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
const textOf = (node) => node.value ?? node.children?.map(textOf).join("") ?? "";
const { version: packageVersion } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const sources = [];
const db = new DatabaseSync(temporary);
let sections = 0;
try {
  db.exec(`
    CREATE TABLE pages(id TEXT PRIMARY KEY, path TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, lines INTEGER NOT NULL);
    CREATE TABLE sections(rowid INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, page_id TEXT NOT NULL, title TEXT NOT NULL, heading TEXT NOT NULL, kind TEXT NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL);
    CREATE TABLE symbols(name TEXT NOT NULL, qualified TEXT NOT NULL, section_id TEXT NOT NULL, PRIMARY KEY(qualified, section_id));
    CREATE INDEX symbol_names ON symbols(name);
    CREATE VIRTUAL TABLE search USING fts5(title, heading, body, content='', tokenize='porter unicode61');
    BEGIN;
  `);
  const pageInsert = db.prepare("INSERT INTO pages VALUES(?,?,?,?,?)");
  const sectionInsert = db.prepare(
    "INSERT INTO sections(id,page_id,title,heading,kind,start_line,end_line) VALUES(?,?,?,?,?,?,?)",
  );
  const symbolInsert = db.prepare("INSERT OR IGNORE INTO symbols VALUES(?,?,?)");
  const searchInsert = db.prepare("INSERT INTO search(rowid,title,heading,body) VALUES(?,?,?,?)");
  for (const path of await documentationFiles(root)) {
    if (!path.endsWith(".md")) continue;
    const content = (await readFile(join(root, path), "utf8")).replace(/\r\n/g, "\n");
    sources.push([path, hash(content)]);
    const lines = content.split("\n");
    if (lines.at(-1) === "") lines.pop();
    if (lines.some((line) => Buffer.byteLength(line) + 1 > 24 * 1024))
      throw new Error(`${path}: source line exceeds the documentation read budget`);
    const tree = remark().parse(content);
    const headings = tree.children.filter((node) => node.type === "heading");
    const id = path.slice(5, -3);
    const title = headings[0] ? textOf(headings[0]) : id;
    pageInsert.run(id, path, title, content, lines.length);
    const slugger = new GithubSlugger();
    const ancestors = [];
    for (let index = 0; index < headings.length; index++) {
      const heading = headings[index];
      const name = textOf(heading);
      const slug = slugger.slug(name);
      const start = index === 0 ? 1 : heading.position.start.line;
      const ownEnd = (headings[index + 1]?.position.start.line ?? lines.length + 1) - 1;
      const nextPeer = headings.slice(index + 1).find((next) => next.depth <= heading.depth);
      const end = (nextPeer?.position.start.line ?? lines.length + 1) - 1;
      ancestors.length = heading.depth - 1;
      const parent = ancestors[heading.depth - 2];
      ancestors[heading.depth - 1] = name;
      const sectionId = `${id}#${slug}`;
      const kind = id.startsWith("reference/api/") ? "api" : "guide";
      const breadcrumb = ancestors.filter(Boolean).join(" > ");
      const { lastInsertRowid } = sectionInsert.run(
        sectionId,
        id,
        title,
        breadcrumb,
        kind,
        start,
        end,
      );
      searchInsert.run(
        lastInsertRowid,
        normalize(title),
        normalize(breadcrumb),
        normalize(lines.slice(start - 1, ownEnd).join("\n")),
      );
      if (kind === "api" && heading.depth >= 2 && /^[A-Za-z_$][\w$]*$/.test(name)) {
        const qualified = heading.depth === 3 && parent ? `${parent}.${name}` : name;
        symbolInsert.run(name, qualified, sectionId);
      }
      sections++;
    }
  }
  db.exec("COMMIT; INSERT INTO search(search) VALUES('optimize'); VACUUM;");
} finally {
  db.close();
}
await rename(temporary, join(output, "index.sqlite"));
const manifest = {
  schemaVersion: 1,
  packageVersion,
  docsHash: hash(JSON.stringify(sources)),
  databaseHash: hash(await readFile(join(output, "index.sqlite"))),
  pages: sources.length,
  sections,
};
await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Bundled ${sources.length} documentation pages, ${sections} sections for ${packageVersion}.`,
);
