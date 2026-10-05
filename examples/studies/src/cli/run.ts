import { generate } from "../project/generate.ts";
const args = process.argv.slice(2);
const positional = args.filter((arg) => arg !== "--video");
if (positional.length > 1 || positional.some((arg) => arg.startsWith("--")))
  throw new Error("Usage: run.ts [new-output-directory] [--video]");
console.log(`Generated study assets: ${await generate(positional[0], args.includes("--video"))}`);
