import type { NodeWithPortPoints } from "@tscircuit/high-density-a01";

export type JsonObject = Record<string, unknown>;

export type DatasetRecord = {
  id: string;
  source: unknown;
  growth: unknown;
  solverParameters: JsonObject;
  nodeWithPortPoints: NodeWithPortPoints;
  pipeline9Routes?: unknown[];
  obstacles?: unknown[];
  [key: string]: unknown;
};

export type ManifestEntry = {
  id: string;
  file: string;
  source?: unknown;
  growth?: unknown;
  solverParameters?: JsonObject;
  environment?: unknown;
  [key: string]: unknown;
};

export type DatasetManifest = {
  dataset: string;
  generatedAt?: string;
  source?: unknown;
  entries: ManifestEntry[];
  raw: unknown;
};

export type SolverKey =
  | "a01"
  | "a02"
  | "a03"
  | "a05"
  | "a08"
  | "a09"
  | "a11";

export type SettingsMode = "defaults" | "pipeline9";

export type RecordView = "debugger" | "json";

export const SOLVER_OPTIONS: Array<{ value: SolverKey; label: string }> = [
  { value: "a01", label: "A01" },
  { value: "a02", label: "A02" },
  { value: "a03", label: "A03" },
  { value: "a05", label: "A05" },
  { value: "a08", label: "A08" },
  { value: "a09", label: "A09" },
  { value: "a11", label: "A11" },
];

export const isSolverKey = (value: string | null): value is SolverKey =>
  SOLVER_OPTIONS.some((option) => option.value === value);

export const isSettingsMode = (value: string | null): value is SettingsMode =>
  value === "defaults" || value === "pipeline9";

export const isRecordView = (value: string | null): value is RecordView =>
  value === "debugger" || value === "json";
