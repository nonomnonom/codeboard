import { Option, type Command } from "commander";

export function registerDocsCommands(program: Command, version: string): void {
  const docs = program
    .command("docs")
    .description("Search and read this package's offline documentation (JSON)");
  docs.addHelpText(
    "after",
    "\nStart: codeboard docs read index\nSearch English keywords or an exact API symbol, then read a returned ID.\n",
  );
  docs
    .command("search")
    .argument("<query>", "English keywords or exact qualified API symbol")
    .option("--limit <count>", "Results, 1–10", "5")
    .addOption(new Option("--kind <kind>", "Restrict results").choices(["guide", "api"]))
    .action(async (query: string, options: { limit: string; kind?: "guide" | "api" }) => {
      const { searchDocs } = await import("./docs/query.js");
      console.log(JSON.stringify(searchDocs(version, query, options)));
    });
  docs
    .command("read")
    .argument("<id>", "Page ID (index) or section ID returned by search")
    .option("--from-line <line>", "Continue at this source line")
    .option("--max-lines <count>", "Maximum source lines, 1–200", "80")
    .action(async (id: string, options: { fromLine?: string; maxLines: string }) => {
      const { readDocs } = await import("./docs/query.js");
      console.log(JSON.stringify(readDocs(version, id, options)));
    });
}
