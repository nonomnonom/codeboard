import { afterEach, beforeEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request, type Server } from "node:http";
import sharp from "sharp";
import { StoryboardProject, startPreview } from "../../../src/index.js";

let directory: string;
let file: string;
let server: Server | undefined;
let origin: string;
let original: Buffer;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "codeboard-http-"));
  file = join(directory, "film.cboard");
  const project = StoryboardProject.create({ title: "HTTP review", width: 16, height: 8 });
  const shot = project.addScene("Scene").addShot("Shot");
  for (const [id, fill] of [
    ["red", "#ff0000"],
    ["blue", "#0000ff"],
  ] as const) {
    shot
      .addPanel({ id, durationFrames: 2 })
      .addVectorLayer(`${id} paint`)
      .path(
        [
          { op: "M", x: 0, y: 0 },
          { op: "L", x: 16, y: 0 },
          { op: "L", x: 16, y: 8 },
          { op: "L", x: 0, y: 8 },
          { op: "Z" },
        ],
        { fill },
      );
  }
  await project.save(file);
  original = await readFile(file);
  server = await startPreview(file, { port: 0 });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Preview did not bind TCP");
  origin = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server) {
    const current = server;
    server = undefined;
    await new Promise<void>((resolve, reject) => {
      current.close((error) => (error ? reject(error) : resolve()));
      current.closeAllConnections();
    });
  }
  if (directory) {
    try {
      expect(await readFile(file)).toEqual(original);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

it("lists the saved panels over HTTP in timeline order", async () => {
  const response = await fetch(`${origin}/manifest.json`);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json()).panels).toEqual([
    expect.objectContaining({ id: "red", startFrame: 0, durationFrames: 2 }),
    expect.objectContaining({ id: "blue", startFrame: 2, durationFrames: 2 }),
  ]);
});

it.each([
  ["/frame/0.png", [255, 0, 0, 255]],
  ["/frame/1.png", [255, 0, 0, 255]],
  ["/frame/2.png", [0, 0, 255, 255]],
  ["/frame/3.png", [0, 0, 255, 255]],
  ["/panel/blue.png", [0, 0, 255, 255]],
] as const)("serves authored pixels at %s", async (path, rgba) => {
  const response = await fetch(origin + path);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  const { data, info } = await sharp(Buffer.from(await response.arrayBuffer()))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([16, 8, 4]);
  // Interior pixels have no antialiased edge or text; the oracle is authored RGB.
  expect([...data.subarray((4 * 16 + 8) * 4, (4 * 16 + 8) * 4 + 4)]).toEqual(rgba);
});

it.each(["POST", "PUT", "DELETE"])(
  "rejects %s without changing the saved project",
  async (method) => {
    const response = await fetch(`${origin}/manifest.json`, { method });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(await response.text()).toBe("Read-only review service");
  },
);

it("rejects a foreign Host header before reading project data", async () => {
  const response = await new Promise<{ status: number | undefined; body: string }>(
    (resolve, reject) => {
      const connection = request(
        `${origin}/manifest.json`,
        { headers: { Host: "attacker.invalid" } },
        (message) => {
          let body = "";
          message.setEncoding("utf8");
          message.on("data", (chunk) => {
            body += chunk;
          });
          message.on("end", () => resolve({ status: message.statusCode, body }));
          message.on("error", reject);
        },
      );
      connection.on("error", reject);
      connection.end();
    },
  );
  expect(response).toEqual({ status: 403, body: "Local review only" });
});

it("returns 404 for an unknown route", async () => {
  const response = await fetch(`${origin}/missing`);
  expect(response.status).toBe(404);
});

it("returns an error for the exclusive end frame", async () => {
  const response = await fetch(`${origin}/frame/4.png`);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: expect.stringMatching(/No panel/) });
});
