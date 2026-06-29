export type ParseResult =
  | { valid: true; value: unknown; error: "" }
  | { valid: false; value: null; error: string };

export type SearchState = {
  mode: "text" | "path";
  query: string;
};

export type JsonValueType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null";

export type NodeId = string;

export type JsonNodeRecord = {
  childCount: number;
  childIds: NodeId[];
  depth: number;
  expandable: boolean;
  id: NodeId;
  key: string | number;
  parentId: NodeId | null;
  path: string;
  primitiveDisplay: string;
  searchLabelText: string;
  searchPathText: string;
  searchValueText: string;
  summary: string;
  type: JsonValueType;
};

export type JsonGraph = {
  nodeById: Map<NodeId, JsonNodeRecord>;
  rootId: NodeId;
  totalNodeCount: number;
};

export type SearchIndex = {
  ancestorMatchIds: Set<NodeId>;
  directMatchIds: Set<NodeId>;
  matchCount: number;
};

export type VisibleTreeRow = {
  depth: number;
  id: NodeId;
};

type GraphBuildResult = {
  nodeById: Map<NodeId, JsonNodeRecord>;
  totalNodeCount: number;
};

export const parseJsonInput = (input: string): ParseResult => {
  if (!input.trim()) {
    return {
      valid: false,
      value: null,
      error: "Paste JSON to start parsing.",
    };
  }

  try {
    return {
      valid: true,
      value: JSON.parse(input),
      error: "",
    };
  } catch (error) {
    return {
      valid: false,
      value: null,
      error: error instanceof Error ? error.message : "Invalid JSON input.",
    };
  }
};

export const createSearchState = (
  query: string,
  mode: "text" | "path",
): SearchState => ({
  mode,
  query: query.trim().toLowerCase(),
});

export const getValueType = (value: unknown): JsonValueType => {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "object") {
    return "object";
  }

  return typeof value as Exclude<JsonValueType, "object" | "array" | "null">;
};

export const formatPrimitive = (value: unknown): string => {
  if (typeof value === "string") {
    return `"${value}"`;
  }

  if (value === null) {
    return "null";
  }

  return String(value);
};

export const formatNodeSummary = (
  value: unknown,
  type: JsonValueType,
): string => {
  if (type === "array") {
    return `[${(value as unknown[]).length}]`;
  }

  if (type === "object") {
    return `{${Object.keys(value as Record<string, unknown>).length}}`;
  }

  return formatPrimitive(value);
};

export const buildJsonGraph = (value: unknown): JsonGraph => {
  const { nodeById, totalNodeCount } = buildGraphNode(value, "root", "root", null, 0);

  return {
    nodeById,
    rootId: "root",
    totalNodeCount,
  };
};

const buildGraphNode = (
  value: unknown,
  key: string | number,
  path: string,
  parentId: NodeId | null,
  depth: number,
): GraphBuildResult => {
  const type = getValueType(value);
  const expandable = type === "array" || type === "object";
  const childIds: NodeId[] = [];
  const nodeById = new Map<NodeId, JsonNodeRecord>();
  let totalNodeCount = 1;

  if (type === "array") {
    (value as unknown[]).forEach((childValue, index) => {
      const childPath = `${path}[${index}]`;
      const childGraph = buildGraphNode(childValue, index, childPath, path, depth + 1);

      childIds.push(childPath);
      totalNodeCount += childGraph.totalNodeCount;
      mergeNodeMaps(nodeById, childGraph.nodeById);
    });
  } else if (type === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
      const childPath = `${path}.${childKey}`;
      const childGraph = buildGraphNode(
        childValue,
        childKey,
        childPath,
        path,
        depth + 1,
      );

      childIds.push(childPath);
      totalNodeCount += childGraph.totalNodeCount;
      mergeNodeMaps(nodeById, childGraph.nodeById);
    });
  }

  nodeById.set(path, {
    childCount: childIds.length,
    childIds,
    depth,
    expandable,
    id: path,
    key,
    parentId,
    path,
    primitiveDisplay: expandable ? "" : formatPrimitive(value),
    searchLabelText: String(key).toLowerCase(),
    searchPathText: normalizePath(path),
    searchValueText: expandable ? "" : formatPrimitive(value).toLowerCase(),
    summary: formatNodeSummary(value, type),
    type,
  });

  return {
    nodeById,
    totalNodeCount,
  };
};

const mergeNodeMaps = (
  target: Map<NodeId, JsonNodeRecord>,
  source: Map<NodeId, JsonNodeRecord>,
) => {
  source.forEach((node, id) => {
    target.set(id, node);
  });
};

export const buildRootCollapsedSet = (graph: JsonGraph): Set<NodeId> => {
  const collapsedIds = new Set<NodeId>();

  graph.nodeById.forEach((node) => {
    if (node.expandable && node.id !== graph.rootId) {
      collapsedIds.add(node.id);
    }
  });

  return collapsedIds;
};

export const buildCollapseAllSet = (graph: JsonGraph): Set<NodeId> => {
  const collapsedIds = new Set<NodeId>();

  graph.nodeById.forEach((node) => {
    if (node.expandable) {
      collapsedIds.add(node.id);
    }
  });

  return collapsedIds;
};

export const buildSearchIndex = (
  graph: JsonGraph,
  searchState: SearchState,
): SearchIndex => {
  const directMatchIds = new Set<NodeId>();
  const ancestorMatchIds = new Set<NodeId>();

  if (!searchState.query) {
    return {
      ancestorMatchIds,
      directMatchIds,
      matchCount: 0,
    };
  }

  graph.nodeById.forEach((node) => {
    const directMatch =
      searchState.mode === "path"
        ? node.searchPathText.includes(normalizePath(searchState.query))
        : node.searchLabelText.includes(searchState.query) ||
          node.searchValueText.includes(searchState.query);

    if (!directMatch) {
      return;
    }

    directMatchIds.add(node.id);

    let ancestorId = node.parentId;

    while (ancestorId) {
      ancestorMatchIds.add(ancestorId);
      ancestorId = graph.nodeById.get(ancestorId)?.parentId ?? null;
    }
  });

  return {
    ancestorMatchIds,
    directMatchIds,
    matchCount: directMatchIds.size,
  };
};

export const buildVisibleTreeRows = (
  graph: JsonGraph,
  collapsedIds: Set<NodeId>,
  searchIndex: SearchIndex,
  searchState: SearchState,
): VisibleTreeRow[] => {
  const rows: VisibleTreeRow[] = [];
  const hasSearch = Boolean(searchState.query);

  const walk = (nodeId: NodeId) => {
    const node = graph.nodeById.get(nodeId);

    if (!node) {
      return;
    }

    rows.push({
      depth: node.depth,
      id: node.id,
    });

    if (!node.expandable || collapsedIds.has(node.id)) {
      return;
    }

    for (const childId of node.childIds) {
      if (
        hasSearch &&
        !searchIndex.directMatchIds.has(childId) &&
        !searchIndex.ancestorMatchIds.has(childId)
      ) {
        continue;
      }

      walk(childId);
    }
  };

  walk(graph.rootId);

  return rows;
};

export const splitMatches = (
  text: string,
  query: string,
): Array<{ value: string; match: boolean }> => {
  if (!query.trim()) {
    return [{ value: text, match: false }];
  }

  const loweredText = text.toLowerCase();
  const loweredQuery = query.trim().toLowerCase();
  const parts: Array<{ value: string; match: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = loweredText.indexOf(loweredQuery, cursor);

    if (matchIndex === -1) {
      parts.push({ value: text.slice(cursor), match: false });
      break;
    }

    if (matchIndex > cursor) {
      parts.push({ value: text.slice(cursor, matchIndex), match: false });
    }

    parts.push({
      value: text.slice(matchIndex, matchIndex + loweredQuery.length),
      match: true,
    });

    cursor = matchIndex + loweredQuery.length;
  }

  return parts;
};

export const getPathLabel = (path: string): string => path;

export const isLargeGraph = (
  graph: JsonGraph,
  threshold = 1500,
): boolean => graph.totalNodeCount > threshold;

const normalizePath = (path: string): string =>
  path.trim().toLowerCase().replace(/^root\.?/, "");
