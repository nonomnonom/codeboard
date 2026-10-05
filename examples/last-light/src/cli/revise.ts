import { output } from "../config.ts";
import { revise } from "../project/revise.ts";
if (process.argv.slice(2).some((arg) => arg !== "--movie"))
  throw new Error("Usage: revise.ts [--movie]");
await revise(output, process.argv.includes("--movie"));
