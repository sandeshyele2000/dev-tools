import { memo, useMemo } from "react";
import {
  type DiffIndex,
  getPathLabel,
  splitMatches,
  type JsonNodeRecord,
  type SearchIndex,
  type SearchState,
  type VisibleTreeRow,
} from "@/lib/json-viewer";

type JsonNodeProps = {
  collapsedIds: Set<string>;
  diffIndex: DiffIndex;
  node: JsonNodeRecord;
  onCopyNode: (path: string) => void;
  onTogglePath: (path: string) => void;
  row: VisibleTreeRow;
  searchIndex: SearchIndex;
  searchState: SearchState;
};

export const JsonNode = memo(
  ({
    collapsedIds,
    diffIndex,
    node,
    onCopyNode,
    onTogglePath,
    row,
    searchIndex,
    searchState,
  }: JsonNodeProps) => {
    const isCollapsed = collapsedIds.has(node.id);
    const isRoot = node.parentId === null;
    const hasSearch = searchState.query.length > 0;
    const nodeMatch = searchIndex.directMatchIds.has(node.id);
    const descendantMatch = searchIndex.ancestorMatchIds.has(node.id);
    const shouldShowContext = hasSearch && !nodeMatch && descendantMatch;
    const nodeChanged = diffIndex.changedIds.has(node.id);
    const ancestorChanged = diffIndex.ancestorIds.has(node.id);
    const isClosingRow = row.kind === "closing";
    const rowClassName = [
      "group relative flex min-h-[32px] items-center gap-3 px-4 py-1 font-mono text-[15px] leading-6",
      "border-l-2 border-transparent hover:bg-hover-panel",
      nodeMatch ? "border-l-accent bg-accent-panel" : "",
      shouldShowContext ? "border-l-accent-border bg-accent-subtle" : "",
      nodeChanged ? "border-l-warn bg-warn-panel" : "",
      ancestorChanged && !nodeChanged ? "border-l-warn-border bg-warn-subtle" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const trailingComma = isRoot ? "" : ",";
    const keyIndent = isRoot ? 0 : row.depth * 18;
    const closingIndent = row.depth * 18;

    if (isClosingRow) {
      return (
        <div className={rowClassName} style={{ paddingLeft: `${closingIndent + 16}px` }}>
          <Guide depth={row.depth} />
          <span className={getContainerClassName(node.type)}>{getClosingToken(node.type)}</span>
          <span className="text-token-punctuation">{trailingComma}</span>
          <RowMeta path={node.path} query={searchState.query} enabled={searchState.mode === "path"} />
        </div>
      );
    }

    const isExpandable = node.expandable;
    const isEmptyContainer = isExpandable && node.childCount === 0;
    const containerToken = getContainerToken(node.type);
    const containerClassName = getContainerClassName(node.type);
    const collapsedSummary = isEmptyContainer
      ? `${containerToken.open}${containerToken.close}`
      : `${containerToken.open}${node.type === "array" ? "..." : " ... "}${containerToken.close}`;

    return (
      <div className={rowClassName} style={{ paddingLeft: `${keyIndent + 16}px` }}>
        <Guide depth={row.depth} />

        {isExpandable && !isEmptyContainer && (
          <button
            type="button"
            className="absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-border-default bg-panel text-token-punctuation opacity-0 transition-opacity group-hover:opacity-100 hover:border-accent-border hover:text-accent"
            style={{ left: `${keyIndent + 4}px` }}
            onClick={() => onTogglePath(node.id)}
            aria-label={isCollapsed ? "Expand node" : "Collapse node"}
          >
            {isCollapsed ? "+" : "-"}
          </button>
        )}

        {!isRoot && (
          <>
            <span className="text-token-key">
              <HighlightedText
                text={`"${String(node.key)}"`}
                query={searchState.query}
                enabled={searchState.mode === "text"}
              />
            </span>
            <span className="text-token-punctuation">:</span>
          </>
        )}

        {isExpandable ? (
          <>
            <span className={containerClassName}>
              {isCollapsed || isEmptyContainer ? collapsedSummary : containerToken.open}
            </span>
            <span className="text-token-punctuation">
              {(isCollapsed || isEmptyContainer) && !isRoot ? "," : ""}
            </span>
          </>
        ) : (
          <>
            <span className={getPrimitiveClassName(node.type)}>
              <HighlightedText
                text={node.primitiveDisplay}
                query={searchState.query}
                enabled={searchState.mode === "text"}
              />
            </span>
            <span className="text-token-punctuation">{trailingComma}</span>
          </>
        )}

        {!isRoot && (
          <button
            type="button"
            className="ml-2 rounded border border-border-default px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:border-accent-border hover:text-accent"
            onClick={() => onCopyNode(node.path)}
            aria-label={`Copy ${getPathLabel(node.path)}`}
          >
            Copy
          </button>
        )}

        <RowMeta path={node.path} query={searchState.query} enabled={searchState.mode === "path"} />
      </div>
    );
  },
);

JsonNode.displayName = "JsonNode";

type HighlightedTextProps = {
  enabled: boolean;
  query: string;
  text: string;
};

const HighlightedText = memo(
  ({ enabled, query, text }: HighlightedTextProps) => {
    const parts = useMemo(() => {
      if (!enabled || !query.trim()) {
        return [{ value: text, match: false }];
      }

      return splitMatches(text, query);
    }, [enabled, query, text]);

    return (
      <>
        {parts.map((part, index) =>
          part.match ? (
            <mark
              key={`${part.value}-${index}`}
              className="rounded bg-accent-soft px-0.5 text-accent"
            >
              {part.value}
            </mark>
          ) : (
            <span key={`${part.value}-${index}`}>{part.value}</span>
          ),
        )}
      </>
    );
  },
);

HighlightedText.displayName = "HighlightedText";

const getContainerToken = (type: JsonNodeRecord["type"]) =>
  type === "array"
    ? { open: "[", close: "]" }
    : { open: "{", close: "}" };

const getClosingToken = (type: JsonNodeRecord["type"]) =>
  type === "array" ? "]" : "}";

const getContainerClassName = (type: JsonNodeRecord["type"]) =>
  type === "array" ? "text-token-array" : "text-token-object";

const getPrimitiveClassName = (type: JsonNodeRecord["type"]) => {
  if (type === "string") {
    return "text-token-string";
  }

  if (type === "number") {
    return "text-token-number";
  }

  if (type === "boolean") {
    return "text-token-boolean";
  }

  return "text-token-null";
};

type RowMetaProps = {
  enabled: boolean;
  path: string;
  query: string;
};

const RowMeta = ({ enabled, path, query }: RowMetaProps) => (
  <span className="ml-auto hidden text-[11px] uppercase tracking-[0.2em] text-muted/80 group-hover:inline">
    <HighlightedText text={getPathLabel(path)} query={query} enabled={enabled} />
  </span>
);

type GuideProps = {
  depth: number;
};

const Guide = ({ depth }: GuideProps) =>
  depth > 0 ? (
    <span
      aria-hidden
      className="absolute left-0 top-1 bottom-1 border-l border-guide"
      style={{ left: `${depth * 18 + 26}px` }}
    />
  ) : null;
