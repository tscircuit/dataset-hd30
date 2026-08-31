import { GenericSolverDebugger } from "@tscircuit/solver-utils/react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  createSolver,
  type SolverFactoryProps,
} from "./solver-factory";

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

export function SolverWorkbench(props: SolverFactoryProps) {
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
