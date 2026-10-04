// Builds the independent review's demo and probe pages from demo-src/ and the library in src/zoom.
//   node review/independent-review/build.mjs
// Writes dist/app.js + dist/probe.html (used by probes/) and zoom-demo.html (the double-click demo).
// Uses the packages installed in review/harness (npm --prefix review/harness install).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const harness = join(here, "..", "harness");
const { build } = createRequire(join(harness, "package.json"))("esbuild");
mkdirSync(join(here, "dist"), { recursive: true });

await build({
  entryPoints: [join(here, "demo-src/app.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  loader: { ".css": "text" },
  define: { "process.env.NODE_ENV": '"production"' },
  nodePaths: [join(harness, "node_modules")],
  outfile: join(here, "dist/app.js"),
  legalComments: "none",
  // One copy of React and Motion, from review/harness, even if the root has its own node_modules.
  plugins: [{
    name: "single-copy",
    setup(b) {
      b.onResolve({ filter: /^(react|react-dom|motion|scheduler)(\/|$)/ }, (args) =>
        args.pluginData?.singleCopy ? undefined : b.resolve(args.path, { kind: args.kind, resolveDir: harness, pluginData: { singleCopy: true } }));
    },
  }],
});
const js = readFileSync(join(here, "dist/app.js"), "utf8");

writeFileSync(
  join(here, "dist/probe.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>probe</title></head>
<body><div id="app"></div><script>window.ZD = window.ZD || JSON.parse(decodeURIComponent(location.search.slice(1)) || '{"scenario":"grid"}');</script><script src="app.js"></script></body></html>`,
);

const { makeDemo } = await import("./demo-page.mjs");
writeFileSync(join(here, "zoom-demo.html"), makeDemo(js));
console.log(`app.js ${(js.length / 1024).toFixed(0)} KB; zoom-demo.html ${(readFileSync(join(here, "zoom-demo.html")).length / 1024).toFixed(0)} KB`);
