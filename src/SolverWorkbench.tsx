import {
  HighDensitySolverA01,
  HighDensitySolverA02,
  HighDensitySolverA03,
  HighDensitySolverA05,
  HighDensitySolverA08,
  HighDensitySolverA09,
} from "@tscircuit/high-density-a01";
import type { BaseSolver } from "@tscircuit/solver-utils";
import { GenericSolverDebugger } from "@tscircuit/solver-utils/react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { SOLVER_DEFAULTS } from "./solver-defaults";
import type {
  DatasetRecord,
  JsonObject,
  SettingsMode,
  SolverKey,
} from "./types";

type SolverWorkbenchProps = {
  record: DatasetRecord;
  solverKey: SolverKey;
  settingsMode: SettingsMode;
  maxIterations: number;
  a01ShuffleSeed: number;
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const PARAMETER_CONTAINER_KEYS = [
  "pipeline9",
  "highDensity",
  "highDensitySolver",
  "regularNodeSolver",
  "solverProps",
  "params",
  "parameters",
  "config",
] as const;

const SHARED_ALIASES: Record<string, string[]> = {
  viaDiameter: ["viaDiameter"],
  traceThickness: ["traceThickness", "traceWidth"],
  traceMargin: ["traceMargin", "obstacleMargin"],
  viaMinDistFromBorder: ["viaMinDistFromBorder"],
  maxCellCount: ["maxCellCount"],
  stepMultiplier: ["stepMultiplier"],
  showPenaltyMap: ["showPenaltyMap"],
  showUsedCellMap: ["showUsedCellMap"],
  effort: ["effort"],
};

const SOLVER_PARAMETER_KEYS: Record<SolverKey, string[]> = {
  a01: ["cellSizeMm", ...Object.keys(SHARED_ALIASES), "hyperParameters"],
  a02: [
    "outerGridCellSize",
    "outerGridCellThickness",
    "innerGridCellSize",
    "edgePenaltyStrength",
    "edgePenaltyFalloff",
    "enableDeferredConflictRepair",
    "maxDeferredRepairPasses",
    "enableProfiling",
    ...Object.keys(SHARED_ALIASES).filter((key) => key !== "effort"),
    "hyperParameters",
  ],
  a03: [
    "highResolutionCellSize",
    "highResolutionCellThickness",
    "lowResolutionCellSize",
    ...Object.keys(SHARED_ALIASES),
    "hyperParameters",
  ],
  a05: [
    "highResolutionCellSize",
    "highResolutionCellThickness",
    "lowResolutionCellSize",
    "borderPenaltyStrength",
    "borderPenaltyFalloff",
    "postRouteSegmentCount",
    "postRouteForceDirectedSteps",
    ...Object.keys(SHARED_ALIASES),
    "hyperParameters",
  ],
  a08: [
    "cellSizeMm",
    "initialRectMarginMm",
    "innerRectMarginMm",
    "rectShrinkStepMm",
    "breakoutTraceMarginMm",
    "breakoutBoundaryMarginMm",
    "breakoutSegmentCount",
    "breakoutMaxIterationsPerRect",
    "breakoutForceStepSize",
    "breakoutRepulsionStrength",
    "breakoutSmoothingStrength",
    "breakoutAttractionStrength",
    "innerPortSpreadFactor",
    ...Object.keys(SHARED_ALIASES),
    "hyperParameters",
  ],
  a09: [
    "highResolutionCellSize",
    "highResolutionCellThickness",
    "lowResolutionCellSize",
    "boundaryBonus",
    "boundaryBonusSigma",
    "portShadowStrength",
    "portShadowTangentSigma",
    "portShadowDepthSigma",
    "fullOrderSearchConnectionCountLimit",
    "priorityHeadSize",
    "maxCandidateOrders",
    ...Object.keys(SHARED_ALIASES),
    "hyperParameters",
  ],
};

const collectParameterSources = (
  solverParameters: JsonObject,
  solverKey: SolverKey,
) => {
  const sources: JsonObject[] = [solverParameters];
  for (const key of PARAMETER_CONTAINER_KEYS) {
    const value = solverParameters[key];
    if (isObject(value)) sources.push(value);
  }

  const solverAliases = [
    solverKey,
    solverKey.toUpperCase(),
    `HighDensitySolver${solverKey.toUpperCase()}`,
  ];
  for (const source of [...sources]) {
    for (const alias of solverAliases) {
      const value = source[alias];
      if (isObject(value)) sources.push(value);
    }
  }
  return sources;
};

const isSerializableParameter = (value: unknown) =>
  typeof value === "number" ||
  typeof value === "boolean" ||
  typeof value === "string";

/** Map the Pipeline9 naming (traceWidth/obstacleMargin) onto A-series props. */
export function getPipelineOverrides(
  record: DatasetRecord,
  solverKey: SolverKey,
): JsonObject {
  const sources = collectParameterSources(record.solverParameters, solverKey);
  const result: JsonObject = {};

  for (const targetKey of SOLVER_PARAMETER_KEYS[solverKey]) {
    const aliases = SHARED_ALIASES[targetKey] ?? [targetKey];
    for (const source of sources) {
      for (const alias of aliases) {
        const value = source[alias];
        if (targetKey === "hyperParameters" && isObject(value)) {
          result[targetKey] = { ...value };
        } else if (isSerializableParameter(value)) {
          result[targetKey] = value;
        }
      }
    }
  }

  // Pipeline9's grow-shrink portfolio instantiated A01 and A03 with a 0.1 mm
  // trace margin. obstacleMargin describes board-obstacle clearance and is not
  // the A-series traceMargin for those exact solver configurations.
  if (solverKey === "a01") {
    result.traceMargin = 0.1;
  }
  if (solverKey === "a03") {
    result.traceMargin = 0.1;
    result.traceThickness = 0.1;
  }

  return result;
}

export function getEffectiveSolverSettings({
  record,
  solverKey,
  settingsMode,
  a01ShuffleSeed,
}: Omit<SolverWorkbenchProps, "maxIterations">): JsonObject {
  const pipelineOverrides =
    settingsMode === "pipeline9" ? getPipelineOverrides(record, solverKey) : {};
  const effective: JsonObject = {
    ...SOLVER_DEFAULTS[solverKey],
    ...pipelineOverrides,
  };

  if (solverKey === "a01") {
    const existingHyperParameters = isObject(effective.hyperParameters)
      ? effective.hyperParameters
      : {};
    effective.hyperParameters = {
      ...existingHyperParameters,
      shuffleSeed: a01ShuffleSeed,
    };
  }

  return effective;
}

const cloneNode = (record: DatasetRecord) =>
  structuredClone(record.nodeWithPortPoints);

function prepareSolver<TSolver extends BaseSolver>(
  solver: TSolver,
  maxIterations: number,
) {
  solver.MAX_ITERATIONS = maxIterations;
  solver.setup();
  return solver;
}

function createSolver(props: SolverWorkbenchProps): BaseSolver {
  const settings = getEffectiveSolverSettings(props);
  const nodeWithPortPoints = cloneNode(props.record);
  const constructorProps = { ...settings, nodeWithPortPoints };

  switch (props.solverKey) {
    case "a01":
      return prepareSolver(
        new HighDensitySolverA01(
          constructorProps as ConstructorParameters<
            typeof HighDensitySolverA01
          >[0],
        ),
        props.maxIterations,
      );
    case "a02":
      return prepareSolver(
        new HighDensitySolverA02(
          constructorProps as ConstructorParameters<
            typeof HighDensitySolverA02
          >[0],
        ),
        props.maxIterations,
      );
    case "a03":
      return prepareSolver(
        new HighDensitySolverA03(
          constructorProps as ConstructorParameters<
            typeof HighDensitySolverA03
          >[0],
        ),
        props.maxIterations,
      );
    case "a05":
      return prepareSolver(
        new HighDensitySolverA05(
          constructorProps as ConstructorParameters<
            typeof HighDensitySolverA05
          >[0],
        ),
        props.maxIterations,
      );
    case "a08":
      return prepareSolver(
        new HighDensitySolverA08(
          constructorProps as ConstructorParameters<
            typeof HighDensitySolverA08
          >[0],
        ),
        props.maxIterations,
      );
    case "a09":
      return prepareSolver(
        new HighDensitySolverA09(
          constructorProps as ConstructorParameters<
            typeof HighDensitySolverA09
          >[0],
        ),
        props.maxIterations,
      );
  }
}

class SolverErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Solver debugger failed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="solver-error" role="alert">
          <span className="solver-error__eyebrow">Solver setup failed</span>
          <strong>{this.state.error.message}</strong>
          <p>
            Try another solver or switch parameter modes. The source record is
            still available in the JSON tab.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SolverWorkbench(props: SolverWorkbenchProps) {
  const debugKey = [
    props.record.id,
    props.solverKey,
    props.settingsMode,
    props.maxIterations,
    props.a01ShuffleSeed,
  ].join(":");

  return (
    <SolverErrorBoundary key={debugKey}>
      <div className="generic-debugger-shell">
        <GenericSolverDebugger
          key={debugKey}
          createSolver={() => createSolver(props)}
          animationSpeed={25}
        />
      </div>
    </SolverErrorBoundary>
  );
}
