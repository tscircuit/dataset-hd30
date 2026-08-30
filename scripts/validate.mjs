import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(resolve(root, "manifest.json")));

const fail = (message) => {
  throw new Error(`dataset-hd30 validation failed: ${message}`);
};

if (manifest.schemaVersion !== 1) fail("unsupported schemaVersion");
if (manifest.dataset !== "tscircuit/dataset-hd30") fail("wrong dataset name");
if (!Array.isArray(manifest.nodes)) fail("manifest.nodes must be an array");
if (manifest.nodes.length !== 27) fail("expected exactly 27 node entries");

const ids = new Set();
const referencedFiles = new Set();
let growthAttemptCount = 0;

for (const entry of manifest.nodes) {
  if (typeof entry.id !== "string" || ids.has(entry.id)) {
    fail(`invalid or duplicate id ${String(entry.id)}`);
  }
  ids.add(entry.id);

  if (
    typeof entry.file !== "string" ||
    !entry.file.startsWith("nodes/") ||
    !entry.file.endsWith(".json") ||
    referencedFiles.has(entry.file)
  ) {
    fail(`invalid or duplicate file for ${entry.id}`);
  }
  referencedFiles.add(entry.file);

  if (
    entry.source?.pipeline !== 9 ||
    entry.source?.context !== "regular" ||
    entry.source?.autorouterCommit !==
      "d1cffe72aa914ae792080a899a9e23fca1c4ca43" ||
    entry.source?.datasetCommit !==
      "c0aad90256a95256fcac814f9f7da81a82a2fdea"
  ) {
    fail(`bad provenance for ${entry.id}`);
  }

  const attempts = entry.growth?.attempts;
  const solvedScaleFactor = entry.growth?.solvedScaleFactor;
  if (
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    entry.growth?.outcome !== "solved" ||
    solvedScaleFactor !== 2 ** attempts
  ) {
    fail(`bad growth metadata for ${entry.id}`);
  }
  growthAttemptCount += attempts;

  const raw = await readFile(resolve(root, entry.file), "utf8");
  const digest = createHash("sha256").update(raw).digest("hex");
  if (digest !== entry.sha256) fail(`SHA-256 mismatch for ${entry.file}`);

  const node = JSON.parse(raw);
  if (
    node.capacityMeshNodeId !== entry.nodeId ||
    typeof node.center?.x !== "number" ||
    typeof node.center?.y !== "number" ||
    typeof node.width !== "number" ||
    typeof node.height !== "number" ||
    !Array.isArray(node.portPoints)
  ) {
    fail(`invalid NodeWithPortPoints in ${entry.file}`);
  }
  if ("nodeWithPortPoints" in node || "source" in node || "growth" in node) {
    fail(`${entry.file} must be an unwrapped NodeWithPortPoints`);
  }
}

if (growthAttemptCount !== 28) fail("expected exactly 28 growth attempts");
if (manifest.stats?.nodeCount !== 27) fail("stats.nodeCount must be 27");
if (manifest.stats?.growthAttemptCount !== 28) {
  fail("stats.growthAttemptCount must be 28");
}

const actualFiles = (await readdir(resolve(root, "nodes")))
  .filter((name) => name.endsWith(".json"))
  .map((name) => `nodes/${name}`);
if (actualFiles.length !== referencedFiles.size) {
  fail("nodes/ contains an unreferenced or missing JSON file");
}
for (const file of actualFiles) {
  if (!referencedFiles.has(file)) fail(`unreferenced file ${file}`);
}

console.log(
  `dataset-hd30 valid: ${manifest.nodes.length} nodes, ${growthAttemptCount} growth attempts`,
);
