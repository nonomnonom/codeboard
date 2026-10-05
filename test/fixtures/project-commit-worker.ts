import { readFileSync, writeSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { StoryboardProject } from "../../src/index.js";

const [source, planFile, mode] = process.argv.slice(2);
if (!source || !planFile) throw new Error("Missing project or plan path");
const project = await StoryboardProject.open(source);
const plan = JSON.parse(readFileSync(planFile, "utf8"));
const execute = DatabaseSync.prototype.exec;
const pause = () => {
  writeSync(1, "checkpoint\n");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
};
DatabaseSync.prototype.exec = function (sql: string) {
  if (sql === "BEGIN IMMEDIATE") {
    execute.call(this, "PRAGMA cache_size=1; PRAGMA cache_spill=1;");
    if (mode === "full") {
      const pages = Number(this.prepare("PRAGMA page_count").get()!.page_count);
      execute.call(this, `PRAGMA max_page_count=${pages + 2}`);
    }
  }
  if (sql === "COMMIT" && mode === "before") pause();
  execute.call(this, sql);
  if (sql === "COMMIT" && mode === "after") pause();
};
try {
  const result = await project.commit(plan, { requestId: "recovery-edit" });
  writeSync(1, `${JSON.stringify(result)}\n`);
} catch (error) {
  if (mode !== "full") throw error;
  const describe = (value: unknown): unknown => {
    if (!(value instanceof Error)) return String(value);
    return {
      message: value.message,
      ...("errcode" in value ? { errcode: value.errcode } : {}),
      ...(value instanceof AggregateError ? { errors: value.errors.map(describe) } : {}),
    };
  };
  writeSync(1, `${JSON.stringify({ failure: describe(error) })}\n`);
}
