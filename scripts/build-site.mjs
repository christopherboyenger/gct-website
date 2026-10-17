import { cp, mkdir, rm, copyFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "site-dist");
if (dirname(out) !== root || basename(out) !== "site-dist")
  throw new Error("Unsafe build output");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const pages = [
  "index.html",
  "gct-creators.html",
  "gct-brands.html",
  "gct-courses.html",
  "privacy.html",
  "404.html",
];
for (const page of pages)
  await copyFile(resolve(root, page), resolve(out, page));
await mkdir(resolve(out, "assets"), { recursive: true });
for (const name of ["funnel.css", "funnel.js"])
  await copyFile(resolve(root, "assets", name), resolve(out, "assets", name));
for (const dir of ["brand", "photos", "ugc", "fonts"])
  await cp(resolve(root, "assets", dir), resolve(out, "assets", dir), {
    recursive: true,
  });
await copyFile(resolve(root, "appfavicon.jpg"), resolve(out, "appfavicon.jpg"));
console.log(
  `Built ${pages.length} pages. Retired pages and internal production boards are excluded.`,
);
