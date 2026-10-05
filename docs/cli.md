# Command line

Install with `npm install -g codeboard-studio`, or use `npx codeboard` with a project-local dependency. See [installation](install.md) for Node.js requirements, version pinning, and npm updates.

Run `codeboard --help` to list commands or `codeboard COMMAND --help` for one command's options.

| Command | Purpose |
| --- | --- |
| `codeboard init [file]` | Create an authoring script; defaults to `scene.mjs` |
| `codeboard run <script> [arguments...]` | Execute JavaScript or TypeScript with the Codeboard API |
| `codeboard preview <project>` | Open a local, read-only review server |
| `codeboard inspect <project>` | Read project metadata and find objects |
| `codeboard validate <project>` | Check project integrity |
| `codeboard render <project>` | Export panel images and storyboard sheets |
| `codeboard animatic <project>` | Export frame images and an animatic manifest |
| `codeboard movie <project> --output <file>` | Export an MP4 using FFmpeg |
| `codeboard --version` | Print the installed version |

## Authoring

```sh
codeboard init scene.mjs
codeboard run scene.mjs
codeboard run revise.mts --shot reveal
```

Arguments after the script filename are passed to that script through `process.argv.slice(2)`. Paths and outputs are relative to your terminal's working directory. `run` preserves script failure exit codes.

Scripts run as trusted local code with your file and network permissions. Review scripts from other people before running them. The runner does not sandbox them or impose a time limit; Ctrl+C interrupts a running script.

## Inspect objects

```sh
codeboard inspect film.cboard --panel notice --name Hand --limit 10
codeboard inspect film.cboard --offset 10 --limit 10
```

Use bounded results to locate an object before opening its artwork. `--limit` accepts up to 200 entries.

## Preview

```sh
codeboard preview film.cboard --port 4173
```

The server binds to your computer's loopback address. Open the printed URL and press Ctrl+C to stop it. The viewer is for review, not manual drawing.

## Common problems

| Problem | What to do |
| --- | --- |
| `codeboard` is not found | Open a new terminal after installation; check the [PATH instructions](install.md) |
| `init` says the file exists | Choose another filename or run the existing script |
| An import cannot be found | Use `codeboard run`, and import the engine as `codeboard-studio` |
| TypeScript syntax is rejected | Use erasable types or JavaScript; see [TypeScript support](quickstart.md#use-typescript) |
| FFmpeg is missing | Install it and set PATH, `FFMPEG_PATH`, or `--ffmpeg` |
| A saved project is stale | Reopen the latest project and reapply your revision |
| Exported text uses a different font | Install the intended font on the rendering computer |
| Windows cannot replace an MP4 | Close the player holding that file, then export again |
