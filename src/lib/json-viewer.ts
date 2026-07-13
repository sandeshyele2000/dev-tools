export type ParseResult =
  | { valid: true; error: ""; graph: JsonGraph }
  | { valid: false; error: string; graph: null };

export type ParsedDocument = {
  value: unknown;
};

export type SearchMode = "text" | "path";

export type SearchState = {
  mode: SearchMode;
  query: string;
};

export type ViewerMode = "tree" | "text" | "compact";

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
  inputSize: number;
  maxDepth: number;
  nodeById: Record<NodeId, JsonNodeRecord>;
  nodeOrder: NodeId[];
  rootId: NodeId;
  totalNodeCount: number;
};

export type SearchSnapshot = {
  ancestorMatchIds: NodeId[];
  directMatchIds: NodeId[];
  matchCount: number;
  orderedMatchIds: NodeId[];
};

export type SearchIndex = {
  ancestorMatchIds: Set<NodeId>;
  directMatchIds: Set<NodeId>;
  matchCount: number;
  orderedMatchIds: NodeId[];
};

export type DiffEntry = {
  kind: "added" | "changed" | "removed";
  path: string;
};

export type DiffSnapshot = {
  ancestorIds: NodeId[];
  changedIds: NodeId[];
  entries: DiffEntry[];
  isLimited: boolean;
  matchCount: number;
};

export type DiffIndex = {
  ancestorIds: Set<NodeId>;
  changedIds: Set<NodeId>;
  entries: DiffEntry[];
  isLimited: boolean;
  matchCount: number;
};

export type VisibleTreeRow =
  | {
      depth: number;
      id: NodeId;
      kind: "node" | "closing";
    }
  | {
      depth: number;
      id: `${NodeId}::show-more`;
      kind: "show-more";
      parentId: NodeId;
      remainingChildCount: number;
    };

type GraphBuildState = {
  maxDepth: number;
  nodeById: Record<NodeId, JsonNodeRecord>;
  nodeOrder: NodeId[];
  totalNodeCount: number;
};

export const DEFAULT_VISIBLE_CHILDREN = 200;
export const VISIBLE_CHILDREN_INCREMENT = 200;
export const HEAVY_NODE_THRESHOLD = 5000;
export const HEAVY_INPUT_SIZE_THRESHOLD = 400_000;
export const MAX_DIFF_ENTRIES = 20_000;

export const EMPTY_SEARCH_INDEX: SearchIndex = {
  ancestorMatchIds: new Set<NodeId>(),
  directMatchIds: new Set<NodeId>(),
  matchCount: 0,
  orderedMatchIds: [],
};

export const EMPTY_DIFF_INDEX: DiffIndex = {
  ancestorIds: new Set<NodeId>(),
  changedIds: new Set<NodeId>(),
  entries: [],
  isLimited: false,
  matchCount: 0,
};

export const createSearchState = (
  query: string,
  mode: SearchMode,
): SearchState => ({
  mode,
  query: query.trim().toLowerCase(),
});

export const materializeSearchIndex = (
  snapshot: SearchSnapshot | null | undefined,
): SearchIndex => {
  if (!snapshot) {
    return EMPTY_SEARCH_INDEX;
  }

  return {
    ancestorMatchIds: new Set(snapshot.ancestorMatchIds),
    directMatchIds: new Set(snapshot.directMatchIds),
    matchCount: snapshot.matchCount,
    orderedMatchIds: snapshot.orderedMatchIds,
  };
};

export const materializeDiffIndex = (
  snapshot: DiffSnapshot | null | undefined,
): DiffIndex => {
  if (!snapshot) {
    return EMPTY_DIFF_INDEX;
  }

  return {
    ancestorIds: new Set(snapshot.ancestorIds),
    changedIds: new Set(snapshot.changedIds),
    entries: snapshot.entries,
    isLimited: snapshot.isLimited,
    matchCount: snapshot.matchCount,
  };
};

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

export const buildJsonGraph = (value: unknown, input: string): JsonGraph => {
  const state: GraphBuildState = {
    maxDepth: 0,
    nodeById: {},
    nodeOrder: [],
    totalNodeCount: 0,
  };

  buildGraphNode(state, value, "root", "root", null, 0);

  return {
    inputSize: input.length,
    maxDepth: state.maxDepth,
    nodeById: state.nodeById,
    nodeOrder: state.nodeOrder,
    rootId: "root",
    totalNodeCount: state.totalNodeCount,
  };
};

const buildGraphNode = (
  state: GraphBuildState,
  value: unknown,
  key: string | number,
  path: string,
  parentId: NodeId | null,
  depth: number,
) => {
  const type = getValueType(value);
  const expandable = type === "array" || type === "object";
  const childIds: NodeId[] = [];

  state.totalNodeCount += 1;
  state.maxDepth = Math.max(state.maxDepth, depth);
  state.nodeOrder.push(path);

  if (type === "array") {
    (value as unknown[]).forEach((childValue, index) => {
      const childPath = `${path}[${index}]`;
      childIds.push(childPath);
      buildGraphNode(state, childValue, index, childPath, path, depth + 1);
    });
  } else if (type === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([childKey, childValue]) => {
      const childPath = `${path}.${childKey}`;
      childIds.push(childPath);
      buildGraphNode(state, childValue, childKey, childPath, path, depth + 1);
    });
  }

  state.nodeById[path] = {
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
  };
};

export const buildSearchSnapshot = (
  graph: JsonGraph,
  searchState: SearchState,
): SearchSnapshot => {
  if (!searchState.query) {
    return {
      ancestorMatchIds: [],
      directMatchIds: [],
      matchCount: 0,
      orderedMatchIds: [],
    };
  }

  const directMatchIds = new Set<NodeId>();
  const ancestorMatchIds = new Set<NodeId>();
  const orderedMatchIds: NodeId[] = [];

  graph.nodeOrder.forEach((id) => {
    const node = graph.nodeById[id];

    if (!node) {
      return;
    }

    const directMatch =
      searchState.mode === "path"
        ? node.searchPathText.includes(normalizePath(searchState.query))
        : node.searchLabelText.includes(searchState.query) ||
          node.searchValueText.includes(searchState.query);

    if (!directMatch) {
      return;
    }

    directMatchIds.add(node.id);
    orderedMatchIds.push(node.id);

    let ancestorId = node.parentId;

    while (ancestorId) {
      ancestorMatchIds.add(ancestorId);
      ancestorId = graph.nodeById[ancestorId]?.parentId ?? null;
    }
  });

  return {
    ancestorMatchIds: [...ancestorMatchIds],
    directMatchIds: [...directMatchIds],
    matchCount: orderedMatchIds.length,
    orderedMatchIds,
  };
};

export const buildDiffSnapshot = (
  graph: JsonGraph | null,
  currentValue: unknown,
  baselineValue: unknown,
): DiffSnapshot => {
  const entries = buildDiffEntries(currentValue, baselineValue);
  const changedIds = new Set<NodeId>();
  const ancestorIds = new Set<NodeId>();

  for (const entry of entries) {
    const normalizedPath = entry.path || "root";

    if (graph?.nodeById[normalizedPath]) {
      changedIds.add(normalizedPath);
    }

    let ancestorPath = getParentPath(normalizedPath);

    while (ancestorPath) {
      ancestorIds.add(ancestorPath);
      ancestorPath = getParentPath(ancestorPath);
    }
  }

  return {
    ancestorIds: [...ancestorIds],
    changedIds: [...changedIds],
    entries,
    isLimited: entries.length >= MAX_DIFF_ENTRIES,
    matchCount: entries.length,
  };
};

export const buildVisibleTreeRows = (
  graph: JsonGraph,
  collapsedIds: Set<NodeId>,
  searchIndex: SearchIndex,
  searchState: SearchState,
  visibleChildCountById: Record<NodeId, number>,
  isHeavy: boolean,
): VisibleTreeRow[] => {
  const rows: VisibleTreeRow[] = [];
  const hasSearch = Boolean(searchState.query);

  const walk = (nodeId: NodeId) => {
    const node = graph.nodeById[nodeId];

    if (!node) {
      return;
    }

    rows.push({
      depth: node.depth,
      id: node.id,
      kind: "node",
    });

    if (!node.expandable || collapsedIds.has(node.id) || node.childCount === 0) {
      return;
    }

    const renderIds = hasSearch
      ? node.childIds.filter(
          (childId) =>
            searchIndex.directMatchIds.has(childId) ||
            searchIndex.ancestorMatchIds.has(childId),
        )
      : node.childIds;
    const visibleChildCount = isHeavy
      ? visibleChildCountById[node.id] ?? DEFAULT_VISIBLE_CHILDREN
      : renderIds.length;
    const visibleIds = hasSearch ? renderIds : renderIds.slice(0, visibleChildCount);

    visibleIds.forEach((childId) => {
      walk(childId);
    });

    if (!hasSearch && isHeavy && renderIds.length > visibleIds.length) {
      rows.push({
        depth: node.depth + 1,
        id: `${node.id}::show-more` as `${NodeId}::show-more`,
        kind: "show-more",
        parentId: node.id,
        remainingChildCount: renderIds.length - visibleIds.length,
      });
    }

    rows.push({
      depth: node.depth,
      id: node.id,
      kind: "closing",
    });
  };

  walk(graph.rootId);

  return rows;
};

export const buildRootCollapsedSet = (graph: JsonGraph): Set<NodeId> => {
  const collapsedIds = new Set<NodeId>();

  Object.values(graph.nodeById).forEach((node) => {
    if (node.expandable && node.id !== graph.rootId) {
      collapsedIds.add(node.id);
    }
  });

  return collapsedIds;
};

export const buildCollapseAllSet = (graph: JsonGraph): Set<NodeId> => {
  const collapsedIds = new Set<NodeId>();

  Object.values(graph.nodeById).forEach((node) => {
    if (node.expandable) {
      collapsedIds.add(node.id);
    }
  });

  return collapsedIds;
};

export const revealNodeInTree = (
  graph: JsonGraph,
  nodeId: NodeId,
  currentCollapsedIds: Set<NodeId>,
  currentVisibleChildCountById: Record<NodeId, number>,
): {
  collapsedIds: Set<NodeId>;
  visibleChildCountById: Record<NodeId, number>;
} => {
  const collapsedIds = new Set(currentCollapsedIds);
  const visibleChildCountById = { ...currentVisibleChildCountById };
  let currentId: NodeId | null = nodeId;

  while (currentId) {
    const node: JsonNodeRecord | undefined = graph.nodeById[currentId];

    if (!node) {
      break;
    }

    if (node.parentId) {
      collapsedIds.delete(node.parentId);
      const parent = graph.nodeById[node.parentId];
      const childIndex = parent?.childIds.indexOf(currentId) ?? -1;

      if (childIndex >= 0) {
        const currentVisible = visibleChildCountById[node.parentId] ?? DEFAULT_VISIBLE_CHILDREN;

        if (childIndex >= currentVisible) {
          visibleChildCountById[node.parentId] =
            Math.ceil((childIndex + 1) / VISIBLE_CHILDREN_INCREMENT) *
            VISIBLE_CHILDREN_INCREMENT;
        }
      }
    }

    currentId = node.parentId;
  }

  return {
    collapsedIds,
    visibleChildCountById,
  };
};

export const isHeavyGraph = (graph: JsonGraph) =>
  graph.totalNodeCount > HEAVY_NODE_THRESHOLD ||
  graph.inputSize > HEAVY_INPUT_SIZE_THRESHOLD;

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

export const toggleCollapsedPath = (current: Set<NodeId>, path: NodeId) => {
  const next = new Set(current);

  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }

  return next;
};

export const getPathLabel = (path: string): string => path;

export const parseJsonInput = (input: string): ParseResult => {
  if (!input.trim()) {
    return {
      valid: false,
      error: "Paste JSON to start parsing.",
      graph: null,
    };
  }

  try {
    const { value } = parseStructuredInput(input);

    return {
      valid: true,
      error: "",
      graph: buildJsonGraph(value, input),
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Invalid JSON input.",
      graph: null,
    };
  }
};

export const parseStructuredInput = (input: string): ParsedDocument => {
  try {
    return {
      value: JSON.parse(input),
    };
  } catch (jsonError) {
    try {
      return {
        value: parseMongoDocument(input),
      };
    } catch (mongoError) {
      throw mongoError instanceof Error
        ? mongoError
        : jsonError instanceof Error
          ? jsonError
          : new Error("Invalid JSON input.");
    }
  }
};

const formatNodeSummary = (
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

const normalizePath = (path: string): string =>
  path.trim().toLowerCase().replace(/^root\.?/, "");

const parseMongoDocument = (input: string): unknown => {
  const parser = new MongoDocumentParser(input);
  const value = parser.parseValue();

  parser.skipWhitespace();

  if (!parser.isAtEnd()) {
    throw new Error(`Unexpected token "${parser.currentChar()}" at position ${parser.position}.`);
  }

  return value;
};

class MongoDocumentParser {
  private readonly source: string;

  position = 0;

  constructor(source: string) {
    this.source = source;
  }

  parseValue(): unknown {
    this.skipWhitespace();

    const char = this.currentChar();

    if (!char) {
      throw new Error("Unexpected end of input.");
    }

    if (char === "{") {
      return this.parseObject();
    }

    if (char === "[") {
      const placeholder = this.tryParseBracketPlaceholder();

      if (placeholder !== null) {
        return placeholder;
      }

      return this.parseArray();
    }

    if (char === "'" || char === '"') {
      return this.parseString();
    }

    if (char === "-" || isDigit(char)) {
      return this.parseNumber();
    }

    if (isIdentifierStart(char)) {
      return this.parseIdentifierValue();
    }

    throw new Error(`Unexpected token "${char}" at position ${this.position}.`);
  }

  skipWhitespace() {
    while (!this.isAtEnd() && /\s/.test(this.currentChar())) {
      this.position += 1;
    }
  }

  isAtEnd() {
    return this.position >= this.source.length;
  }

  currentChar() {
    return this.source[this.position] ?? "";
  }

  private parseObject() {
    const result: Record<string, unknown> = {};

    this.expectChar("{");
    this.skipWhitespace();

    if (this.currentChar() === "}") {
      this.position += 1;
      return result;
    }

    while (!this.isAtEnd()) {
      const key = this.parseObjectKey();

      this.skipWhitespace();
      this.expectChar(":");

      result[key] = this.parseValue();

      this.skipWhitespace();

      if (this.currentChar() === "}") {
        this.position += 1;
        return result;
      }

      this.expectChar(",");
      this.skipWhitespace();

      if (this.currentChar() === "}") {
        this.position += 1;
        return result;
      }
    }

    throw new Error("Unterminated object literal.");
  }

  private parseArray() {
    const result: unknown[] = [];

    this.expectChar("[");
    this.skipWhitespace();

    if (this.currentChar() === "]") {
      this.position += 1;
      return result;
    }

    while (!this.isAtEnd()) {
      result.push(this.parseValue());
      this.skipWhitespace();

      if (this.currentChar() === "]") {
        this.position += 1;
        return result;
      }

      this.expectChar(",");
      this.skipWhitespace();

      if (this.currentChar() === "]") {
        this.position += 1;
        return result;
      }
    }

    throw new Error("Unterminated array literal.");
  }

  private tryParseBracketPlaceholder() {
    const match = this.source
      .slice(this.position)
      .match(/^\[(?:Object|Array|Function[^\]\n]*|Circular[^\]\n]*)\]/);

    if (!match) {
      return null;
    }

    this.position += match[0].length;

    return match[0];
  }

  private parseObjectKey() {
    this.skipWhitespace();

    const char = this.currentChar();

    if (char === "'" || char === '"') {
      return this.parseString();
    }

    return this.parseIdentifier();
  }

  private parseIdentifierValue() {
    const identifier = this.parseIdentifier();

    if (identifier === "true") {
      return true;
    }

    if (identifier === "false") {
      return false;
    }

    if (identifier === "null") {
      return null;
    }

    if (identifier === "undefined") {
      return "undefined";
    }

    if (identifier === "NaN") {
      return "NaN";
    }

    if (identifier === "Infinity") {
      return "Infinity";
    }

    if (identifier === "new") {
      this.skipWhitespace();

      return this.parseMongoConstructor(this.parseIdentifier());
    }

    this.skipWhitespace();

    if (this.currentChar() === "(") {
      return this.parseMongoConstructor(identifier);
    }

    throw new Error(`Unsupported identifier "${identifier}" at position ${this.position}.`);
  }

  private parseMongoConstructor(name: string) {
    this.expectChar("(");
    this.skipWhitespace();

    const args: unknown[] = [];

    if (this.currentChar() !== ")") {
      while (!this.isAtEnd()) {
        args.push(this.parseValue());
        this.skipWhitespace();

        if (this.currentChar() === ")") {
          break;
        }

        this.expectChar(",");
        this.skipWhitespace();
      }
    }

    this.expectChar(")");

    if (name === "ObjectId" && typeof args[0] === "string") {
      return `ObjectId(${args[0]})`;
    }

    if (name === "ISODate" && typeof args[0] === "string") {
      return `ISODate(${args[0]})`;
    }

    if ((name === "NumberInt" || name === "NumberLong") && typeof args[0] === "string") {
      const numericValue = Number(args[0]);

      if (!Number.isNaN(numericValue)) {
        return numericValue;
      }
    }

    if (name === "NumberDecimal" && typeof args[0] === "string") {
      return args[0];
    }

    return `${name}(${args.map(formatMongoConstructorArgument).join(", ")})`;
  }

  private parseIdentifier() {
    const start = this.position;

    if (!isIdentifierStart(this.currentChar())) {
      throw new Error(`Expected identifier at position ${this.position}.`);
    }

    this.position += 1;

    while (!this.isAtEnd() && isIdentifierPart(this.currentChar())) {
      this.position += 1;
    }

    return this.source.slice(start, this.position);
  }

  private parseString() {
    const quote = this.currentChar();
    let result = "";

    this.position += 1;

    while (!this.isAtEnd()) {
      const char = this.currentChar();

      if (char === quote) {
        this.position += 1;
        return result;
      }

      if (char === "\\") {
        this.position += 1;

        if (this.isAtEnd()) {
          throw new Error("Unterminated string literal.");
        }

        const escaped = this.currentChar();

        result += decodeEscapedCharacter(escaped, this.readUnicodeEscape.bind(this));
        this.position += 1;
        continue;
      }

      result += char;
      this.position += 1;
    }

    throw new Error("Unterminated string literal.");
  }

  private readUnicodeEscape() {
    const unicode = this.source.slice(this.position + 1, this.position + 5);

    if (!/^[0-9a-fA-F]{4}$/.test(unicode)) {
      throw new Error(`Invalid unicode escape at position ${this.position}.`);
    }

    this.position += 4;

    return String.fromCharCode(Number.parseInt(unicode, 16));
  }

  private parseNumber() {
    const match = this.source
      .slice(this.position)
      .match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);

    if (!match) {
      throw new Error(`Invalid number at position ${this.position}.`);
    }

    this.position += match[0].length;

    return Number(match[0]);
  }

  private expectChar(expected: string) {
    this.skipWhitespace();

    if (this.currentChar() !== expected) {
      throw new Error(`Expected "${expected}" at position ${this.position}.`);
    }

    this.position += 1;
  }
}

const decodeEscapedCharacter = (
  escaped: string,
  readUnicodeEscape: () => string,
) => {
  if (escaped === "u") {
    return readUnicodeEscape();
  }

  const escapeMap: Record<string, string> = {
    '"': '"',
    "'": "'",
    "\\": "\\",
    "/": "/",
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
  };

  return escapeMap[escaped] ?? escaped;
};

const formatMongoConstructorArgument = (value: unknown) => {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return String(value);
};

const isDigit = (char: string) => /[0-9]/.test(char);

const isIdentifierStart = (char: string) => /[$A-Za-z_]/.test(char);

const isIdentifierPart = (char: string) => /[$0-9A-Za-z_]/.test(char);

const buildDiffEntries = (
  currentValue: unknown,
  baselineValue: unknown,
  path = "root",
  entries: DiffEntry[] = [],
): DiffEntry[] => {
  if (entries.length >= MAX_DIFF_ENTRIES) {
    return entries;
  }

  if (Object.is(currentValue, baselineValue)) {
    return entries;
  }

  const currentType = getValueType(currentValue);
  const baselineType = getValueType(baselineValue);

  if (currentType !== baselineType) {
    entries.push({ kind: "changed", path });
    return entries;
  }

  if (currentType === "array") {
    const currentArray = currentValue as unknown[];
    const baselineArray = baselineValue as unknown[];

    if (currentArray.length !== baselineArray.length) {
      entries.push({ kind: "changed", path });
    }

    const maxLength = Math.max(currentArray.length, baselineArray.length);

    for (let index = 0; index < maxLength; index += 1) {
      if (entries.length >= MAX_DIFF_ENTRIES) {
        break;
      }

      const childPath = `${path}[${index}]`;

      if (index >= baselineArray.length) {
        entries.push({ kind: "added", path: childPath });
        continue;
      }

      if (index >= currentArray.length) {
        entries.push({ kind: "removed", path: childPath });
        continue;
      }

      buildDiffEntries(currentArray[index], baselineArray[index], childPath, entries);
    }

    return dedupeDiffEntries(entries);
  }

  if (currentType === "object") {
    const currentObject = currentValue as Record<string, unknown>;
    const baselineObject = baselineValue as Record<string, unknown>;
    const keys = new Set([...Object.keys(currentObject), ...Object.keys(baselineObject)]);

    for (const key of keys) {
      if (entries.length >= MAX_DIFF_ENTRIES) {
        break;
      }

      const childPath = `${path}.${key}`;

      if (!(key in baselineObject)) {
        entries.push({ kind: "added", path: childPath });
        continue;
      }

      if (!(key in currentObject)) {
        entries.push({ kind: "removed", path: childPath });
        continue;
      }

      buildDiffEntries(currentObject[key], baselineObject[key], childPath, entries);
    }

    return dedupeDiffEntries(entries);
  }

  entries.push({ kind: "changed", path });
  return entries;
};

const dedupeDiffEntries = (entries: DiffEntry[]): DiffEntry[] => {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.kind}:${entry.path}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getParentPath = (path: string): string | null => {
  if (path === "root") {
    return null;
  }

  const lastArrayIndex = path.lastIndexOf("[");
  const lastObjectIndex = path.lastIndexOf(".");
  const separatorIndex = Math.max(lastArrayIndex, lastObjectIndex);

  if (separatorIndex <= "root".length - 1) {
    return "root";
  }

  return path.slice(0, separatorIndex);
};
