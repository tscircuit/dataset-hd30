import type { HighDensityIntraNodeRoute } from "@tscircuit/high-density-a01";
import type { SettingsMode, SolverKey } from "../src/types";

export type BenchmarkOptions = {
  solverKeys: SolverKey[];
  settingsMode: SettingsMode;
  maxIterations: number;
  seed: number;
  limit?: number;
  sample?: number;
  help: boolean;
};

export type BenchmarkStatus =
  | "valid"
  | "solver-failed"
  | "incomplete"
  | "geometry-invalid"
  | "coverage-invalid"
  | "error";

export type PhysicalCoverage = {
  valid: boolean;
  expectedPairCount: number;
  routedPairCount: number;
  duplicateRouteCount: number;
  missingPairKeys: string[];
  unexpectedPairKeys: string[];
};

export type ValidatedRouteOutput = {
  routes: HighDensityIntraNodeRoute[];
  error: string | null;
};

export type BenchmarkResult = {
  nodeId: string;
  solverKey: SolverKey;
  status: BenchmarkStatus;
  valid: boolean;
  solved: boolean;
  failed: boolean;
  iterations: number;
  durationMs: number;
  routeCount: number;
  violationCount: number;
  coverage: PhysicalCoverage | null;
  error: string | null;
};

export type SolverSummary = {
  solverKey: SolverKey;
  validCount: number;
  totalCount: number;
  validNodeIds: string[];
  uniqueNodeIds: string[];
  averageDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
};

export type BenchmarkReport = {
  generatedAt: string;
  options: Omit<BenchmarkOptions, "help">;
  nodeIds: string[];
  results: BenchmarkResult[];
  summaries: SolverSummary[];
  unionValidNodeIds: string[];
};
