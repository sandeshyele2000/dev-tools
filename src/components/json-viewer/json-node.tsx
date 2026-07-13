import { memo, useMemo } from "react";
import {
  splitMatches,
  type DiffIndex,
  type JsonNodeRecord,
  type SearchIndex,
  type SearchState,
  type VisibleTreeRow,
} from "@/lib/json-viewer";

type JsonNodeProps = {
  activeMatchId: string | null;
  collapsedIds: Set<string>;
  diffIndex: DiffIndex;
  node: JsonNodeRecord | null;
  onCopyNode: (path: string) => void;
  onShowMore: (path: string) => void;
  onTogglePath: (path: string) => void;
  row: VisibleTreeRow;
  searchIndex: SearchIndex;
  searchState: SearchState;
};

export const JsonNode = memo(
  ({
    activeMatchId,
    collapsedIds,
    diffIndex,
    node,
    onCopyNode,
    onShowMore,
    onTogglePath,
    row,
    searchIndex,
    searchState,
  }: JsonNodeProps) => {
    if (row.kind === "show-more") {
      return (
        <div
          className="group relative flex min-h-[32px] items-center gap-3 border-l-2 border-transparent px-4 py-1 font-mono text-[15px] leading-6 hover:bg-hover-panel"
          style={{ paddingLeft: `${row.depth * 18 + 16}px` }}
        >
          <Guide depth={row.depth} />
          <button
            type="button"
            className="rounded-[4px] border border-border-default bg-panel px-2 py-0.5 text-[12px] uppercase tracking-[0.12em] text-muted hover:border-accent-border hover:text-accent"
            onClick={() => onShowMore(row.parentId)}
          >
            Show {row.remainingChildCount} more
          </button>
        </div>
      );
    }

    if (!node) {
      return null;
    }

    const isCollapsed = collapsedIds.has(node.id);
    const isRoot = node.parentId === null;
    const hasSearch = searchState.query.length > 0;
    const nodeMatch = searchIndex.directMatchIds.has(node.id);
    const descendantMatch = searchIndex.ancestorMatchIds.has(node.id);
    const shouldShowContext = hasSearch && !nodeMatch && descendantMatch;
    const isActiveMatch = activeMatchId === node.id;
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
      isActiveMatch ? "outline outline-1 outline-accent outline-offset-[-1px]" : "",
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
            className="absolute top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-[4px] border border-border-default bg-panel text-token-punctuation opacity-0 transition-opacity group-hover:opacity-100 hover:border-accent-border hover:text-accent"
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
            className="ml-2 rounded-[4px] border border-border-default px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:border-accent-border hover:text-accent"
            onClick={() => onCopyNode(node.path)}
            aria-label={`Copy ${node.path}`}
          >
            Copy
          </button>
        )}
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
              className="rounded-[3px] bg-accent-soft px-0.5 text-accent"
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

type GuideProps = {
  depth: number;
};

const Guide = ({ depth }: GuideProps) =>
  depth > 0 ? (
    <>
      {Array.from({ length: depth }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className="absolute top-1 bottom-1 border-l border-guide"
          style={{ left: `${index * 18 + 26}px` }}
        />
      ))}
    </>
  ) : null;
