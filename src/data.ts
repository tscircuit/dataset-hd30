import type {
  DatasetManifest,
  DatasetRecord,
  JsonObject,
  ManifestEntry,
} from "./types";

const recordCache = new Map<string, Promise<DatasetRecord>>();

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const datasetUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${normalizedPath}`;
};

const idFromFile = (file: string) => {
  const name = file.split("/").filter(Boolean).at(-1) ?? file;
  return name.replace(/\.json$/i, "");
};

const normalizeManifestEntry = (
  value: unknown,
  fallbackId?: string,
): ManifestEntry | null => {
  if (typeof value === "string") {
    const isFile = value.endsWith(".json") || value.includes("/");
    const id = fallbackId ?? (isFile ? idFromFile(value) : value);
    return {
      id,
      file: isFile ? value.replace(/^\/+/, "") : `nodes/${value}.json`,
    };
  }

  if (!isObject(value)) return null;

  const rawFile = value.file ?? value.path ?? value.href;
  const idCandidate =
    value.id ??
    value.nodeId ??
    value.capacityMeshNodeId ??
    fallbackId ??
    (typeof rawFile === "string" ? idFromFile(rawFile) : undefined);

  if (typeof idCandidate !== "string" && typeof idCandidate !== "number") {
    return null;
  }

  const id = String(idCandidate);
  const file =
    typeof rawFile === "string"
      ? rawFile.replace(/^\/+/, "")
      : `nodes/${id}.json`;

  return { ...value, id, file };
};

const getManifestItems = (
  raw: unknown,
): Array<[string | undefined, unknown]> => {
  if (Array.isArray(raw)) return raw.map((value) => [undefined, value]);
  if (!isObject(raw)) return [];

  const collection = raw.nodes ?? raw.records ?? raw.entries ?? raw.files;
  if (Array.isArray(collection)) {
    return collection.map((value) => [undefined, value]);
  }
  if (isObject(collection)) return Object.entries(collection);

  return [];
};

export const normalizeManifest = (raw: unknown): DatasetManifest => {
  const root = isObject(raw) ? raw : {};
  const entries = getManifestItems(raw)
    .map(([fallbackId, value]) => normalizeManifestEntry(value, fallbackId))
    .filter((value): value is ManifestEntry => value !== null);

  if (entries.length === 0) {
    throw new Error(
      "manifest.json did not contain a nodes, records, entries, or files collection",
    );
  }

  return {
    dataset:
      typeof root.dataset === "string"
        ? root.dataset
        : typeof root.name === "string"
          ? root.name
          : "dataset-hd30",
    generatedAt:
      typeof root.generatedAt === "string" ? root.generatedAt : undefined,
    source: root.source,
    entries,
    raw,
  };
};

export async function loadManifest(): Promise<DatasetManifest> {
  const response = await fetch(datasetUrl("manifest.json"), {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Unable to load manifest.json (${response.status})`);
  }
  return normalizeManifest((await response.json()) as unknown);
}

const validateRecord = (raw: unknown, entry: ManifestEntry): DatasetRecord => {
  if (!isObject(raw)) {
    throw new Error(`${entry.file} is not a JSON object`);
  }

  // The canonical dataset stores a raw NodeWithPortPoints in each nodes/*.json
  // file so it can be downloaded and passed straight to a solver. Older
  // generated revisions used a wrapper object; accepting both makes the viewer
  // useful for historical checkouts as well.
  const nodeCandidate = isObject(raw.nodeWithPortPoints)
    ? raw.nodeWithPortPoints
    : raw;
  const looksLikeNode =
    typeof nodeCandidate.capacityMeshNodeId === "string" &&
    isObject(nodeCandidate.center) &&
    typeof nodeCandidate.width === "number" &&
    typeof nodeCandidate.height === "number" &&
    Array.isArray(nodeCandidate.portPoints);

  if (!looksLikeNode) {
    throw new Error(
      `${entry.file} is neither a raw NodeWithPortPoints nor a dataset record wrapper`,
    );
  }

  const wrapper: JsonObject = raw === nodeCandidate ? {} : raw;
  const entrySolverParameters = isObject(entry.solverParameters)
    ? entry.solverParameters
    : {};
  const wrapperSolverParameters = isObject(wrapper.solverParameters)
    ? wrapper.solverParameters
    : entrySolverParameters;

  return {
    ...entry,
    ...wrapper,
    id: typeof wrapper.id === "string" ? wrapper.id : entry.id,
    source: wrapper.source ?? entry.source ?? null,
    growth: wrapper.growth ?? entry.growth ?? null,
    solverParameters: wrapperSolverParameters,
    environment: wrapper.environment ?? entry.environment ?? null,
    nodeWithPortPoints: nodeCandidate as DatasetRecord["nodeWithPortPoints"],
    pipeline9Routes: Array.isArray(wrapper.pipeline9Routes)
      ? wrapper.pipeline9Routes
      : Array.isArray(entry.pipeline9Routes)
        ? entry.pipeline9Routes
        : undefined,
    obstacles: Array.isArray(wrapper.obstacles)
      ? wrapper.obstacles
      : Array.isArray(entry.obstacles)
        ? entry.obstacles
        : undefined,
  };
};

export function loadRecord(entry: ManifestEntry): Promise<DatasetRecord> {
  const cached = recordCache.get(entry.file);
  if (cached) return cached;

  const request = fetch(datasetUrl(entry.file), { cache: "force-cache" })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Unable to load ${entry.file} (${response.status})`);
      }
      return validateRecord((await response.json()) as unknown, entry);
    })
    .catch((error: unknown) => {
      recordCache.delete(entry.file);
      throw error;
    });

  recordCache.set(entry.file, request);
  return request;
}

export const getRecordDownloadUrl = (entry: ManifestEntry) =>
  datasetUrl(entry.file);

export const stringifyJson = (value: unknown) => JSON.stringify(value, null, 2);
