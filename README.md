# dataset-hd30

The historical SRJ18 / Pipeline 9 grow-shrink problem set from
[`tscircuit/tscircuit-autorouter` PR #2286](https://github.com/tscircuit/tscircuit-autorouter/pull/2286).

The repository contains **27 distinct regular-node inputs** that account for
the benchmark's **28 growth attempts**. Twenty-six nodes solved after growing
to 2× bounds; `sample002-cmn_4__sub_2_0` needed a second growth and solved at
4× bounds.

## Explore the nodes

Open the deployed viewer at **[dataset-hd30.vercel.app](https://dataset-hd30.vercel.app)**.

```sh
bun install
bun run dev
```

The viewer loads each node into
[`GenericSolverDebugger`](https://github.com/tscircuit/solver-utils) and can
run the complete current `high-density-a01` A-series suite:

- `HighDensitySolverA01`
- `HighDensitySolverA02`
- `HighDensitySolverA03`
- `HighDensitySolverA05`
- `HighDensitySolverA08`
- `HighDensitySolverA09`
- `HighDensitySolverA11`
- `HighDensitySolverA12`

You can switch between package defaults and Pipeline 9-compatible settings,
set the iteration cap, control A01/A11/A12's shuffle seed, inspect the raw data,
and copy a deep link to any solver/node combination.

The viewer pins `high-density-a01` commit
`2086e5b5019fd01f2dad1c0a7b25fb32eecb60da` and
`@tscircuit/solver-utils@0.0.21`.

Choose **A11** with **Pipeline9 values** to reproduce the first six
native-bound HD30 solves. The solver derives a 0.05 mm grid from those copper
dimensions and does not grow the node.

Choose **A12** with **Pipeline9 values** to try the mixed-resolution successor:
it keeps A11's derived fine pitch in a 16-cell perimeter band, uses a 4× coarser
middle grid, and enables diagonal moves. This cuts the aggregate HD30 graph to
44.1% of A11's search states. A12 solves eight native-bound nodes, five beyond
A11; use the two together for an 11-node native-bound portfolio.

## Dataset format

Every file under `nodes/` is a canonical, unwrapped `NodeWithPortPoints` JSON
object. It can be passed directly to an A-series solver:

```ts
import nodeWithPortPoints from "./nodes/sample002-cmn_2.json";
import { HighDensitySolverA01 } from "@tscircuit/high-density-a01";

const solver = new HighDensitySolverA01({ nodeWithPortPoints });
solver.solve();
```

`manifest.json` is the index. Each entry records the source sample and pinned
commits, growth attempts and winning historical solver, Pipeline 9 parameters,
problem metrics, discovery order, and the node file's SHA-256 digest. Node IDs
are sample-prefixed because IDs such as `cmn_3` occur in more than one circuit.

## Selection and provenance

The captured input satisfies:

```ts
solver instanceof GrowShrinkHighDensityIntraNodeSolver &&
  solver.growthAttempts > 0 &&
  solver.solved === true;
```

The JSON stores `solver.nodeWithPortPoints`, before any 2× or 4× physical
scaling. All 27 cases are ordinary/regular Pipeline 9 inputs; none are regional
fallback problems.

Pinned inputs:

- `tscircuit/tscircuit-autorouter`:
  `d1cffe72aa914ae792080a899a9e23fca1c4ca43`
- `tscircuit/dataset-srj18`:
  `c0aad90256a95256fcac814f9f7da81a82a2fdea`
- `tscircuit/high-density-a01`:
  `9a3a3dbc62d425c0459e6fc2fef7a656b448e9a0`
- `tscircuit/high-density-b01`:
  `f974f97a77f27bc32b1fe5a8b3bccb7ba023e0b7`

The original benchmark command was:

```sh
./benchmark.sh --pipeline 9 --dataset srj18 --concurrency 4
```

This dataset intentionally preserves the timeout-bounded historical result
behind PR #2286. That benchmark completed 9 of 16 samples and timed out on 7;
sample 008 therefore contains the three-node prefix observed before its
worker timed out. A cold, unbounded replay can discover additional growth
cases because the observed set depends on cache state, worker scheduling,
timeouts, and machine speed. Current autorouter `main` is also materially
different from the pinned baseline and should not be labeled as this dataset.

## Validate and build

```sh
bun run validate
bun run test
bun run typecheck
bun run build
```

The production build includes `manifest.json` and all raw node files under
`dist/`; Vercel serves that static bundle.
