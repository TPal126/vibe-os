import { build } from "esbuild";

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const opts = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "dist/main.mjs",
  sourcemap: true,
  banner: { js: "#!/usr/bin/env node" },
};

if (watch) {
  const ctx = await (await import("esbuild")).context(opts);
  await ctx.watch();
  console.log("Watching...");
} else {
  await build(opts);
  console.log("Built agent-sidecar/dist/main.mjs");
}
