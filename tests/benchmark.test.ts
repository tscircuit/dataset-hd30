import { expect, test } from "bun:test";
import type {
  HighDensityIntraNodeRoute,
  PortPoint,
} from "@tscircuit/high-density-a01";
import { parseBenchmarkArgs } from "../scripts/benchmark-cli";
import { getPhysicalCoverage } from "../scripts/benchmark-validation";
import type { DatasetNode } from "../src/types";

const firstStart: PortPoint = {
  portPointId: "a",
  connectionName: "net_mst1",
  rootConnectionName: "root_net",
  x: 0,
  y: 0,
  z: 0,
};
const firstEnd: PortPoint = {
  portPointId: "b",
  connectionName: "net_mst1",
  rootConnectionName: "root_net",
  x: 1,
  y: 0,
  z: 0,
};
const aliasStart: PortPoint = {
  ...firstStart,
  connectionName: "net_mst2",
};
const aliasEnd: PortPoint = {
  ...firstEnd,
  connectionName: "net_mst2",
};

const node: DatasetNode = {
  capacityMeshNodeId: "duplicate-mst-alias",
  center: { x: 0.5, y: 0 },
  width: 1,
  height: 1,
  portPoints: [firstStart, firstEnd, aliasStart, aliasEnd],
  portPointsInPairs: [
    [firstStart, firstEnd],
    [aliasStart, aliasEnd],
  ],
};

const route: HighDensityIntraNodeRoute = {
  connectionName: "net_mst1",
  rootConnectionName: "root_net",
  traceThickness: 0.1,
  viaDiameter: 0.3,
  route: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ],
  vias: [],
};

test("benchmark CLI defaults to the native-bound A11/A12 comparison", () => {
  expect(parseBenchmarkArgs([])).toEqual({
    solverKeys: ["a11", "a12"],
    settingsMode: "pipeline9",
    maxIterations: 100_000,
    seed: 0,
    help: false,
  });
  expect(
    parseBenchmarkArgs(["--solver", "A11,A12", "--limit=20"]).solverKeys,
  ).toEqual(["a11", "a12"]);
});

test("physical coverage collapses duplicate MST aliases but rejects duplicate routes", () => {
  expect(getPhysicalCoverage(node, [route])).toEqual({
    valid: true,
    expectedPairCount: 1,
    routedPairCount: 1,
    duplicateRouteCount: 0,
    missingPairKeys: [],
    unexpectedPairKeys: [],
  });

  expect(getPhysicalCoverage(node, [route, route])).toMatchObject({
    valid: false,
    expectedPairCount: 1,
    routedPairCount: 1,
    duplicateRouteCount: 1,
  });
});
