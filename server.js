const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { seedState } = require("./src/seed");
const { FileStore } = require("./src/store");
const { AutomationEngine } = require("./src/engine");
const { getCapabilities } = require("./src/adapters");

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8" };

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("요청 본문이 너무 큽니다."));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error("JSON 형식이 올바르지 않습니다.")); }
    });
    req.on("error", reject);
  });
}

function serveStatic(reqPath, res) {
  const relative = reqPath === "/" ? "index.html" : decodeURIComponent(reqPath.slice(1));
  const filePath = path.resolve(PUBLIC, relative);
  if (!filePath.startsWith(`${path.resolve(PUBLIC)}${path.sep}`) && filePath !== path.join(PUBLIC, "index.html")) {
    sendJson(res, 403, { error: "허용되지 않은 경로입니다." });
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) return sendJson(res, error.code === "ENOENT" ? 404 : 500, { error: "파일을 불러오지 못했습니다." });
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
}

function createServer(options = {}) {
  const store = options.store || new FileStore(path.join(ROOT, "data", "state.json"), seedState);
  const engine = options.engine || new AutomationEngine(store);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (req.method === "GET" && url.pathname === "/api/state") return sendJson(res, 200, engine.state());
      if (req.method === "GET" && url.pathname === "/api/capabilities") return sendJson(res, 200, getCapabilities());
      if (req.method === "POST" && url.pathname === "/api/contents/generate") return sendJson(res, 201, engine.generate(await readJson(req)));
      if (req.method === "POST" && /^\/api\/contents\/[^/]+\/approve$/.test(url.pathname)) {
        const contentId = url.pathname.split("/")[3];
        return sendJson(res, 200, engine.approve(contentId));
      }
      if (req.method === "POST" && /^\/api\/contents\/[^/]+\/schedule$/.test(url.pathname)) {
        const contentId = url.pathname.split("/")[3];
        return sendJson(res, 201, engine.schedule(contentId, await readJson(req)));
      }
      if (req.method === "POST" && /^\/api\/jobs\/[^/]+\/run$/.test(url.pathname)) {
        const jobId = url.pathname.split("/")[3];
        return sendJson(res, 200, await engine.runJob(jobId));
      }
      if (req.method === "POST" && url.pathname === "/api/scheduler/tick") return sendJson(res, 200, await engine.tick());
      if (req.method === "POST" && url.pathname === "/api/reset") return sendJson(res, 200, store.reset());
      if (req.method === "GET" && !url.pathname.startsWith("/api/")) return serveStatic(url.pathname, res);
      return sendJson(res, 404, { error: "API 경로를 찾을 수 없습니다." });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  });

  const timer = setInterval(() => engine.tick().catch(() => {}), options.tickMs || 15000);
  timer.unref();
  server.on("close", () => clearInterval(timer));
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`BrandFlow MVP: http://127.0.0.1:${port}`);
    console.log("데모 모드: 실제 SNS 계정에는 게시하지 않습니다.");
  });
}

module.exports = { createServer };
