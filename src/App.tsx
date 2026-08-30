import { useEffect, useMemo, useState } from "react";
import {
  getRecordDownloadUrl,
  loadManifest,
  loadRecord,
  stringifyJson,
} from "./data";
import {
  getEffectiveSolverSettings,
  getPipelineOverrides,
  SolverWorkbench,
} from "./SolverWorkbench";
import type {
  DatasetManifest,
  DatasetRecord,
  ManifestEntry,
  RecordView,
  SettingsMode,
  SolverKey,
} from "./types";
import {
  isRecordView,
  isSettingsMode,
  isSolverKey,
  SOLVER_OPTIONS,
} from "./types";

const ITERATION_OPTIONS = [100_000, 500_000, 2_000_000, 10_000_000];

type JsonSection =
  | "record"
  | "node"
  | "growth"
  | "parameters"
  | "environment"
  | "routes"
  | "obstacles";

type UrlState = {
  nodeId: string | null;
  solverKey: SolverKey;
  settingsMode: SettingsMode;
  maxIterations: number;
  a01ShuffleSeed: number;
  view: RecordView;
};

const readUrlState = (): UrlState => {
  const params = new URLSearchParams(window.location.search);
  const solver = params.get("solver");
  const settings = params.get("settings");
  const view = params.get("view");
  const iterations = Number(params.get("iterations"));
  const seed = Number(params.get("seed"));

  return {
    nodeId: params.get("node") ?? params.get("record"),
    solverKey: isSolverKey(solver) ? solver : "a03",
    settingsMode: isSettingsMode(settings) ? settings : "defaults",
    maxIterations:
      Number.isFinite(iterations) && iterations > 0
        ? Math.min(10_000_000, Math.round(iterations))
        : 2_000_000,
    a01ShuffleSeed: Number.isFinite(seed) && seed >= 0 ? Math.floor(seed) : 0,
    view: isRecordView(view) ? view : "debugger",
  };
};

const updateUrl = (values: Record<string, string | number | null>) => {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, String(value));
  }
  window.history.replaceState({}, "", url);
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const compactValue = (value: unknown) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return stringifyJson(value).replace(/\s+/g, " ").slice(0, 120);
};

const firstPrimitive = (
  object: Record<string, unknown>,
  keys: string[],
): string | number | undefined => {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string" || typeof value === "number") return value;
  }
};

const sourceLabel = (source: unknown) => {
  if (typeof source === "string") return source;
  if (!isObject(source)) return "dataset-srj18 · Pipeline9";
  const dataset = firstPrimitive(source, ["dataset", "datasetId", "name"]);
  const circuit = firstPrimitive(source, [
    "circuit",
    "circuitId",
    "scenarioName",
    "sample",
    "sampleId",
    "sampleNumber",
  ]);
  const parts = [dataset, circuit].filter(
    (value): value is string | number => value !== undefined,
  );
  return parts.length > 0 ? parts.join(" · ") : compactValue(source);
};

const growthLabel = (growth: unknown, compact = false) => {
  if (typeof growth === "string" || typeof growth === "number") {
    return String(growth);
  }
  if (Array.isArray(growth)) {
    return `${growth.length} growth ${growth.length === 1 ? "step" : "steps"}`;
  }
  if (!isObject(growth)) return "grew to solve";

  const attempts = firstPrimitive(growth, [
    "attempts",
    "growthAttempts",
    "growCount",
    "attempt",
  ]);
  const scale = firstPrimitive(growth, [
    "scale",
    "scaleFactor",
    "growthFactor",
  ]);
  const solvedScale = firstPrimitive(growth, ["solvedScaleFactor"]) ?? scale;
  const fromWidth = firstPrimitive(growth, [
    "originalWidth",
    "initialWidth",
    "widthBefore",
  ]);
  const fromHeight = firstPrimitive(growth, [
    "originalHeight",
    "initialHeight",
    "heightBefore",
  ]);
  const toWidth = firstPrimitive(growth, [
    "grownWidth",
    "finalWidth",
    "widthAfter",
    "width",
  ]);
  const toHeight = firstPrimitive(growth, [
    "grownHeight",
    "finalHeight",
    "heightAfter",
    "height",
  ]);

  if (
    fromWidth !== undefined &&
    fromHeight !== undefined &&
    toWidth !== undefined &&
    toHeight !== undefined
  ) {
    return compact
      ? `${fromWidth}×${fromHeight} → ${toWidth}×${toHeight}`
      : `Bounds grew from ${fromWidth} × ${fromHeight} mm to ${toWidth} × ${toHeight} mm`;
  }
  if (attempts !== undefined && solvedScale !== undefined) {
    const attemptLabel = Number(attempts) === 1 ? "attempt" : "attempts";
    return compact
      ? `${attempts} ${attemptLabel} · ${solvedScale}× bounds`
      : `${attempts} growth ${attemptLabel} · solved at ${solvedScale}× bounds`;
  }
  if (solvedScale !== undefined) return `${solvedScale}× bounds`;
  if (attempts !== undefined) {
    return `${attempts} growth ${Number(attempts) === 1 ? "attempt" : "attempts"}`;
  }

  const summary = Object.entries(growth)
    .filter(([, value]) =>
      ["string", "number", "boolean"].includes(typeof value),
    )
    .slice(0, compact ? 1 : 3)
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(" · ");
  return summary || "grew to solve";
};

const entrySearchText = (entry: ManifestEntry) =>
  [entry.id, sourceLabel(entry.source), compactValue(entry.growth)]
    .join(" ")
    .toLowerCase();

const formatCount = (value: number) => new Intl.NumberFormat().format(value);

const formatDimension = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value);

const formatIterations = (value: number) => {
  if (value >= 1_000_000) return `${value / 1_000_000}m`;
  if (value >= 1_000) return `${value / 1_000}k`;
  return String(value);
};

function DatasetMark() {
  return (
    <span className="dataset-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <div className="center-state" role="status">
      <DatasetMark />
      <span className="loading-pulse" />
      <p>{label}</p>
    </div>
  );
}

function ErrorScreen({ error }: { error: Error }) {
  return (
    <div className="center-state center-state--error" role="alert">
      <DatasetMark />
      <span className="eyebrow">Dataset unavailable</span>
      <h1>Couldn’t open dataset-hd30</h1>
      <p>{error.message}</p>
      <small>
        The deployment expects <code>manifest.json</code> and the referenced
        files under <code>nodes/</code>.
      </small>
    </div>
  );
}

function RecordMetrics({ record }: { record: DatasetRecord }) {
  const node = record.nodeWithPortPoints;
  const nets = new Set(
    node.portPoints.map(
      (point) => point.rootConnectionName ?? point.connectionName,
    ),
  ).size;
  const layers = new Set(
    node.availableZ ?? node.portPoints.map((point) => point.z),
  ).size;
  const environment = isObject(record.environment) ? record.environment : {};
  const originalObstacleCount =
    typeof environment.originalObstacleCount === "number"
      ? environment.originalObstacleCount
      : undefined;
  const obstaclesOmitted = environment.obstaclePayloadOmitted === true;

  const metrics = [
    { label: "Ports", value: formatCount(node.portPoints.length) },
    { label: "Nets", value: formatCount(nets) },
    { label: "Layers", value: formatCount(layers) },
    {
      label: "Bounds",
      value: `${formatDimension(node.width)} × ${formatDimension(node.height)} mm`,
    },
    {
      label: "Pipeline9 routes",
      value: record.pipeline9Routes
        ? formatCount(record.pipeline9Routes.length)
        : "Not stored",
    },
    {
      label:
        originalObstacleCount !== undefined
          ? "Original obstacles"
          : "Obstacle payload",
      value:
        originalObstacleCount !== undefined
          ? `${formatCount(originalObstacleCount)}${
              obstaclesOmitted ? " · payload omitted" : ""
            }`
          : record.obstacles
            ? formatCount(record.obstacles.length)
            : "Not stored",
    },
  ];

  return (
    <div className="metric-grid">
      {metrics.map((metric) => (
        <div className="metric" key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DatasetSidebar({
  manifest,
  selectedId,
  onSelect,
}: {
  manifest: DatasetManifest;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return manifest.entries;
    return manifest.entries.filter((entry) =>
      entrySearchText(entry).includes(normalizedQuery),
    );
  }, [manifest.entries, query]);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <DatasetMark />
        <div>
          <strong>dataset-hd30</strong>
          <span>Growth cases · Pipeline9</span>
        </div>
      </div>

      <label className="search-field">
        <span aria-hidden="true">⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search nodes"
          aria-label="Search nodes"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Clear">
            ×
          </button>
        )}
      </label>

      <div className="sidebar__count">
        <span>{filtered.length} nodes</span>
        <span>SRJ18</span>
      </div>

      <nav className="record-list" aria-label="Dataset nodes">
        {filtered.map((entry, index) => (
          <button
            type="button"
            key={entry.id}
            className={`record-list__item ${
              entry.id === selectedId ? "is-selected" : ""
            }`}
            onClick={() => onSelect(entry.id)}
            aria-current={entry.id === selectedId ? "page" : undefined}
          >
            <span className="record-list__index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="record-list__copy">
              <strong>{entry.id}</strong>
              <small>{growthLabel(entry.growth, true)}</small>
            </span>
            <span className="record-list__arrow">›</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty-list">No nodes match “{query}”.</div>
        )}
      </nav>

      <div className="sidebar__footer">
        <span className="status-dot" />
        <span>Viewer solver suite pinned</span>
        <a
          href="https://github.com/tscircuit/high-density-a01/commit/2086e5b5019fd01f2dad1c0a7b25fb32eecb60da"
          target="_blank"
          rel="noreferrer"
        >
          2086e5b ↗
        </a>
      </div>
    </aside>
  );
}

function SolverControls({
  record,
  solverKey,
  settingsMode,
  maxIterations,
  a01ShuffleSeed,
  onSolverChange,
  onSettingsChange,
  onIterationsChange,
  onSeedChange,
}: {
  record: DatasetRecord;
  solverKey: SolverKey;
  settingsMode: SettingsMode;
  maxIterations: number;
  a01ShuffleSeed: number;
  onSolverChange: (solver: SolverKey) => void;
  onSettingsChange: (settings: SettingsMode) => void;
  onIterationsChange: (iterations: number) => void;
  onSeedChange: (seed: number) => void;
}) {
  const pipelineOverrides = getPipelineOverrides(record, solverKey);
  const effectiveSettings = getEffectiveSolverSettings({
    record,
    solverKey,
    settingsMode,
    a01ShuffleSeed,
  });

  return (
    <section className="control-panel" aria-label="Solver controls">
      <div className="control-panel__field">
        <label htmlFor="solver">Solver</label>
        <select
          id="solver"
          value={solverKey}
          onChange={(event) =>
            onSolverChange(event.currentTarget.value as SolverKey)
          }
        >
          {SOLVER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="control-panel__field control-panel__field--wide">
        <legend>Parameters</legend>
        <div className="segmented-control">
          <button
            type="button"
            className={settingsMode === "defaults" ? "is-active" : ""}
            onClick={() => onSettingsChange("defaults")}
          >
            A-series defaults
          </button>
          <button
            type="button"
            className={settingsMode === "pipeline9" ? "is-active" : ""}
            onClick={() => onSettingsChange("pipeline9")}
            title={
              Object.keys(pipelineOverrides).length === 0
                ? "No compatible Pipeline9 overrides were stored"
                : undefined
            }
          >
            Pipeline9 values
          </button>
        </div>
        <small className="parameter-note">
          {settingsMode === "pipeline9"
            ? solverKey === "a12"
              ? "Pipeline9 copper values · fine perimeter + coarse middle"
              : solverKey === "a11"
                ? "Pipeline9 copper values · derived 0.05 mm grid"
                : solverKey === "a01" || solverKey === "a03"
                  ? "Exact Pipeline9 A-series values"
                  : "Mapped from stored Pipeline9 values"
            : "Pinned package defaults"}
        </small>
      </fieldset>

      <div className="control-panel__field">
        <label htmlFor="iterations">Iteration cap</label>
        <select
          id="iterations"
          value={maxIterations}
          onChange={(event) =>
            onIterationsChange(Number(event.currentTarget.value))
          }
        >
          {ITERATION_OPTIONS.map((value) => (
            <option value={value} key={value}>
              {formatIterations(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="control-panel__field">
        <label htmlFor="shuffle-seed">A01 / A11 / A12 shuffle seed</label>
        <input
          id="shuffle-seed"
          type="number"
          min={0}
          step={1}
          value={a01ShuffleSeed}
          disabled={
            solverKey !== "a01" && solverKey !== "a11" && solverKey !== "a12"
          }
          onChange={(event) =>
            onSeedChange(
              Math.max(0, Math.floor(Number(event.currentTarget.value))),
            )
          }
        />
      </div>

      <details className="effective-settings">
        <summary>Effective settings</summary>
        <pre>{stringifyJson(effectiveSettings)}</pre>
      </details>
    </section>
  );
}

function RawJsonPanel({ record }: { record: DatasetRecord }) {
  const [section, setSection] = useState<JsonSection>("record");
  const [copied, setCopied] = useState(false);
  const sections: Array<{ value: JsonSection; label: string; count?: number }> =
    [
      { value: "record", label: "Full record" },
      { value: "node", label: "Node" },
      { value: "growth", label: "Growth" },
      { value: "parameters", label: "Parameters" },
      { value: "environment", label: "Environment" },
      {
        value: "routes",
        label: "Routes",
        count: record.pipeline9Routes?.length ?? 0,
      },
      {
        value: "obstacles",
        label: "Obstacles",
        count: record.obstacles?.length ?? 0,
      },
    ];
  const valueBySection: Record<JsonSection, unknown> = {
    record,
    node: record.nodeWithPortPoints,
    growth: record.growth,
    parameters: record.solverParameters,
    environment: record.environment ?? null,
    routes: record.pipeline9Routes ?? [],
    obstacles: record.obstacles ?? [],
  };
  const json = stringifyJson(valueBySection[section]);

  const copyJson = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  };

  return (
    <section className="json-panel">
      <div className="json-panel__sidebar">
        {sections.map((option) => (
          <button
            type="button"
            className={section === option.value ? "is-active" : ""}
            onClick={() => setSection(option.value)}
            key={option.value}
          >
            <span>{option.label}</span>
            {option.count !== undefined && <small>{option.count}</small>}
          </button>
        ))}
      </div>
      <div className="json-panel__code">
        <div className="json-panel__toolbar">
          <span>{section}.json</span>
          <button type="button" onClick={copyJson}>
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
        <pre>{json}</pre>
      </div>
    </section>
  );
}

function RecordPage({
  manifest,
  entry,
  record,
  recordIndex,
  solverKey,
  settingsMode,
  maxIterations,
  a01ShuffleSeed,
  view,
  onSelect,
  onSolverChange,
  onSettingsChange,
  onIterationsChange,
  onSeedChange,
  onViewChange,
}: {
  manifest: DatasetManifest;
  entry: ManifestEntry;
  record: DatasetRecord;
  recordIndex: number;
  solverKey: SolverKey;
  settingsMode: SettingsMode;
  maxIterations: number;
  a01ShuffleSeed: number;
  view: RecordView;
  onSelect: (id: string) => void;
  onSolverChange: (solver: SolverKey) => void;
  onSettingsChange: (settings: SettingsMode) => void;
  onIterationsChange: (iterations: number) => void;
  onSeedChange: (seed: number) => void;
  onViewChange: (view: RecordView) => void;
}) {
  const [linkCopied, setLinkCopied] = useState(false);
  const previous = manifest.entries[recordIndex - 1];
  const next = manifest.entries[recordIndex + 1];
  const environment = isObject(record.environment) ? record.environment : {};
  const originalObstacleCount =
    typeof environment.originalObstacleCount === "number"
      ? environment.originalObstacleCount
      : record.obstacles?.length;
  const obstaclesOmitted = environment.obstaclePayloadOmitted === true;

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1_500);
  };

  return (
    <main className="main-content">
      <div className="page-toolbar">
        <div className="breadcrumbs">
          <span>tscircuit</span>
          <b>/</b>
          <span>dataset-hd30</span>
          <b>/</b>
          <strong>{record.id}</strong>
        </div>
        <div className="page-toolbar__actions">
          <button type="button" onClick={copyLink}>
            {linkCopied ? "Link copied" : "Copy deep link"}
          </button>
          <a href={getRecordDownloadUrl(entry)} download>
            Download JSON ↓
          </a>
        </div>
      </div>

      <header className="record-header">
        <div>
          <span className="eyebrow">
            Growth case {String(recordIndex + 1).padStart(2, "0")}
          </span>
          <h1>{record.id}</h1>
          <p>
            <span>{sourceLabel(record.source)}</span>
            <i />
            <span>{growthLabel(record.growth)}</span>
          </p>
        </div>
        <div className="record-pagination" aria-label="Record navigation">
          <button
            type="button"
            disabled={!previous}
            onClick={() => previous && onSelect(previous.id)}
            aria-label="Previous node"
          >
            ←
          </button>
          <span>
            {recordIndex + 1} / {manifest.entries.length}
          </span>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && onSelect(next.id)}
            aria-label="Next node"
          >
            →
          </button>
        </div>
      </header>

      <RecordMetrics record={record} />

      <SolverControls
        record={record}
        solverKey={solverKey}
        settingsMode={settingsMode}
        maxIterations={maxIterations}
        a01ShuffleSeed={a01ShuffleSeed}
        onSolverChange={onSolverChange}
        onSettingsChange={onSettingsChange}
        onIterationsChange={onIterationsChange}
        onSeedChange={onSeedChange}
      />

      <div className="view-tabs" role="tablist" aria-label="Node view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "debugger"}
          className={view === "debugger" ? "is-active" : ""}
          onClick={() => onViewChange("debugger")}
        >
          Solver debugger
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "json"}
          className={view === "json" ? "is-active" : ""}
          onClick={() => onViewChange("json")}
        >
          Record data
        </button>
      </div>

      {view === "debugger" ? (
        <section className="debugger-card" role="tabpanel">
          {((originalObstacleCount ?? 0) > 0 || obstaclesOmitted) && (
            <div className="context-notice">
              <span>Context</span>
              <p>
                {originalObstacleCount !== undefined
                  ? `The Pipeline9 board had ${formatCount(originalObstacleCount)}${
                      obstaclesOmitted
                        ? " obstacles (payload intentionally omitted)"
                        : " stored obstacles"
                    }.`
                  : "The Pipeline9 board obstacle payload was intentionally omitted."}{" "}
                The A-series suite consumes this zero-obstacle
                NodeWithPortPoints problem, so board obstacles are not injected
                into these solver constructors.
              </p>
            </div>
          )}
          <SolverWorkbench
            record={record}
            solverKey={solverKey}
            settingsMode={settingsMode}
            maxIterations={maxIterations}
            a01ShuffleSeed={a01ShuffleSeed}
          />
        </section>
      ) : (
        <RawJsonPanel record={record} />
      )}
    </main>
  );
}

export default function App() {
  const initialUrlState = useMemo(readUrlState, []);
  const [manifest, setManifest] = useState<DatasetManifest | null>(null);
  const [manifestError, setManifestError] = useState<Error | null>(null);
  const [selectedId, setSelectedId] = useState(initialUrlState.nodeId ?? "");
  const [solverKey, setSolverKey] = useState(initialUrlState.solverKey);
  const [settingsMode, setSettingsMode] = useState(
    initialUrlState.settingsMode,
  );
  const [maxIterations, setMaxIterations] = useState(
    initialUrlState.maxIterations,
  );
  const [a01ShuffleSeed, setA01ShuffleSeed] = useState(
    initialUrlState.a01ShuffleSeed,
  );
  const [view, setView] = useState(initialUrlState.view);
  const [record, setRecord] = useState<DatasetRecord | null>(null);
  const [recordError, setRecordError] = useState<Error | null>(null);

  useEffect(() => {
    loadManifest()
      .then(setManifest)
      .catch((error: unknown) => {
        setManifestError(
          error instanceof Error ? error : new Error(String(error)),
        );
      });
  }, []);

  useEffect(() => {
    if (!manifest) return;
    const requestedEntry = manifest.entries.find(
      (entry) => entry.id === selectedId,
    );
    if (requestedEntry) return;

    const firstEntry = manifest.entries[0];
    if (!firstEntry) return;
    setSelectedId(firstEntry.id);
    updateUrl({ node: firstEntry.id, record: null });
  }, [manifest, selectedId]);

  const selectedEntry = useMemo(
    () => manifest?.entries.find((entry) => entry.id === selectedId) ?? null,
    [manifest, selectedId],
  );

  useEffect(() => {
    if (!selectedEntry) return;
    let active = true;
    setRecord(null);
    setRecordError(null);
    loadRecord(selectedEntry)
      .then((nextRecord) => {
        if (active) setRecord(nextRecord);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRecordError(
          error instanceof Error ? error : new Error(String(error)),
        );
      });
    return () => {
      active = false;
    };
  }, [selectedEntry]);

  useEffect(() => {
    const onPopState = () => {
      const next = readUrlState();
      if (next.nodeId) setSelectedId(next.nodeId);
      setSolverKey(next.solverKey);
      setSettingsMode(next.settingsMode);
      setMaxIterations(next.maxIterations);
      setA01ShuffleSeed(next.a01ShuffleSeed);
      setView(next.view);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  if (manifestError) return <ErrorScreen error={manifestError} />;
  if (!manifest) return <LoadingScreen label="Loading growth cases…" />;

  const selectNode = (id: string) => {
    setSelectedId(id);
    updateUrl({ node: id, record: null });
  };
  const changeSolver = (solver: SolverKey) => {
    setSolverKey(solver);
    updateUrl({ solver });
  };
  const changeSettings = (settings: SettingsMode) => {
    setSettingsMode(settings);
    updateUrl({ settings });
  };
  const changeIterations = (iterations: number) => {
    setMaxIterations(iterations);
    updateUrl({ iterations });
  };
  const changeSeed = (seed: number) => {
    const safeSeed = Number.isFinite(seed) ? seed : 0;
    setA01ShuffleSeed(safeSeed);
    updateUrl({ seed: safeSeed });
  };
  const changeView = (nextView: RecordView) => {
    setView(nextView);
    updateUrl({ view: nextView });
  };

  return (
    <div className="app-shell">
      <DatasetSidebar
        manifest={manifest}
        selectedId={selectedId}
        onSelect={selectNode}
      />
      {recordError ? (
        <ErrorScreen error={recordError} />
      ) : !record || !selectedEntry ? (
        <LoadingScreen label={`Loading ${selectedId || "node"}…`} />
      ) : (
        <RecordPage
          manifest={manifest}
          entry={selectedEntry}
          record={record}
          recordIndex={manifest.entries.indexOf(selectedEntry)}
          solverKey={solverKey}
          settingsMode={settingsMode}
          maxIterations={maxIterations}
          a01ShuffleSeed={a01ShuffleSeed}
          view={view}
          onSelect={selectNode}
          onSolverChange={changeSolver}
          onSettingsChange={changeSettings}
          onIterationsChange={changeIterations}
          onSeedChange={changeSeed}
          onViewChange={changeView}
        />
      )}
    </div>
  );
}
