import { author } from "../project/author.ts";
import { revise } from "../project/revise.ts";
import { review, movie } from "../review/export.ts";

const command = process.argv.filter((argument) => argument !== "--").at(-1);
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
