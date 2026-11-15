import {
  BENCHMARK_HELP,
  parseBenchmarkArgs,
} from "./benchmark-cli";
import { runBenchmark } from "./benchmark-runner";

async function main() {
  const options = parseBenchmarkArgs(process.argv.slice(2));
  if (options.help) {
    console.log(BENCHMARK_HELP);
    return;
  }
  await runBenchmark(options);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Benchmark failed: ${message}`);
  process.exitCode = 1;
});
