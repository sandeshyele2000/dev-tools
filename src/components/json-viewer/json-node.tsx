import { memo, useMemo } from "react";
import {
  getPathLabel,
  splitMatches,
  type JsonNodeRecord,
  type SearchIndex,
  type SearchState,
} from "@/lib/json-viewer";

type JsonNodeProps = {
  collapsedIds: Set<string>;
  node: JsonNodeRecord;
  onTogglePath: (path: string) => void;
  searchIndex: SearchIndex;
  searchState: SearchState;
};

export const JsonNode = memo(
  ({ collapsedIds, node, onTogglePath, searchIndex, searchState }: JsonNodeProps) => {
    const isCollapsed = collapsedIds.has(node.id);
    const hasSearch = searchState.query.length > 0;
    const nodeMatch = searchIndex.directMatchIds.has(node.id);
    const descendantMatch = searchIndex.ancestorMatchIds.has(node.id);
    const shouldShowContext = hasSearch && !nodeMatch && descendantMatch;

    return (
      <div className="tree-node">
        <div
          className={`tree-row ${nodeMatch ? "tree-row-match" : ""} ${
            shouldShowContext ? "tree-row-context" : ""
          }`}
          style={{ paddingLeft: `${node.depth * 20}px` }}
        >
          {node.expandable ? (
            <button
              type="button"
              className="toggle-button"
              onClick={() => onTogglePath(node.id)}
              aria-label={isCollapsed ? "Expand node" : "Collapse node"}
            >
              {isCollapsed ? "+" : "-"}
            </button>
          ) : (
            <span className="toggle-spacer" />
          )}

          <span className="node-key">
            <HighlightedText
              text={String(node.key)}
              query={searchState.query}
              enabled={searchState.mode === "text"}
            />
          </span>

          <span className="node-separator">:</span>

          {node.expandable ? (
            <span className="node-summary">
              {node.summary}
              {node.childCount > 0 ? ` ${isCollapsed ? "collapsed" : "open"}` : ""}
            </span>
          ) : (
            <span className={`node-value node-value-${node.type}`}>
              <HighlightedText
                text={node.primitiveDisplay}
                query={searchState.query}
                enabled={searchState.mode === "text"}
              />
            </span>
          )}

          <span className="node-path">
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
            <mark key={`${part.value}-${index}`} className="search-highlight">
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
