import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const script = process.argv[2];
if (!script) throw new Error("An authoring script is required");
process.argv.splice(1, 1);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "codeboard-studio") {
      return { url: new URL("./index.js", import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
await import(pathToFileURL(script).href);
