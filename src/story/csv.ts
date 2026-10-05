import { CodeboardError } from "../model/errors.js";
export function parseCSVRows(input: string, maxRows: number, maxColumns: number): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const fail = (message: string): never => {
    throw new CodeboardError("INVALID_ARGUMENT", message, { details: { row: rows.length + 1 } });
  };
  const endField = () => {
    row.push(field);
    if (row.length > maxColumns) fail("CSV exceeds its column limit");
    field = "";
    closed = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    if (rows.length > maxRows)
      throw new CodeboardError("RESOURCE_LIMIT", "CSV exceeds its row limit");
  };
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += character;
      continue;
    }
    if (character === ",") endField();
    else if (character === "\n" || character === "\r") {
      endRow();
      if (character === "\r" && text[index + 1] === "\n") index++;
    } else if (character === '"' && field.length === 0 && !closed) quoted = true;
    else {
      if (closed || character === '"') fail("Unexpected text or quote in CSV field");
      field += character;
    }
  }
  if (quoted) fail("Unclosed quoted CSV field");
  if (field.length || row.length || closed) endRow();
  return rows;
}
