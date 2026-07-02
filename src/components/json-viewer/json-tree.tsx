"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { JsonNode } from "@/components/json-viewer/json-node";
import {
  buildVisibleTreeRows,
  type DiffIndex,
  type JsonGraph,
  type JsonNodeRecord,
  type SearchIndex,
  type SearchState,
  type VisibleTreeRow,
} from "@/lib/json-viewer";

const OVERSCAN_ROWS = 12;
const ROW_HEIGHT = 32;
const VIRTUALIZATION_THRESHOLD = 250;

type JsonTreeProps = {
  collapsedIds: Set<string>;
  diffIndex: DiffIndex;
  graph: JsonGraph;
  onCopyNode: (path: string) => void;
  onTogglePath: (path: string) => void;
  searchState: SearchState;
  searchIndex: SearchIndex;
};

export const JsonTree = ({
  collapsedIds,
  diffIndex,
  graph,
  onCopyNode,
  onTogglePath,
  searchState,
  searchIndex,
}: JsonTreeProps) => {
  const rows = useMemo(
    () => buildVisibleTreeRows(graph, collapsedIds, searchIndex, searchState),
    [collapsedIds, graph, searchIndex, searchState],
  );
  const shouldVirtualize = rows.length > VIRTUALIZATION_THRESHOLD;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(640);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const updateHeight = () => {
      setViewportHeight(element.clientHeight || 640);
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const startIndex = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS)
    : 0;
  const endIndex = shouldVirtualize
    ? Math.min(
        rows.length,
        startIndex + Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2,
      )
    : rows.length;
  const visibleRows = shouldVirtualize ? rows.slice(startIndex, endIndex) : rows;
  const offsetTop = shouldVirtualize ? startIndex * ROW_HEIGHT : 0;

  return (
    <div
      ref={containerRef}
      className="h-full min-w-max overflow-auto"
      onScroll={
        shouldVirtualize
          ? (event) => setScrollTop(event.currentTarget.scrollTop)
          : undefined
      }
    >
      {shouldVirtualize ? (
        <div
          className="relative min-w-max"
          style={{ height: `${rows.length * ROW_HEIGHT}px` }}
        >
          <div
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${offsetTop}px)` }}
          >
            {visibleRows.map((row) => (
              <TreeRow
                key={row.id}
                collapsedIds={collapsedIds}
                diffIndex={diffIndex}
                graph={graph}
                onCopyNode={onCopyNode}
                onTogglePath={onTogglePath}
                row={row}
                searchIndex={searchIndex}
                searchState={searchState}
              />
            ))}
          </div>
        </div>
      ) : (
        visibleRows.map((row) => (
          <TreeRow
            key={row.id}
            collapsedIds={collapsedIds}
            diffIndex={diffIndex}
            graph={graph}
            onCopyNode={onCopyNode}
            onTogglePath={onTogglePath}
            row={row}
            searchIndex={searchIndex}
            searchState={searchState}
          />
        ))
      )}
    </div>
  );
};

type TreeRowProps = {
  collapsedIds: Set<string>;
  diffIndex: DiffIndex;
  graph: JsonGraph;
  onCopyNode: (path: string) => void;
  onTogglePath: (path: string) => void;
  row: VisibleTreeRow;
  searchIndex: SearchIndex;
  searchState: SearchState;
};

const TreeRow = memo(
  ({
    collapsedIds,
    diffIndex,
    graph,
    onCopyNode,
    onTogglePath,
    row,
    searchIndex,
    searchState,
  }: TreeRowProps) => {
    const node = graph.nodeById.get(row.id) as JsonNodeRecord | undefined;

    if (!node) {
      return null;
    }

    return (
      <JsonNode
        collapsedIds={collapsedIds}
        diffIndex={diffIndex}
        node={node}
        onCopyNode={onCopyNode}
        onTogglePath={onTogglePath}
        row={row}
        searchIndex={searchIndex}
        searchState={searchState}
      />
    );
  },
);

TreeRow.displayName = "TreeRow";
