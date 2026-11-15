import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRouteGeometryViolations } from "@tscircuit/high-density-a01";
import { normalizeManifest, normalizeRecord } from "../src/data";
import { createSolver } from "../src/solver-factory";
import type { DatasetRecord, SolverKey } from "../src/types";
import {
  buildReport,
  createLogger,
  createRunDirectory,
  saveReport,
  statusMark,
  writeSummary,
} from "./benchmark-report";
import type {
  BenchmarkOptions,
  BenchmarkResult,
  BenchmarkStatus,
} from "./benchmark-types";
import {
  getPhysicalCoverage,
  validateRouteOutput,
} from "./benchmark-validation";

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getStatus = (input: {
  solved: boolean;
  failed: boolean;
  coverageValid: boolean;
  violationCount: number;
}): BenchmarkStatus => {
  if (
    input.solved &&
    !input.failed &&
    input.coverageValid &&
    input.violationCount === 0
  ) {
    return "valid";
  }
  if (input.coverageValid && input.violationCount > 0) {
    return "geometry-invalid";
  }
  if (input.failed) return "solver-failed";
  if (!input.solved) return "incomplete";
  return "coverage-invalid";
};

const runCase = (input: {
  record: DatasetRecord;
  solverKey: SolverKey;
  options: BenchmarkOptions;
}): BenchmarkResult => {
  const startedAt = performance.now();
  try {
    const solver = createSolver({
      record: input.record,
      solverKey: input.solverKey,
      settingsMode: input.options.settingsMode,
      maxIterations: input.options.maxIterations,
      a01ShuffleSeed: input.options.seed,
    });
    solver.solve();
    const durationMs = performance.now() - startedAt;
    const routeOutput = validateRouteOutput(solver.getOutput());
    const coverage = getPhysicalCoverage(
      input.record.nodeWithPortPoints,
      routeOutput.routes,
    );
    const violationCount = findRouteGeometryViolations(
      routeOutput.routes,
    ).length;
    const status = getStatus({
      solved: solver.solved,
      failed: solver.failed,
      coverageValid: coverage.valid,
      violationCount,
    });

    return {
      nodeId: input.record.id,
      solverKey: input.solverKey,
      status,
      valid: status === "valid",
      solved: solver.solved,
      failed: solver.failed,
      iterations: solver.iterations,
      durationMs,
      routeCount: routeOutput.routes.length,
      violationCount,
      coverage,
      error: solver.error ?? routeOutput.error,
    };
  } catch (error: unknown) {
    return {
      nodeId: input.record.id,
      solverKey: input.solverKey,
      status: "error",
      valid: false,
      solved: false,
      failed: true,
      iterations: 0,
      durationMs: performance.now() - startedAt,
      routeCount: 0,
      violationCount: 0,
      coverage: null,
      error: errorMessage(error),
    };
  }
};

const loadSelectedRecords = (options: BenchmarkOptions) => {
  const manifestRaw: unknown = JSON.parse(
    readFileSync(resolve(REPOSITORY_ROOT, "manifest.json"), "utf8"),
  );
  const manifest = normalizeManifest(manifestRaw);
  if (options.sample !== undefined && options.sample > manifest.entries.length) {
    throw new Error(
      `--sample must be between 1 and ${manifest.entries.length}`,
    );
  }
  const selectedEntries = options.sample
    ? [manifest.entries[options.sample - 1]!]
    : manifest.entries.slice(0, options.limit);

  return selectedEntries.map((entry) => {
    const raw: unknown = JSON.parse(
      readFileSync(resolve(REPOSITORY_ROOT, entry.file), "utf8"),
    );
    return normalizeRecord(raw, entry);
  });
};

export async function runBenchmark(options: BenchmarkOptions) {
  const records = loadSelectedRecords(options);
  const runDirectory = createRunDirectory(REPOSITORY_ROOT);
  const log = createLogger(resolve(runDirectory, "logs.txt"));
  const resultCount = records.length * options.solverKeys.length;
  const results: BenchmarkResult[] = [];

  log("HD30 native-bound solver benchmark");
  log(
    `nodes=${records.length} solvers=${options.solverKeys.map((key) => key.toUpperCase()).join(",")}`,
  );
  log(
    `settings=${options.settingsMode} maxIterations=${options.maxIterations} seed=${options.seed}`,
  );
  log(`output=${runDirectory}`);
  log();

  for (const record of records) {
    for (const solverKey of options.solverKeys) {
      const result = runCase({ record, solverKey, options });
      results.push(result);
      const coverage = result.coverage;
      log(
        `[${results.length}/${resultCount}] ${record.id} ${solverKey.toUpperCase()} ` +
          `${statusMark(result)} status=${result.status} ` +
          `duration=${result.durationMs.toFixed(1)}ms ` +
          `iterations=${result.iterations} routes=${result.routeCount} ` +
          `pairs=${coverage?.routedPairCount ?? 0}/${coverage?.expectedPairCount ?? 0} ` +
          `violations=${result.violationCount}`,
      );
      if (result.error) log(`  error=${result.error}`);
    }
  }

  const report = buildReport({ options, records, results });
  writeSummary({ log, report });
  saveReport({ runDirectory, report });
  return report;
}
