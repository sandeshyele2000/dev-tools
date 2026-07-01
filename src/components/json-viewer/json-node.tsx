import { memo, useMemo } from "react";
import {
  type DiffIndex,
  getPathLabel,
  splitMatches,
  type JsonNodeRecord,
  type SearchIndex,
  type SearchState,
} from "@/lib/json-viewer";

type JsonNodeProps = {
  collapsedIds: Set<string>;
  diffIndex: DiffIndex;
  node: JsonNodeRecord;
  onTogglePath: (path: string) => void;
  searchIndex: SearchIndex;
  searchState: SearchState;
};

export const JsonNode = memo(
  ({
    collapsedIds,
    diffIndex,
    node,
    onTogglePath,
    searchIndex,
    searchState,
  }: JsonNodeProps) => {
    const isCollapsed = collapsedIds.has(node.id);
    const hasSearch = searchState.query.length > 0;
    const nodeMatch = searchIndex.directMatchIds.has(node.id);
    const descendantMatch = searchIndex.ancestorMatchIds.has(node.id);
    const shouldShowContext = hasSearch && !nodeMatch && descendantMatch;
    const nodeChanged = diffIndex.changedIds.has(node.id);
    const ancestorChanged = diffIndex.ancestorIds.has(node.id);
    const rowClassName = [
      "flex min-h-[38px] items-center gap-2 border-l-2 border-transparent pr-4 text-base hover:bg-hover-panel",
      nodeMatch ? "border-l-accent bg-accent-panel" : "",
      shouldShowContext ? "border-l-accent-border bg-accent-subtle" : "",
      nodeChanged ? "border-l-warn bg-warn-panel" : "",
      ancestorChanged && !nodeChanged ? "border-l-warn-border bg-warn-subtle" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="border-b border-b-border-muted">
        <div className={rowClassName} style={{ paddingLeft: `${node.depth * 20}px` }}>
          {node.expandable ? (
            <button
              type="button"
              className="h-6 min-h-6 w-6 min-w-6 border border-border-default bg-background text-foreground hover:border-accent-border hover:text-accent"
              onClick={() => onTogglePath(node.id)}
              aria-label={isCollapsed ? "Expand node" : "Collapse node"}
            >
              {isCollapsed ? "+" : "-"}
            </button>
          ) : (
            <span className="inline-block h-6 w-6 min-w-6" />
          )}

          <span className="font-mono text-foreground">
            <HighlightedText
              text={String(node.key)}
              query={searchState.query}
              enabled={searchState.mode === "text"}
            />
          </span>

          <span className="font-mono text-muted">:</span>

          {node.expandable ? (
            <span className="font-mono text-muted">
              {node.summary}
              {node.childCount > 0 ? ` ${isCollapsed ? "collapsed" : "open"}` : ""}
            </span>
          ) : (
            <span
              className={`font-mono ${
                node.type === "string"
                  ? "text-foreground"
                  : "text-muted-soft"
              }`}
            >
              <HighlightedText
                text={node.primitiveDisplay}
                query={searchState.query}
                enabled={searchState.mode === "text"}
              />
            </span>
          )}

          <span className="ml-auto font-mono text-xs text-muted">
            <HighlightedText
              text={getPathLabel(node.path)}
              query={searchState.query}
              enabled={searchState.mode === "path"}
            />
          </span>
        </div>
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
              className="bg-accent-soft px-0 text-accent"
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
