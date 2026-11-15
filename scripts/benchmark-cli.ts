import { isSettingsMode, isSolverKey } from "../src/types";
import type { SolverKey } from "../src/types";
import type { BenchmarkOptions } from "./benchmark-types";

const DEFAULT_SOLVERS: SolverKey[] = ["a11", "a12"];

export const BENCHMARK_HELP = `
Usage: ./benchmark.sh [options]

Runs HD solvers on the canonical HD30 nodes at their original bounds. A result
is valid only when the solver finishes, exact geometry checks pass, and every
unique physical port pair is routed exactly once.

Options:
  --solver LIST         Comma-separated solvers (default: A11,A12)
  --limit N             Run only the first N nodes
  --sample NUM          Run one node by 1-based manifest position
  --settings MODE       pipeline9 or defaults (default: pipeline9)
  --max-iterations N    Per-solver iteration cap (default: 100000)
  --seed N              Shuffle seed for A01-family solvers (default: 0)
  --help, -h            Show this help message

Examples:
  ./benchmark.sh
  ./benchmark.sh --limit 20
  ./benchmark.sh --sample 4 --solver A11,A12
`.trim();

const parseInteger = (value: string, optionName: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer`);
  }
  return parsed;
};

const parseSeed = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("--seed must be a non-negative integer");
  }
  return parsed;
};

const parseSolvers = (value: string): SolverKey[] => {
  const result: SolverKey[] = [];
  for (const token of value.split(",")) {
    const solverKey = token.trim().toLowerCase();
    if (!isSolverKey(solverKey)) {
      throw new Error(`Unknown solver: ${token.trim() || "(empty)"}`);
    }
    if (!result.includes(solverKey)) result.push(solverKey);
  }
  if (result.length === 0) {
    throw new Error("--solver must include at least one solver");
  }
  return result;
};

const readOptionValue = (args: string[], index: number) => {
  const value = args[index + 1];
  if (value === undefined) {
    throw new Error(`Missing value for ${args[index]}`);
  }
  return value;
};

export function parseBenchmarkArgs(args: string[]): BenchmarkOptions {
  const options: BenchmarkOptions = {
    solverKeys: [...DEFAULT_SOLVERS],
    settingsMode: "pipeline9",
    maxIterations: 100_000,
    seed: 0,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    const [name, inlineValue] = argument.split("=", 2);
    const getValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = readOptionValue(args, index);
      index += 1;
      return value;
    };

    switch (name) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--solver":
        options.solverKeys = parseSolvers(getValue());
        break;
      case "--limit":
        options.limit = parseInteger(getValue(), "--limit");
        break;
      case "--sample":
        options.sample = parseInteger(getValue(), "--sample");
        break;
      case "--settings": {
        const value = getValue();
        if (!isSettingsMode(value)) {
          throw new Error(`Unknown settings mode: ${value}`);
        }
        options.settingsMode = value;
        break;
      }
      case "--max-iterations":
        options.maxIterations = parseInteger(
          getValue(),
          "--max-iterations",
        );
        break;
      case "--seed":
        options.seed = parseSeed(getValue());
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (options.limit !== undefined && options.sample !== undefined) {
    throw new Error("--limit and --sample cannot be used together");
  }
  return options;
}
