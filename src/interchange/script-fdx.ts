import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import { CodeboardError } from "../model/errors.js";
import { boundQueryResponse } from "../model/query.js";
import { scriptInputSchema } from "../model/schema/script.js";
import type { ScriptInput, ScriptEntry } from "../model/types/script.js";
import { validateScriptContent } from "../model/validation/script.js";

export interface FDXLoss {
  path: string;
  reason: string;
}
export interface FDXParagraph {
  /** Zero-based direct Paragraph position within Content, including unsupported paragraphs. */
  paragraph: number;
  kind: ScriptEntry["kind"];
  text: string;
  speaker?: string;
}
export interface FDXInspection {
  sourceSha256: string;
  paragraphs: FDXParagraph[];
  losses: FDXLoss[];
}
export interface FDXImportOptions {
  id: string;
  title: string;
  /** Hash from inspection; rejects bindings prepared for different source text. */
  sourceSha256: string;
  /** Exactly one explicit stable identity/link binding per inspected paragraph. */
  bindings: { paragraph: number; id: string; panelIds: string[] }[];
  lossPolicy?: "reject" | "report";
}

type XMLNode = { [key: string]: XMLNode[] | string | Record<string, string> };
const name = (node: XMLNode) => Object.keys(node).find((key) => key !== ":@")!;
const children = (node: XMLNode): XMLNode[] => node[name(node)] as XMLNode[];
const attributes = (node: XMLNode) => (node[":@"] ?? {}) as Record<string, string>;
const whitespace = (node: XMLNode) => name(node) === "#text" && !String(node["#text"]).trim();
function invalid(path: string, reason: string): never {
  throw new CodeboardError("INVALID_ARGUMENT", `FDX ${path}: ${reason}`, {
    details: { path, reason },
  });
}

/** Inspect the supported screenplay subset and every omitted element/attribute before binding IDs. */
export function inspectScriptFDX(xml: string): FDXInspection {
  if (typeof xml !== "string") invalid("/", "Expected XML text");
  if (Buffer.byteLength(xml) > 2 * 1024 * 1024)
    throw new CodeboardError("RESOURCE_LIMIT", "FDX source exceeds 2 MiB");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    invalid("/", "DOCTYPE and entity declarations are prohibited");
  const valid = XMLValidator.validate(xml);
  if (valid !== true) invalid("/", `Malformed XML at line ${valid.err.line}`);
  let nodes: XMLNode[];
  let count = 0;
  try {
    nodes = new XMLParser({
      preserveOrder: true,
      ignoreAttributes: false,
      attributeNamePrefix: "",
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: false,
      ignoreDeclaration: true,
      commentPropName: "#comment",
      maxNestedTags: 32,
      updateTag(tag) {
        if (++count > 20000)
          throw new CodeboardError("RESOURCE_LIMIT", "FDX exceeds 20000 XML elements");
        return tag;
      },
    }).parse(xml) as XMLNode[];
  } catch (cause) {
    if (cause instanceof CodeboardError) throw cause;
    throw new CodeboardError("INVALID_ARGUMENT", "FDX XML parsing failed", { cause });
  }
  const result: FDXInspection = {
    sourceSha256: createHash("sha256").update(xml).digest("hex"),
    paragraphs: [],
    losses: [],
  };
  function lose(path: string, reason: string) {
    if (result.losses.length >= 1000)
      throw new CodeboardError("RESOURCE_LIMIT", "FDX exceeds 1000 loss records");
    result.losses.push({ path, reason });
  }
  function attrs(node: XMLNode, path: string, supported: string[] = []) {
    for (const key of Object.keys(attributes(node)))
      if (!supported.includes(key)) lose(`${path}/@${key}`, "Attribute is not represented");
  }
  const roots = nodes.filter((node) => name(node) === "FinalDraft");
  if (roots.length !== 1) invalid("/", "Expected one FinalDraft root");
  for (const node of nodes)
    if (node !== roots[0] && !whitespace(node))
      lose(`/${name(node)}`, "Document-level node is not represented");
  const root = roots[0]!;
  if (attributes(root).DocumentType !== "Script")
    invalid("/FinalDraft/@DocumentType", "Only Script documents are supported");
  if (attributes(root).Version !== "3")
    invalid("/FinalDraft/@Version", "Only FDX version 3 is supported");
  attrs(root, "/FinalDraft", ["DocumentType", "Version", "Template"]);
  if (attributes(root).Template !== undefined && attributes(root).Template !== "No")
    invalid("/FinalDraft/@Template", "Template documents are not supported");
  const contents = children(root).filter((node) => name(node) === "Content");
  if (contents.length !== 1) invalid("/FinalDraft", "Expected one Content element");
  for (const [index, node] of children(root).entries())
    if (node !== contents[0] && !whitespace(node))
      lose(`/FinalDraft/${name(node)}[${index}]`, "Subtree is not represented");
  attrs(contents[0]!, "/FinalDraft/Content");
  let paragraph = 0;
  let speaker: { text: string; path: string; used: boolean } | undefined;
  function clearSpeaker() {
    if (speaker && !speaker.used)
      lose(speaker.path, "Character without supported dialogue omitted");
    speaker = undefined;
  }
  for (const [index, node] of children(contents[0]!).entries()) {
    if (whitespace(node)) continue;
    if (name(node) !== "Paragraph") {
      clearSpeaker();
      lose(`/FinalDraft/Content/${name(node)}[${index}]`, "Unsupported content subtree omitted");
      continue;
    }
    if (paragraph >= 4000)
      throw new CodeboardError("RESOURCE_LIMIT", "FDX exceeds 4000 paragraphs");
    const ordinal = paragraph++;
    const path = `/FinalDraft/Content/Paragraph[${ordinal}]`;
    const type = attributes(node).Type;
    attrs(node, path, ["Type"]);
    let text = "";
    for (const [childIndex, child] of children(node).entries()) {
      if (whitespace(child)) continue;
      const childPath = `${path}/${name(child)}[${childIndex}]`;
      if (name(child) !== "Text") {
        lose(childPath, "Paragraph child subtree omitted");
        continue;
      }
      attrs(child, childPath);
      for (const part of children(child)) {
        if (name(part) === "#text") text += String(part["#text"]);
        else lose(`${childPath}/${name(part)}`, "Nested text subtree omitted");
      }
    }
    if (type === "Character") {
      clearSpeaker();
      speaker = { text, path, used: false };
      continue;
    }
    if (type !== "Dialogue" && type !== "Parenthetical") clearSpeaker();
    const kind =
      type === "Scene Heading"
        ? "scene"
        : type === "Action"
          ? "action"
          : type === "Dialogue"
            ? "dialogue"
            : undefined;
    if (!kind) {
      lose(path, `Unsupported paragraph type ${type ?? "(missing)"} omitted`);
      continue;
    }
    if (result.paragraphs.length >= 1000)
      throw new CodeboardError("RESOURCE_LIMIT", "FDX exceeds 1000 script entries");
    if (text.length > 65536 || (speaker && speaker.text.length > 4096))
      invalid(path, "Text or speaker exceeds script field limits");
    result.paragraphs.push({
      paragraph: ordinal,
      kind,
      text,
      ...(kind === "dialogue" && speaker ? { speaker: speaker.text } : {}),
    });
    if (kind === "dialogue" && speaker) speaker.used = true;
  }
  clearSpeaker();
  boundQueryResponse(result.losses, "FDX loss report");
  if (Buffer.byteLength(JSON.stringify(result)) > 2 * 1024 * 1024)
    throw new CodeboardError("RESOURCE_LIMIT", "FDX inspection exceeds 2 MiB");
  return result;
}

const bindingSchema = z
  .object({
    paragraph: z.number().int().min(0).max(3999),
    id: z.string().min(1).max(4096),
    panelIds: z.array(z.string().min(1).max(4096)).max(1000),
  })
  .strict();
const optionsSchema = z
  .object({
    id: z.string().min(1).max(4096),
    title: z.string().max(4096),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    bindings: z.array(bindingSchema).max(1000),
    lossPolicy: z.enum(["reject", "report"]).default("reject"),
  })
  .strict();

/** Import hash-bound, explicitly identified records; project revision and panel checks apply later. */
export function importScriptFDX(
  xml: string,
  input: FDXImportOptions,
): {
  script: ScriptInput;
  sourceSha256: string;
  losses: FDXLoss[];
} {
  const parsed = optionsSchema.safeParse(input);
  if (!parsed.success) invalid("/options", parsed.error.issues[0]!.message);
  const options = parsed.data;
  const source = inspectScriptFDX(xml);
  if (source.sourceSha256 !== options.sourceSha256)
    invalid("/options/sourceSha256", "Source changed since inspection; inspect and rebind");
  if (options.lossPolicy === "reject" && source.losses.length)
    throw new CodeboardError("INVALID_ARGUMENT", "FDX import would lose unsupported data", {
      details: { losses: source.losses },
    });
  const bindings = new Map(options.bindings.map((binding) => [binding.paragraph, binding]));
  if (bindings.size !== options.bindings.length || bindings.size !== source.paragraphs.length)
    invalid("/options/bindings", "Bind each inspected paragraph exactly once");
  const entries = source.paragraphs.map((record) => {
    const binding = bindings.get(record.paragraph);
    if (!binding) invalid("/options/bindings", `Missing paragraph ${record.paragraph}`);
    return {
      id: binding.id,
      kind: record.kind,
      text: record.text,
      ...(record.speaker === undefined ? {} : { speaker: record.speaker }),
      panelIds: binding.panelIds,
    };
  });
  const script = scriptInputSchema.safeParse({ id: options.id, title: options.title, entries });
  if (!script.success) invalid("/script", script.error.issues[0]!.message);
  const result = script.data as ScriptInput;
  validateScriptContent(result);
  return { script: result, sourceSha256: source.sourceSha256, losses: source.losses };
}
