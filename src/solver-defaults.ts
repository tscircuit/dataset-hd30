import type { JsonObject, SolverKey } from "./types";

/**
 * These values reproduce lib/default-params.ts from high-density-a01 at
 * 9a3a3dbc62d425c0459e6fc2fef7a656b448e9a0. That module is intentionally not
 * exported by the package, so consumers need a local copy to construct the
 * full solver suite consistently.
 */
const defaultA01Params: JsonObject = {
  cellSizeMm: 0.1,
  traceMargin: 0.15,
  traceThickness: 0.1,
  viaDiameter: 0.3,
  viaMinDistFromBorder: 0.15,
};

const defaultA02Params: JsonObject = {
  outerGridCellSize: 0.1,
  outerGridCellThickness: 1,
  innerGridCellSize: 0.4,
  traceMargin: 0.15,
  traceThickness: 0.1,
  viaDiameter: 0.3,
  viaMinDistFromBorder: 0.15,
};

const defaultA03Params: JsonObject = {
  highResolutionCellSize: 0.1,
  highResolutionCellThickness: 8,
  lowResolutionCellSize: 0.4,
  traceMargin: 0.15,
  traceThickness: 0.1,
  viaDiameter: 0.3,
  viaMinDistFromBorder: 0.15,
};

const defaultA05Params: JsonObject = { ...defaultA03Params };

const defaultA08Params: JsonObject = {
  ...defaultA01Params,
  stepMultiplier: 1,
  showPenaltyMap: false,
  showUsedCellMap: false,
  effort: 1,
  initialRectMarginMm: 0.2,
  rectShrinkStepMm: 0.1,
  breakoutTraceMarginMm: 0.1,
  breakoutSegmentCount: 2,
  breakoutMaxIterationsPerRect: 60,
  breakoutForceStepSize: 0.2,
  breakoutRepulsionStrength: 1.8,
  breakoutSmoothingStrength: 0.16,
  breakoutAttractionStrength: 0.06,
  innerPortSpreadFactor: 1,
};

const defaultA09Params: JsonObject = {
  ...defaultA03Params,
  effort: 1,
  boundaryBonus: 0.18,
  boundaryBonusSigma: 0.22,
  portShadowStrength: 0.55,
  portShadowTangentSigma: 0.18,
  portShadowDepthSigma: 0.5,
  fullOrderSearchConnectionCountLimit: 6,
  priorityHeadSize: 4,
  maxCandidateOrders: 720,
};

export const SOLVER_DEFAULTS: Record<SolverKey, JsonObject> = {
  a01: defaultA01Params,
  a02: defaultA02Params,
  a03: defaultA03Params,
  a05: defaultA05Params,
  a08: defaultA08Params,
  a09: defaultA09Params,
};
