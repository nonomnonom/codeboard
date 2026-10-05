import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { renderFramePNG } from "../render/panel-renderer.js";
import { renderPanelPNG } from "../render/panel.js";
import { renderContactSheet } from "../render/review.js";
import { ProjectStore } from "../storage/store.js";

/** Read-only local review endpoints. Authoring remains in the JS/TS API. */
export async function startPreview(
  projectPath: string,
  options: { port?: number } = {},
): Promise<Server> {
  const path = resolve(projectPath);
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? "";
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
        res.writeHead(403);
        res.end("Local review only");
        return;
      }
      if (req.method !== "GET") {
        res.writeHead(405, { Allow: "GET" });
        res.end("Read-only review service");
        return;
      }
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const store = ProjectStore.open(path);
      try {
        let body: Buffer | string,
          type = "application/json";
        if (url.pathname === "/" || url.pathname === "/manifest.json")
          body = JSON.stringify({ storage: store.inspect(), panels: store.listPanels() });
        else if (url.pathname === "/objects")
          body = JSON.stringify(
            store.findObjects({
              ...(url.searchParams.has("panel") ? { panelId: url.searchParams.get("panel")! } : {}),
              ...(url.searchParams.has("name") ? { name: url.searchParams.get("name")! } : {}),
            }),
          );
        else if (url.pathname === "/contact-sheet.png") {
          body = await renderContactSheet(store.readDocument());
          type = "image/png";
        } else if (/^\/panel\/.+\.png$/.test(url.pathname)) {
          const id = decodeURIComponent(url.pathname.slice(7, -4));
          body = await renderPanelPNG(store.panelDocument(id), id, { annotations: false });
          type = "image/png";
        } else if (/^\/frame\/\d+\.png$/.test(url.pathname)) {
          const frame = Number(url.pathname.slice(7, -4));
          body = await renderFramePNG(store.frameDocument(frame), frame);
          type = "image/png";
        } else if (url.pathname.startsWith("/asset/")) {
          const asset = store
            .readHeader()
            .assets.find((a) => a.id === decodeURIComponent(url.pathname.slice(7)));
          if (!asset) throw new Error("Unknown asset");
          body = store.readAsset(asset.id);
          type = asset.mimeType;
        } else {
          res.writeHead(404);
          res.end("Unknown review endpoint");
          return;
        }
        res.writeHead(200, {
          "content-type": type,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        });
        res.end(body);
      } finally {
        store.close();
      }
    } catch (error) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: (error as Error).message }));
    }
  });
  await new Promise<void>((ready, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 4173, "127.0.0.1", ready);
  });
  return server;
}
