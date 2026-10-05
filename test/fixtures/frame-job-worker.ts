import { writeSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { runFrameJob } from "../../src/index.js";

const [job, pauseAt, sourcePath] = process.argv.slice(2);
if (!job) throw new Error("Missing job path");
if (pauseAt === "transaction") {
  const execute = DatabaseSync.prototype.exec;
  let commits = 0;
  DatabaseSync.prototype.exec = function (sql: string) {
    if (sql === "COMMIT" && ++commits === 4) {
      writeSync(1, "checkpoint\n");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    }
    execute.call(this, sql);
    if (sql === "PRAGMA synchronous=FULL;")
      execute.call(this, "PRAGMA cache_size=1; PRAGMA cache_spill=1;");
  };
}
const result = await runFrameJob(job, {
  ...(sourcePath === undefined ? {} : { sourcePath }),
  onProgress(completed) {
    if (completed === Number(pauseAt)) {
      writeSync(1, "checkpoint\n");
      // The parent kills this live worker after the committed-frame checkpoint.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    }
  },
});
writeSync(1, `${JSON.stringify(result)}\n`);
