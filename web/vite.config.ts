import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

// Stamps public/sw.js in the build output with a version derived from the
// shipped files' contents (a new deploy = a new cache) and the list of
// files to precache, so the app opens offline after a single visit.
function serviceWorkerManifest(): Plugin {
  let outDir = "dist";
  let files: string[] = [];
  return {
    name: "hunch8-service-worker-manifest",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle(_options, bundle) {
      files = Object.keys(bundle).filter((f) => !f.endsWith(".map"));
    },
    closeBundle() {
      const publicFiles = [
        "manifest.webmanifest",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
        "icons/apple-touch-icon.png",
        "icons/favicon-32.png",
      ];
      const precache = ["/", ...[...files, ...publicFiles].filter((f) => f !== "index.html").map((f) => `/${f}`)];
      // Hash the bytes of everything shipped, so any change - even a public
      // file without a hashed name, or index.html - means a new cache.
      const hash = createHash("sha256");
      for (const f of [...files, ...publicFiles].sort()) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest("hex").slice(0, 12);
      const path = join(outDir, "sw.js");
      const source = readFileSync(path, "utf8")
        .replace(`const VERSION = "dev";`, `const VERSION = "${version}";`)
        .replace("/* precache */ []", JSON.stringify(precache));
      writeFileSync(path, source);
    },
  };
}

export default defineConfig({
  build: { target: "es2022" },
  plugins: [serviceWorkerManifest()],
});
