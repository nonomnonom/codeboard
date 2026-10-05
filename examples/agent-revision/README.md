# Revise a saved panel and retry safely

Change one panel's dialogue and mark it for review. The script saves an edit plan before committing it; rerunning the same request returns its receipt instead of applying a second edit.

## Prepare an existing project

You need a saved `.cboard`, its target panel ID and a new path for the plan. Keep a copy or named revision before experimenting. This example edits the file you supply.

In the downloaded `agent-revision` folder:

```sh
npm install
npm run typecheck
npm run revise -- /absolute/film.cboard panel-id /absolute/revision.plan.json "Hello again."
```

Replace the paths and panel ID with your own. The command writes the plan, commits the dialogue change and prints the receipt. It also renders `/absolute/revision.plan.json.png` for inspection.

## Retry or make a different revision

Repeat the identical command to retry. Keep its plan file and arguments unchanged. A different caption with the same plan path is rejected; use a new plan path for a new request. If the project's saved version changed before the first commit, reopen and prepare a new plan against that state.

`src/project/revise.ts` owns the revision flow; `src/config.ts` selects the actor. For the API contract, read [edit plans](https://codeboard.nonom.xyz/docs/reference/edit-plans/).

## Run from the Codeboard checkout

Use `npm run agent-revision:revise --workspace @codeboard/examples -- /absolute/film.cboard panel-id /absolute/revision.plan.json "Hello again."` after building the engine. Absolute input paths avoid ambiguity because the workspace runner changes to the example's directory.

The CLI delegates to `src/project/revise.ts`. That operation opens saved work, checks the persisted plan against the supplied panel/dialogue, commits through the framework, then reopens the project for the evidence image. A commit receipt is not visual approval.
