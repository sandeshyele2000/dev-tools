import {
  buildDiffSnapshot,
  buildJsonGraph,
  buildSearchSnapshot,
  createSearchState,
  parseStructuredInput,
  type DiffSnapshot,
  type JsonGraph,
  type SearchMode,
  type SearchSnapshot,
} from "@/lib/json-viewer";

type StoredDocument = {
  graph: JsonGraph;
  input: string;
  value: unknown;
};

type ParseDocumentMessage = {
  type: "parse-document";
  documentId: string;
  input: string;
  requestId: number;
};

type SearchDocumentMessage = {
  type: "search-document";
  documentId: string;
  mode: SearchMode;
  query: string;
  requestId: number;
};

type FormatDocumentMessage = {
  type: "format-document";
  documentId: string;
  indentation: number;
  requestId: number;
};

type CopyNodeMessage = {
  type: "copy-node";
  documentId: string;
  path: string;
  requestId: number;
};

type ComputeDiffMessage = {
  type: "compute-diff";
  baselineInput: string;
  documentId: string;
  requestId: number;
};

type WorkerRequest =
  | CopyNodeMessage
  | ComputeDiffMessage
  | FormatDocumentMessage
  | ParseDocumentMessage
  | SearchDocumentMessage;

type WorkerResponse =
  | {
      requestId: number;
      type: "copy-node-result";
      value: string;
    }
  | {
      requestId: number;
      type: "compute-diff-result";
      value: DiffSnapshot;
    }
  | {
      requestId: number;
      type: "error";
      error: string;
    }
  | {
      requestId: number;
      type: "format-document-result";
      value: string;
    }
  | {
      compactText: string;
      requestId: number;
      type: "parse-document-result";
      error: string;
      graph: JsonGraph | null;
      valid: boolean;
    }
  | {
      requestId: number;
      type: "search-document-result";
      value: SearchSnapshot;
    };

const documents = new Map<string, StoredDocument>();

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const message = event.data;

    if (message.type === "parse-document") {
      handleParseDocument(message);
      return;
    }

    if (message.type === "search-document") {
      handleSearchDocument(message);
      return;
    }

    if (message.type === "format-document") {
      handleFormatDocument(message);
      return;
    }

    if (message.type === "copy-node") {
      handleCopyNode(message);
      return;
    }

    handleComputeDiff(message);
  } catch (error) {
    const message = event.data;

    postMessage({
      requestId: message.requestId,
      type: "error",
      error: error instanceof Error ? error.message : "Worker request failed.",
    } satisfies WorkerResponse);
  }
};

const handleParseDocument = (message: ParseDocumentMessage) => {
  if (!message.input.trim()) {
    documents.delete(message.documentId);
    postMessage({
      requestId: message.requestId,
      type: "parse-document-result",
      compactText: "",
      error: "Paste JSON to start parsing.",
      graph: null,
      valid: false,
    } satisfies WorkerResponse);
    return;
  }

  try {
    const { value } = parseStructuredInput(message.input);
    const graph = buildJsonGraph(value, message.input);

    documents.set(message.documentId, {
      graph,
      input: message.input,
      value,
    });

    postMessage({
      requestId: message.requestId,
      type: "parse-document-result",
      compactText: JSON.stringify(value),
      error: "",
      graph,
      valid: true,
    } satisfies WorkerResponse);
  } catch (error) {
    documents.delete(message.documentId);
    postMessage({
      requestId: message.requestId,
      type: "parse-document-result",
      compactText: "",
      error: error instanceof Error ? error.message : "Invalid JSON input.",
      graph: null,
      valid: false,
    } satisfies WorkerResponse);
  }
};

const handleSearchDocument = (message: SearchDocumentMessage) => {
  const document = documents.get(message.documentId);

  if (!document) {
    postMessage({
      requestId: message.requestId,
      type: "search-document-result",
      value: {
        ancestorMatchIds: [],
        directMatchIds: [],
        matchCount: 0,
        orderedMatchIds: [],
      },
    } satisfies WorkerResponse);
    return;
  }

  postMessage({
    requestId: message.requestId,
    type: "search-document-result",
    value:
      message.mode === "path"
        ? buildSearchSnapshot(document.graph, createSearchState(message.query, message.mode))
        : buildTextSearchSnapshot(document.graph, document.value, message.query),
  } satisfies WorkerResponse);
};

const handleFormatDocument = (message: FormatDocumentMessage) => {
  const document = requireDocument(message.documentId);

  postMessage({
    requestId: message.requestId,
    type: "format-document-result",
    value: JSON.stringify(document.value, null, message.indentation),
  } satisfies WorkerResponse);
};

const handleCopyNode = (message: CopyNodeMessage) => {
  const document = requireDocument(message.documentId);

  postMessage({
    requestId: message.requestId,
    type: "copy-node-result",
    value: JSON.stringify(getValueAtPath(document.value, message.path), null, 2),
  } satisfies WorkerResponse);
};

const handleComputeDiff = (message: ComputeDiffMessage) => {
  const document = requireDocument(message.documentId);

  if (!message.baselineInput.trim()) {
    postMessage({
      requestId: message.requestId,
      type: "compute-diff-result",
      value: {
        ancestorIds: [],
        changedIds: [],
        entries: [],
        isLimited: false,
        matchCount: 0,
      },
    } satisfies WorkerResponse);
    return;
  }

  const { value: baselineValue } = parseStructuredInput(message.baselineInput);

  postMessage({
    requestId: message.requestId,
    type: "compute-diff-result",
    value: buildDiffSnapshot(document.graph, document.value, baselineValue),
  } satisfies WorkerResponse);
};

const requireDocument = (documentId: string) => {
  const document = documents.get(documentId);

  if (!document) {
    throw new Error("Document is not ready.");
  }

  return document;
};

const getValueAtPath = (rootValue: unknown, path: string): unknown => {
  if (path === "root") {
    return rootValue;
  }

  const segments = path.replace(/^root\.?/, "").match(/[^.[\]]+|\[\d+\]/g) ?? [];
  let currentValue = rootValue;

  for (const segment of segments) {
    if (segment.startsWith("[")) {
      const index = Number(segment.slice(1, -1));

      if (!Array.isArray(currentValue)) {
        return undefined;
      }

      currentValue = currentValue[index];
      continue;
    }

    if (currentValue === null || typeof currentValue !== "object") {
      return undefined;
    }

    currentValue = (currentValue as Record<string, unknown>)[segment];
  }

  return currentValue;
};

const buildTextSearchSnapshot = (
  graph: JsonGraph,
  rootValue: unknown,
  query: string,
): SearchSnapshot => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return {
      ancestorMatchIds: [],
      directMatchIds: [],
      matchCount: 0,
      orderedMatchIds: [],
    };
  }

  const directMatchIds = new Set<string>();
  const ancestorMatchIds = new Set<string>();
  const subtreeMatchByPath = new Map<string, boolean>();

  const visit = (path: string, value: unknown): boolean => {
    const node = graph.nodeById[path];

    if (!node) {
      return false;
    }

    const selfMatch =
      node.searchLabelText.includes(normalizedQuery) ||
      (!node.expandable && node.searchValueText.includes(normalizedQuery));
    let descendantMatch = false;

    if (Array.isArray(value)) {
      value.forEach((childValue, index) => {
        if (visit(`${path}[${index}]`, childValue)) {
          descendantMatch = true;
        }
      });
    } else if (value !== null && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
        if (visit(`${path}.${childKey}`, childValue)) {
          descendantMatch = true;
        }
      });
    }

    const matches = selfMatch || (node.id !== graph.rootId && descendantMatch);
    subtreeMatchByPath.set(path, matches);
    return matches;
  };

  visit(graph.rootId, rootValue);

  graph.nodeOrder.forEach((path) => {
    if (!subtreeMatchByPath.get(path)) {
      return;
    }

    directMatchIds.add(path);
    let ancestorId = graph.nodeById[path]?.parentId ?? null;

    while (ancestorId) {
      ancestorMatchIds.add(ancestorId);
      ancestorId = graph.nodeById[ancestorId]?.parentId ?? null;
    }
  });

  const orderedMatchIds = graph.nodeOrder.filter((path) => directMatchIds.has(path));

  return {
    ancestorMatchIds: [...ancestorMatchIds],
    directMatchIds: [...directMatchIds],
    matchCount: orderedMatchIds.length,
    orderedMatchIds,
  };
};
