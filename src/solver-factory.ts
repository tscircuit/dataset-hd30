import {
  HighDensitySolverA01,
  HighDensitySolverA02,
  HighDensitySolverA03,
  HighDensitySolverA05,
  HighDensitySolverA08,
  HighDensitySolverA09,
  HighDensitySolverA11,
  HighDensitySolverA12,
} from "@tscircuit/high-density-a01";
import type { BaseSolver } from "@tscircuit/solver-utils";
import { SOLVER_DEFAULTS } from "./solver-defaults";
import type {
  DatasetRecord,
  JsonObject,
  SettingsMode,
  SolverKey,
} from "./types";

export type SolverFactoryProps = {
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
  a11: [...Object.keys(SHARED_ALIASES), "hyperParameters"],
  a12: [
    "fineGridCellThickness",
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
  if (solverKey === "a11") {
    solverAliases.push(
      "a01",
      "A01",
      "HighDensitySolverA01",
      "HighDensitySolverA11",
    );
  }
  if (solverKey === "a12") {
    solverAliases.push("a03", "A03", "HighDensitySolverA03");
  }
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

  // Pipeline9 instantiated these solvers with a 0.1 mm trace margin.
  // obstacleMargin describes board-obstacle clearance, not this value.
  if (
    solverKey === "a01" ||
    solverKey === "a11" ||
    solverKey === "a12"
  ) {
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
}: Omit<SolverFactoryProps, "maxIterations">): JsonObject {
  const pipelineOverrides =
    settingsMode === "pipeline9" ? getPipelineOverrides(record, solverKey) : {};
  const effective: JsonObject = {
    ...SOLVER_DEFAULTS[solverKey],
    ...pipelineOverrides,
  };

  if (
    solverKey === "a01" ||
    solverKey === "a11" ||
    solverKey === "a12"
  ) {
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

function prepareSolver<TSolver extends BaseSolver>(
  solver: TSolver,
  maxIterations: number,
) {
  solver.MAX_ITERATIONS = maxIterations;
  solver.setup();
  return solver;
}

export function createSolver(props: SolverFactoryProps): BaseSolver {
  const settings = getEffectiveSolverSettings(props);
  const nodeWithPortPoints = structuredClone(props.record.nodeWithPortPoints);
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
    case "a11":
      return prepareSolver(
        new HighDensitySolverA11(
          constructorProps as ConstructorParameters<
            typeof HighDensitySolverA11
          >[0],
        ),
        props.maxIterations,
      );
    case "a12":
      return prepareSolver(
        new HighDensitySolverA12(
          constructorProps as ConstructorParameters<
            typeof HighDensitySolverA12
          >[0],
        ),
        props.maxIterations,
      );
  }
}
