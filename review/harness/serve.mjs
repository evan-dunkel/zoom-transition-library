// Serves review/demo/ on your local network so you can open the demo on a phone.
// Usage (from the repo root): npm run demo:serve   then open the printed address on the
// phone (same Wi-Fi). Stop with Ctrl+C.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "demo");
const port = Number(process.env.PORT) || 5173;
const types = { ".html": "text/html; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png" };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(root, path === "/" ? "zoom-demo.html" : path);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "0.0.0.0", () => {
  const lan = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => a.address);
  console.log(`Demo running. On this computer: http://localhost:${port}/`);
  for (const ip of lan) console.log(`On your phone (same Wi-Fi):  http://${ip}:${port}/`);
  console.log("Stop with Ctrl+C.");
});
