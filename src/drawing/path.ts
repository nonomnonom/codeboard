import type { PathCommand } from "../model/types.js";

/** SVG's absolute M/L/C/Q/Z subset, retained as editable contour commands. */
export function pathCommands(source: string): PathCommand[] {
  const tokens = source.match(/[MLCQZmlcqz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  if (source.replace(/[MLCQZmlcqz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g, ""))
    throw new Error("Paths support absolute M L C Q Z commands only");
  const commands: PathCommand[] = [];
  let i = 0;
  const n = () => {
    const value = Number(tokens[i++]);
    if (!Number.isFinite(value)) throw new Error("Missing finite path coordinate");
    return value;
  };
  while (i < tokens.length) {
    const op = tokens[i++];
    if (op === "M" || op === "L") commands.push({ op, x: n(), y: n() });
    else if (op === "Q") commands.push({ op, x1: n(), y1: n(), x: n(), y: n() });
    else if (op === "C") commands.push({ op, x1: n(), y1: n(), x2: n(), y2: n(), x: n(), y: n() });
    else if (op === "Z") commands.push({ op });
    else throw new Error(`Unsupported path command ${op}; repeat absolute commands explicitly`);
  }
  if (commands[0]?.op !== "M") throw new Error("A contour must begin with M");
  return commands;
}
