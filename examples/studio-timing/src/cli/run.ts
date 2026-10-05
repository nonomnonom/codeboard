import { author } from "../project/author.ts";
import { revise } from "../project/revise.ts";
import { review, movie } from "../review/export.ts";

const args = process.argv.slice(2).filter((argument) => argument !== "--");
if (args.length !== 1)
  throw new Error("Choose exactly one action: author, revise, review or export");
const [command] = args;
switch (command) {
  case "author":
    console.log(`Saved ${(await author()).id}`);
    break;
  case "revise":
    console.log(JSON.stringify(await revise(), null, 2));
    break;
  case "review":
    console.log((await review()).directory);
    break;
  case "export":
    console.log(JSON.stringify(await movie(), null, 2));
    break;
  default:
    throw new Error("Choose author, revise, review or export");
}
