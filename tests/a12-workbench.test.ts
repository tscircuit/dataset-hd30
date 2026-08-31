import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { HighDensitySolverA12 } from "@tscircuit/high-density-a01";
import {
  createSolver,
  getEffectiveSolverSettings,
  getPipelineOverrides,
} from "../src/solver-factory";
import { SOLVER_DEFAULTS } from "../src/solver-defaults";
import {
  SOLVER_OPTIONS,
  type DatasetRecord,
  type JsonObject,
} from "../src/types";

const nodeWithPortPoints = JSON.parse(
  readFileSync(
    new URL("../nodes/sample003-cmn_70.json", import.meta.url),
    "utf8",
  ),
);

const record: DatasetRecord = {
  id: "sample003-cmn_70",
  source: {},
  growth: {},
  solverParameters: {
    viaDiameter: 0.3,
    traceWidth: 0.1,
    obstacleMargin: 0.15,
    effort: 1,
  },
  nodeWithPortPoints,
};

test("A12 is exposed with its mixed-resolution defaults", () => {
  expect(SOLVER_OPTIONS.slice(-2)).toEqual([
    { value: "a11", label: "A11" },
    { value: "a12", label: "A12" },
  ]);
  expect(SOLVER_DEFAULTS.a12).toEqual({
    traceMargin: 0.15,
    traceThickness: 0.1,
    viaDiameter: 0.3,
    viaMinDistFromBorder: 0.15,
    fineGridCellThickness: 16,
  });
});

test("Pipeline9 settings and seed are mapped into A12", () => {
  expect(getPipelineOverrides(record, "a12")).toEqual({
    viaDiameter: 0.3,
    traceThickness: 0.1,
    traceMargin: 0.1,
    effort: 1,
  });

  const effective = getEffectiveSolverSettings({
    record,
    solverKey: "a12",
    settingsMode: "pipeline9",
    a01ShuffleSeed: 7,
  });
  expect((effective.hyperParameters as JsonObject).shuffleSeed).toBe(7);
});

test("the workbench constructs and sets up HighDensitySolverA12", () => {
  const solver = createSolver({
    record,
    solverKey: "a12",
    settingsMode: "pipeline9",
    maxIterations: 100_000,
    a01ShuffleSeed: 0,
  });

  expect(solver).toBeInstanceOf(HighDensitySolverA12);
  const a12 = solver as HighDensitySolverA12;
  expect(a12.getSolverName()).toBe("HighDensitySolverA12");
  expect(a12.highResolutionCellSize).toBeCloseTo(0.05);
  expect(a12.lowResolutionCellSize).toBeCloseTo(0.2);
  expect(a12.fineGridCellThickness).toBe(16);
});
