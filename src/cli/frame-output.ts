import { open, rm } from "node:fs/promises";

/** Reserve a new output; on ordinary failure remove only the file this call created. */
export async function writeNewFrame(output: string, png: Buffer): Promise<void> {
  const file = await open(output, "wx");
  try {
    await file.writeFile(png);
    await file.close();
  } catch (error) {
    const failures: unknown[] = [error];
    try {
      await file.close();
    } catch (cleanup) {
      failures.push(cleanup);
    }
    try {
      await rm(output);
    } catch (cleanup) {
      failures.push(cleanup);
    }
    if (failures.length > 1)
      throw new AggregateError(failures, "Frame output failed and cleanup was incomplete");
    throw error;
  }
}
