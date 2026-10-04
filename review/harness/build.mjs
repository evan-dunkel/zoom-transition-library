// Bundles the demo app and writes:
//   dist/app.js, dist/test.html      - the app with the library in src/zoom (used by the tests)
//   dist/app-original.js             - the same app with the library exactly as received (from git)
//   ../demo/zoom-demo.html            - the self-contained, double-click demo (--demo)
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, "dist"), { recursive: true });

// The library as received: the first commit's src/zoom, checked out of git.
const git = (...args) => execFileSync("git", args, { cwd: here, encoding: "utf8" });
const received = git("rev-list", "--max-parents=0", "HEAD").trim().split("\n")[0];
const originalDir = join(here, "dist/original-zoom");
mkdirSync(originalDir, { recursive: true });
for (const f of git("ls-tree", "--name-only", "--full-tree", received, "src/zoom/").trim().split("\n")) {
  writeFileSync(join(originalDir, f.split("/").pop()), git("show", `${received}:${f}`));
}
// Points the app's imports of ../../../src/zoom at that copy.
const useOriginal = {
  name: "use-original-library",
  setup(b) {
    b.onResolve({ filter: /src\/zoom/ }, (args) => {
      const rest = args.path.split("src/zoom")[1].replace(/^\//, "");
      const file = rest ? join(originalDir, rest) : join(originalDir, "index.ts");
      return { path: /\.(tsx?|css)$/.test(file) ? file : `${file}.ts` };
    });
  },
};
const bundle = (outfile, plugins = []) =>
  build({
    entryPoints: [join(here, "app/main.tsx")],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2020",
    jsx: "automatic",
    loader: { ".css": "text" },
    define: { "process.env.NODE_ENV": '"production"' },
    nodePaths: [join(here, "node_modules")],
    outfile: join(here, outfile),
    legalComments: "none",
    plugins,
  });
await bundle("dist/app.js");
await bundle("dist/app-original.js", [useOriginal]);

writeFileSync(
  join(here, "dist/test.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>zoom test</title></head>
<body><div id="app"></div><script>window.ZOOM_DEMO = window.ZOOM_DEMO || JSON.parse(decodeURIComponent(location.search.slice(1)) || '{"scenario":"grid"}');</script><script src="app.js"></script></body></html>`,
);

// Plain-HTML page for the scan + TemplateDestination path. One destination carries an
// <img onerror> to show that template HTML is executed as live markup when opened.
const svg = (hue) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="hsl(${hue} 60% 75%)"/><path d="M0 500 L0 300 L200 180 L420 320 L600 200 L800 300 L800 500 Z" fill="hsl(${hue} 40% 35%)"/></svg>`)}`;
const tItems = Array.from({ length: 6 }, (_, i) => ({ id: `t-${i + 1}`, hue: i * 55, title: `Template place ${i + 1}` }));
writeFileSync(
  join(here, "dist/template.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>zoom template test</title></head>
<body><header class="site-header"><span class="logo">Field Notes</span></header><main class="page"><h1>Static HTML sources</h1>
<ul class="tiles tiles-grid">${tItems
    .map(
      (t) => `<li><a class="tile" data-tile="${t.id}" href="/places/${t.id}"><span class="thumb" data-zoom-source="${t.id}" data-zoom-group="t"><img class="art" alt="" src="${svg(t.hue)}"></span><span class="tile-text"><span class="tile-title">${t.title}</span></span></a></li>`,
    )
    .join("")}</ul></main>
${tItems
  .map(
    (t, i) => `<template data-zoom-destination="${t.id}"><div class="detail"><div class="detail-hero" data-zoom-hero><img class="art" alt="" src="${svg(t.hue)}"></div><div class="detail-body"><h2 class="detail-title">${t.title}</h2>${
      i === 1 ? `<p>User comment: <img src="x-missing" onerror="window.__xss=(window.__xss||0)+1" alt="">nice place!</p>` : ""
    }${"<p>Static paragraph of server-rendered text. ".repeat(3)}</p>${Array.from({ length: 40 }, (_, k) => `<span class="tag">tag ${k}</span> `).join("")}</div></div></template>`,
  )
  .join("\n")}
<div id="app"></div><script>window.ZOOM_DEMO = {"scenario":"template"};</script><script src="app.js"></script></body></html>`,
);

const js = readFileSync(join(here, "dist/app.js"), "utf8");
const jsOriginal = readFileSync(join(here, "dist/app-original.js"), "utf8");
console.log(`app.js ${(js.length / 1024).toFixed(0)} KB, app-original.js ${(jsOriginal.length / 1024).toFixed(0)} KB (received ${received.slice(0, 7)})`);
if (process.argv.includes("--demo")) {
  const { makeDemo } = await import("./demo-page.mjs");
  const out = join(here, "../demo/zoom-demo.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, makeDemo(js, jsOriginal));
  console.log(`wrote ${out} (${(readFileSync(out).length / 1024).toFixed(0)} KB)`);
}
