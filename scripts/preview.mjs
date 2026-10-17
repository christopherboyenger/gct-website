// Local preview that mirrors the repository's explicit redirects and rewrites.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "site-dist");
const config = JSON.parse(await readFile(resolve(root, "vercel.json"), "utf8"));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    const redirect = config.redirects.find((r) => r.source === url.pathname);
    if (redirect) {
      res.writeHead(redirect.permanent ? 308 : 307, {
        Location: redirect.destination + url.search,
      });
      res.end();
      return;
    }
    const rewrite = config.rewrites.find((r) => r.source === url.pathname);
    const path = resolve(
      output,
      "." +
        (rewrite?.destination ??
          (url.pathname === "/"
            ? "/index.html"
            : decodeURIComponent(url.pathname))),
    );
    if (!path.startsWith(output + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const headers = Object.fromEntries(
      config.headers[0].headers.map((h) => [h.key, h.value]),
    );
    try {
      const data = await readFile(path);
      res.writeHead(200, {
        ...headers,
        "Content-Type": mime[extname(path)] ?? "application/octet-stream",
      });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch {
      res.writeHead(404, {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
      });
      res.end(await readFile(resolve(output, "404.html")));
    }
  } catch {
    res.writeHead(400);
    res.end("Invalid request");
  }
}).listen(Number(process.env.PORT ?? 4173), "127.0.0.1", () =>
  console.log(
    "GCT preview: http://127.0.0.1:" + Number(process.env.PORT ?? 4173),
  ),
);
