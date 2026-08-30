import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";

const projectRoot = resolve(import.meta.dirname);
const outputDirectory = resolve(projectRoot, "dist");

/**
 * Dataset artifacts intentionally live at the repository root so they remain
 * useful without the web app. Vite only copies files in public/ by default,
 * so this tiny plugin serves those JSON files in dev and copies them into the
 * production bundle after Vite has emitted the app.
 */
function datasetArtifactsPlugin(): Plugin {
  return {
    name: "dataset-hd30-artifacts",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url) return next();

        let pathname: string;
        try {
          pathname = decodeURIComponent(
            new URL(request.url, "http://dataset-hd30.local").pathname,
          );
        } catch {
          return next();
        }

        const relativePath = pathname.replace(/^\/+/, "");
        if (
          relativePath !== "manifest.json" &&
          !relativePath.startsWith("nodes/")
        ) {
          return next();
        }

        const candidate = resolve(projectRoot, relativePath);
        const nodesRoot = `${resolve(projectRoot, "nodes")}${sep}`;
        const isAllowed =
          candidate === resolve(projectRoot, "manifest.json") ||
          candidate.startsWith(nodesRoot);

        if (
          !isAllowed ||
          !existsSync(candidate) ||
          !statSync(candidate).isFile()
        ) {
          return next();
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-cache");
        response.end(readFileSync(candidate));
      });
    },
    closeBundle() {
      const manifestPath = resolve(projectRoot, "manifest.json");
      const nodesPath = resolve(projectRoot, "nodes");
      mkdirSync(outputDirectory, { recursive: true });

      if (existsSync(manifestPath)) {
        copyFileSync(manifestPath, resolve(outputDirectory, "manifest.json"));
      }
      if (existsSync(nodesPath)) {
        cpSync(nodesPath, resolve(outputDirectory, "nodes"), {
          recursive: true,
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), datasetArtifactsPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    // The intentionally complete eight-solver debugger suite is ~518 kB before
    // gzip (~150 kB compressed), just above Vite's generic 500 kB threshold.
    chunkSizeWarningLimit: 550,
  },
});
