import type {
  HighDensityIntraNodeRoute,
  HighDensityRoutePoint,
  PortPoint,
} from "@tscircuit/high-density-a01";
import type { DatasetNode } from "../src/types";
import type {
  PhysicalCoverage,
  ValidatedRouteOutput,
} from "./benchmark-types";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRoutePoint = (value: unknown): value is HighDensityRoutePoint => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return (
    "x" in value &&
    "y" in value &&
    "z" in value &&
    isNumber(value.x) &&
    isNumber(value.y) &&
    isNumber(value.z)
  );
};

const isHighDensityRoute = (
  value: unknown,
): value is HighDensityIntraNodeRoute => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return (
    "connectionName" in value &&
    typeof value.connectionName === "string" &&
    "route" in value &&
    Array.isArray(value.route) &&
    value.route.length >= 2 &&
    value.route.every(isRoutePoint) &&
    "traceThickness" in value &&
    isNumber(value.traceThickness) &&
    "viaDiameter" in value &&
    isNumber(value.viaDiameter) &&
    "vias" in value &&
    Array.isArray(value.vias)
  );
};

const endpointKey = (point: PortPoint | HighDensityRoutePoint) =>
  `${point.x},${point.y},${point.z}`;

const physicalPairKey = (input: {
  rootConnectionName: string;
  start: PortPoint | HighDensityRoutePoint;
  end: PortPoint | HighDensityRoutePoint;
}) => {
  const endpoints = [endpointKey(input.start), endpointKey(input.end)].sort();
  return `${input.rootConnectionName}|${endpoints.join("|")}`;
};

const getExpectedPhysicalPairKeys = (node: DatasetNode) => {
  if (!node.portPointsInPairs) {
    throw new Error(
      `${node.capacityMeshNodeId} is missing canonical portPointsInPairs`,
    );
  }
  return new Set(
    node.portPointsInPairs.map(([start, end]) =>
      physicalPairKey({
        rootConnectionName:
          start.rootConnectionName ?? start.connectionName,
        start,
        end,
      }),
    ),
  );
};

export function validateRouteOutput(output: unknown): ValidatedRouteOutput {
  if (!Array.isArray(output)) {
    return { routes: [], error: "solver output was not a route array" };
  }
  if (!output.every(isHighDensityRoute)) {
    return { routes: [], error: "solver output contained a malformed route" };
  }
  return { routes: output, error: null };
}

export function getPhysicalCoverage(
  node: DatasetNode,
  routes: HighDensityIntraNodeRoute[],
): PhysicalCoverage {
  const expectedKeys = getExpectedPhysicalPairKeys(node);
  const routedKeys = new Set(
    routes.map((route) =>
      physicalPairKey({
        rootConnectionName:
          route.rootConnectionName ?? route.connectionName,
        start: route.route[0]!,
        end: route.route.at(-1)!,
      }),
    ),
  );
  const missingPairKeys = [...expectedKeys].filter(
    (key) => !routedKeys.has(key),
  );
  const unexpectedPairKeys = [...routedKeys].filter(
    (key) => !expectedKeys.has(key),
  );
  const duplicateRouteCount = routes.length - routedKeys.size;

  return {
    valid:
      missingPairKeys.length === 0 &&
      unexpectedPairKeys.length === 0 &&
      duplicateRouteCount === 0,
    expectedPairCount: expectedKeys.size,
    routedPairCount: routedKeys.size,
    duplicateRouteCount,
    missingPairKeys,
    unexpectedPairKeys,
  };
}
