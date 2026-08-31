import {
  appendFileSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import type { DatasetRecord, SolverKey } from "../src/types";
import type {
  BenchmarkOptions,
  BenchmarkReport,
  BenchmarkResult,
  SolverSummary,
} from "./benchmark-types";

const percentile = (values: number[], fraction: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index]!;
};

const summarizeSolver = (input: {
  solverKey: SolverKey;
  results: BenchmarkResult[];
}): SolverSummary => {
  const solverResults = input.results.filter(
    (result) => result.solverKey === input.solverKey,
  );
  const validNodeIds = solverResults
    .filter((result) => result.valid)
    .map((result) => result.nodeId);
  const otherValidNodeIds = new Set(
    input.results
      .filter(
        (result) => result.solverKey !== input.solverKey && result.valid,
      )
      .map((result) => result.nodeId),
  );
  const durations = solverResults.map((result) => result.durationMs);

  return {
    solverKey: input.solverKey,
    validCount: validNodeIds.length,
    totalCount: solverResults.length,
    validNodeIds,
    uniqueNodeIds: validNodeIds.filter((id) => !otherValidNodeIds.has(id)),
    averageDurationMs:
      durations.reduce((sum, value) => sum + value, 0) /
      Math.max(1, durations.length),
    p50DurationMs: percentile(durations, 0.5),
    p95DurationMs: percentile(durations, 0.95),
  };
};

export const buildReport = (input: {
  options: BenchmarkOptions;
  records: DatasetRecord[];
  results: BenchmarkResult[];
}): BenchmarkReport => {
  const summaries = input.options.solverKeys.map((solverKey) =>
    summarizeSolver({ solverKey, results: input.results }),
  );
  const unionValidNodeIds = input.records
    .map((record) => record.id)
    .filter((nodeId) =>
      input.results.some(
        (result) => result.nodeId === nodeId && result.valid,
      ),
    );

  return {
    generatedAt: new Date().toISOString(),
    options: {
      solverKeys: input.options.solverKeys,
      settingsMode: input.options.settingsMode,
      maxIterations: input.options.maxIterations,
      seed: input.options.seed,
      limit: input.options.limit,
      sample: input.options.sample,
    },
    nodeIds: input.records.map((record) => record.id),
    results: input.results,
    summaries,
    unionValidNodeIds,
  };
};

export const createRunDirectory = (repositoryRoot: string) => {
  const resultsDirectory = resolve(repositoryRoot, "results");
  mkdirSync(resultsDirectory, { recursive: true });
  const runNumbers = readdirSync(resultsDirectory)
    .map((name) => /^run(\d+)$/.exec(name)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  const nextRunNumber = Math.max(0, ...runNumbers) + 1;
  const runDirectory = resolve(
    resultsDirectory,
    `run${String(nextRunNumber).padStart(3, "0")}`,
  );
  mkdirSync(runDirectory);
  return runDirectory;
};

export const createLogger = (logFile: string) => (message = "") => {
  console.log(message);
  appendFileSync(logFile, `${message}\n`);
};

export const statusMark = (result: BenchmarkResult) => {
  if (result.valid) return "PASS";
  if (result.status === "incomplete") return "MISS";
  return "FAIL";
};

export const writeSummary = (input: {
  log: (message?: string) => void;
  report: BenchmarkReport;
}) => {
  input.log();
  input.log("Per-solver summary");
  for (const summary of input.report.summaries) {
    input.log(
      `${summary.solverKey.toUpperCase()} valid=${summary.validCount}/${summary.totalCount} ` +
        `duration=${summary.averageDurationMs.toFixed(1)}ms avg ` +
        `p50=${summary.p50DurationMs.toFixed(1)}ms ` +
        `p95=${summary.p95DurationMs.toFixed(1)}ms`,
    );
  }

  input.log();
  input.log(
    `Union valid=${input.report.unionValidNodeIds.length}/${input.report.nodeIds.length}`,
  );
  input.log("Unique contribution (not solved by any other selected solver)");
  for (const summary of input.report.summaries) {
    const nodes = summary.uniqueNodeIds.join(", ") || "none";
    input.log(
      `${summary.solverKey.toUpperCase()} unique=${summary.uniqueNodeIds.length}: ${nodes}`,
    );
  }

  input.log();
  input.log("Native-bound validity matrix");
  const heading = [
    "node".padEnd(38),
    ...input.report.options.solverKeys.map((key) =>
      key.toUpperCase().padStart(5),
    ),
  ].join(" ");
  input.log(heading);
  for (const nodeId of input.report.nodeIds) {
    const cells = input.report.options.solverKeys.map((solverKey) => {
      const result = input.report.results.find(
        (candidate) =>
          candidate.nodeId === nodeId && candidate.solverKey === solverKey,
      );
      return (result?.valid ? "yes" : "-").padStart(5);
    });
    input.log([nodeId.padEnd(38), ...cells].join(" "));
  }
};

export const saveReport = (input: {
  runDirectory: string;
  report: BenchmarkReport;
}) => {
  writeFileSync(
    resolve(input.runDirectory, "results.json"),
    `${JSON.stringify(input.report, null, 2)}\n`,
  );
};
