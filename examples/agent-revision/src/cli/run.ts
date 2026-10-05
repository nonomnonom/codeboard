import { revise } from "../project/revise.ts";
const args = process.argv.slice(2);
const [projectPath, panelId, planPath, dialogue] = args;
if (args.length !== 4 || !projectPath || !panelId || !planPath || dialogue === undefined)
  throw new Error(
    'Usage: codeboard run src/cli/run.ts film.cboard panel-id revision.plan.json "New dialogue"',
  );
console.log(JSON.stringify(await revise(projectPath, panelId, planPath, dialogue), null, 2));
