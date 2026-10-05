import { expect, it } from "vitest";
import { importScriptFDX, inspectScriptFDX } from "../../src/interchange/script-fdx.js";

const document = (content: string) =>
  `<FinalDraft DocumentType="Script" Version="3"><Content>${content}</Content></FinalDraft>`;
const paragraph = '<Paragraph Type="Action"><Text>Open &amp; close.</Text></Paragraph>';

it("rejects malformed XML, entity declarations and oversized external input", () => {
  for (const source of [
    "<FinalDraft><Content></FinalDraft>",
    `<!DOCTYPE FinalDraft SYSTEM "file:///unread">${document(paragraph)}`,
    `<!DOCTYPE FinalDraft [<!ENTITY cue "external">]>${document(paragraph)}`,
    document("<Unknown>".repeat(40) + "</Unknown>".repeat(40)),
  ])
    expect(() => inspectScriptFDX(source)).toThrow(
      expect.objectContaining({ code: "INVALID_ARGUMENT" }),
    );
  expect(() => inspectScriptFDX(" ".repeat(2 * 1024 * 1024 + 1))).toThrow(
    expect.objectContaining({ code: "RESOURCE_LIMIT" }),
  );
});

it("binds decoded text to the exact inspected source and explicit paragraph identities", () => {
  const source = document(paragraph);
  const inspection = inspectScriptFDX(source);
  const options = {
    id: "script",
    title: "Door",
    sourceSha256: inspection.sourceSha256,
    bindings: [{ paragraph: 0, id: "action", panelIds: [] }],
  };
  expect(importScriptFDX(source, options).script.entries).toEqual([
    { id: "action", kind: "action", text: "Open & close.", panelIds: [] },
  ]);
  expect(() => importScriptFDX(source.replace("close", "leave"), options)).toThrow(
    /Source changed since inspection/,
  );
  for (const bindings of [
    [],
    [...options.bindings, ...options.bindings],
    [{ ...options.bindings[0]!, paragraph: 1 }],
  ])
    expect(() => importScriptFDX(source, { ...options, bindings })).toThrow(
      expect.objectContaining({ code: "INVALID_ARGUMENT" }),
    );
});

it("requires explicit acceptance of omitted formatting and unsupported paragraph content", () => {
  const source = document(
    paragraph.replace("<Text>", '<Text Style="Bold">') +
      '<Paragraph Type="Transition"><Text>CUT TO:</Text></Paragraph>',
  );
  const inspection = inspectScriptFDX(source);
  expect(inspection.losses).toHaveLength(2);
  const options = {
    id: "script",
    title: "Door",
    sourceSha256: inspection.sourceSha256,
    bindings: [{ paragraph: 0, id: "action", panelIds: [] }],
  };
  expect(() => importScriptFDX(source, options)).toThrow(/would lose unsupported data/);
  expect(importScriptFDX(source, { ...options, lossPolicy: "report" }).losses).toEqual(
    inspection.losses,
  );
});
