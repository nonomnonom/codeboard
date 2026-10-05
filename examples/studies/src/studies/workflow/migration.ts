import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { StoryboardProject, migrateProject, renderFramePNG } from "codeboard-studio";
import { comparison, report } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const source = fileURLToPath(new URL("../../fixtures/schema3.cboard", import.meta.url));
  const legacy = await StoryboardProject.open(source);
  const result = await migrateProject(source, join(output, "migration.cboard"), {
    expectedVersion: legacy.version,
  });
  const migrated = await StoryboardProject.open(result.target);
  const samples = [];
  for (const frame of [0, 20, 36]) {
    const before = await renderFramePNG(legacy, frame);
    const after = await renderFramePNG(migrated, frame);
    assert.deepEqual(after, before);
    samples.push(
      { label: `Legacy · frame ${frame}`, png: before },
      { label: `Migrated · frame ${frame}`, png: after },
    );
  }
  await writeFile(
    join(output, "migration.png"),
    await comparison(output, "An older project, the same picture", samples, 2),
  );
  await report(output, "migration", result);
}
