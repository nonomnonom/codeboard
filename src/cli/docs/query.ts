import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { CodeboardError } from "../../model/errors.js";

type Kind = "guide" | "api";
type Section = {
  id: string;
  page_id: string;
  title: string;
  heading: string;
  kind: Kind;
  start_line: number;
  end_line: number;
};
const bundle = new URL("../../../docs/", import.meta.url);
const stopwords = new Set(
  "a an and are as at be by can do does for from how i in is it of on or the this to use using what when where which with".split(
    " ",
  ),
);

function integer(value: string, name: string, maximum: number): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum)
    throw new CodeboardError("INVALID_ARGUMENT", `${name} must be an integer from 1 to ${maximum}`);
  return Number(value);
}

function openBundle(version: string) {
  let docsHash = "";
  try {
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", bundle), "utf8"));
    if (
      manifest.schemaVersion !== 1 ||
      manifest.packageVersion !== version ||
      !/^[a-f0-9]{64}$/.test(manifest.docsHash)
    )
      throw new Error("Documentation schema or package version mismatch");
    const bytes = readFileSync(new URL("index.sqlite", bundle));
    if (createHash("sha256").update(bytes).digest("hex") !== manifest.databaseHash)
      throw new Error("Documentation checksum mismatch");
    docsHash = manifest.docsHash;
  } catch (cause) {
    throw new CodeboardError(
      "OPERATION_FAILED",
      "Matching documentation bundle is missing or invalid. Reinstall this package; in a source checkout run npm run docs:bundle after build.",
      { cause },
    );
  }
  return {
    db: new DatabaseSync(new URL("index.sqlite", bundle), { readOnly: true }),
    metadata: { schemaVersion: 1, packageVersion: version, docsHash },
  };
}

function describe(row: Section) {
  return {
    id: row.id,
    pageId: row.page_id,
    title: row.title,
    heading: row.heading,
    kind: row.kind,
    source: `docs/${row.page_id}.md`,
    startLine: row.start_line,
    endLine: row.end_line,
  };
}

function sectionLines(db: DatabaseSync, row: Section): string[] {
  const page = db.prepare("SELECT content FROM pages WHERE id=?").get(row.page_id) as {
    content: string;
  };
  return page.content.split("\n").slice(row.start_line - 1, row.end_line);
}

export function searchDocs(
  version: string,
  query: string,
  options: { limit: string; kind?: Kind },
) {
  const limit = integer(options.limit, "limit", 10);
  if (!query.trim() || Buffer.byteLength(query) > 512)
    throw new CodeboardError("INVALID_ARGUMENT", "Query must contain 1–512 UTF-8 bytes");
  const { db, metadata } = openBundle(version);
  try {
    const symbol = query.trim().replace(/^`([^`]+)`$/, "$1");
    const exact =
      options.kind === "guide"
        ? []
        : (db
            .prepare(
              `SELECT s.*, y.qualified FROM symbols y JOIN sections s ON s.id=y.section_id WHERE y.qualified=? OR y.name=? ORDER BY y.qualified,s.id LIMIT ?`,
            )
            .all(symbol, symbol, limit + 1) as (Section & { qualified: string })[]);
    let mode: "symbol" | "fulltext" = "symbol";
    let rows: (Section & { qualified?: string })[] = exact;
    if (!exact.length) {
      mode = "fulltext";
      const terms = [
        ...new Set(
          query
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .toLowerCase()
            .match(/[\p{L}\p{N}_]+/gu) ?? [],
        ),
      ].filter((term) => !stopwords.has(term));
      if (terms.length > 24)
        throw new CodeboardError("INVALID_ARGUMENT", "Use at most 24 search terms");
      if (terms.length) {
        const match = terms.map((term) => `"${term}"`).join(" AND ");
        rows = db
          .prepare(
            `SELECT s.* FROM search JOIN sections s ON s.rowid=search.rowid WHERE search MATCH ? AND (? IS NULL OR s.kind=?) ORDER BY CASE s.kind WHEN 'guide' THEN 0 ELSE 1 END, bm25(search,4,8,1),s.id`,
          )
          .all(match, options.kind ?? null, options.kind ?? null) as Section[];
      }
    }
    const counts = new Map<string, number>();
    const distinct = rows.filter((row) => {
      const count = counts.get(row.page_id) ?? 0;
      counts.set(row.page_id, count + 1);
      return mode === "symbol" || count < 2;
    });
    return {
      ...metadata,
      query,
      mode,
      truncated: distinct.length > limit,
      results: distinct.slice(0, limit).map((row) => {
        const content = sectionLines(db, row).join("\n");
        const excerpt = [...content].slice(0, 700).join("");
        return {
          ...describe(row),
          ...(row.qualified ? { symbol: row.qualified } : {}),
          excerpt,
          truncated: excerpt.length < content.length,
        };
      }),
      ...(distinct.length
        ? {}
        : {
            hint: "No matching section. Try fewer English keywords or an exact API symbol; read index to browse. Empty results do not prove an API is unsupported.",
          }),
    };
  } finally {
    db.close();
  }
}

export function readDocs(
  version: string,
  id: string,
  options: { fromLine?: string; maxLines: string },
) {
  if (Buffer.byteLength(id) > 512)
    throw new CodeboardError("INVALID_ARGUMENT", "Documentation ID is too long");
  const maxLines = integer(options.maxLines, "max-lines", 200);
  const { db, metadata } = openBundle(version);
  try {
    let row = db.prepare("SELECT * FROM sections WHERE id=?").get(id) as Section | undefined;
    if (!row) {
      const page = db.prepare("SELECT * FROM pages WHERE id=?").get(id) as
        | { id: string; title: string; content: string; lines: number }
        | undefined;
      if (page)
        row = {
          id,
          page_id: id,
          title: page.title,
          heading: page.title,
          kind: id.startsWith("reference/api/") ? "api" : "guide",
          start_line: 1,
          end_line: page.lines,
        };
    }
    if (!row)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Unknown documentation ID. Use docs search or docs read index.",
      );
    const from =
      options.fromLine !== undefined
        ? integer(options.fromLine, "from-line", row.end_line)
        : row.start_line;
    if (from < row.start_line)
      throw new CodeboardError("INVALID_ARGUMENT", "from-line precedes this section");
    const lines = sectionLines(db, row);
    const selected: string[] = [];
    let bytes = 0;
    for (const line of lines.slice(from - row.start_line, from - row.start_line + maxLines)) {
      const length = Buffer.byteLength(line) + 1;
      if (bytes + length > 24 * 1024) break;
      selected.push(line);
      bytes += length;
    }
    if (!selected.length)
      throw new CodeboardError(
        "RESOURCE_LIMIT",
        "A documentation line exceeds the 24 KiB read budget",
      );
    const end = from + selected.length - 1;
    return {
      ...metadata,
      ...describe(row),
      fromLine: from,
      throughLine: end,
      content: selected.join("\n"),
      truncated: end < row.end_line,
      ...(end < row.end_line ? { nextLine: end + 1 } : {}),
    };
  } finally {
    db.close();
  }
}
