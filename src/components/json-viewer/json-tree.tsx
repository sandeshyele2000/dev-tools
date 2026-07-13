"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { JsonNode } from "@/components/json-viewer/json-node";
import {
  buildVisibleTreeRows,
  type DiffIndex,
  type JsonGraph,
  type SearchIndex,
  type SearchState,
  type VisibleTreeRow,
} from "@/lib/json-viewer";

const OVERSCAN_ROWS = 12;
const ROW_HEIGHT = 32;
const VIRTUALIZATION_THRESHOLD = 250;

const getRowKey = (row: VisibleTreeRow) =>
  row.kind === "show-more" ? row.id : `${row.id}:${row.kind}`;

type JsonTreeProps = {
  activeMatchId: string | null;
  collapsedIds: Set<string>;
  diffIndex: DiffIndex;
  graph: JsonGraph;
  isHeavy: boolean;
  onCopyNode: (path: string) => void;
  onShowMore: (path: string) => void;
  onTogglePath: (path: string) => void;
  searchIndex: SearchIndex;
  searchState: SearchState;
  visibleChildCountById: Record<string, number>;
};

export const JsonTree = ({
  activeMatchId,
  collapsedIds,
  diffIndex,
  graph,
  isHeavy,
  onCopyNode,
  onShowMore,
  onTogglePath,
  searchIndex,
  searchState,
  visibleChildCountById,
}: JsonTreeProps) => {
  const rows = useMemo(
    () =>
      buildVisibleTreeRows(
        graph,
        collapsedIds,
        searchIndex,
        searchState,
        visibleChildCountById,
        isHeavy,
      ),
    [collapsedIds, graph, isHeavy, searchIndex, searchState, visibleChildCountById],
  );
  const activeMatchRowIndex = useMemo(
    () =>
      activeMatchId
        ? rows.findIndex((row) => row.kind === "node" && row.id === activeMatchId)
        : -1,
    [activeMatchId, rows],
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

  useEffect(() => {
    const element = containerRef.current;

    if (!element || activeMatchRowIndex < 0) {
      return;
    }

    const rowTop = activeMatchRowIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const viewportBottom = scrollTop + viewportHeight;

    if (rowTop < scrollTop) {
      element.scrollTop = rowTop;
      return;
    }

    if (rowBottom > viewportBottom) {
      element.scrollTop = Math.max(0, rowBottom - viewportHeight);
    }
  }, [activeMatchRowIndex, scrollTop, viewportHeight]);

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
                key={getRowKey(row)}
                activeMatchId={activeMatchId}
                collapsedIds={collapsedIds}
                diffIndex={diffIndex}
                graph={graph}
                onCopyNode={onCopyNode}
                onShowMore={onShowMore}
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
            key={getRowKey(row)}
            activeMatchId={activeMatchId}
            collapsedIds={collapsedIds}
            diffIndex={diffIndex}
            graph={graph}
            onCopyNode={onCopyNode}
            onShowMore={onShowMore}
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
  activeMatchId: string | null;
  collapsedIds: Set<string>;
  diffIndex: DiffIndex;
  graph: JsonGraph;
  onCopyNode: (path: string) => void;
  onShowMore: (path: string) => void;
  onTogglePath: (path: string) => void;
  row: VisibleTreeRow;
  searchIndex: SearchIndex;
  searchState: SearchState;
};

const TreeRow = memo(
  ({
    activeMatchId,
    collapsedIds,
    diffIndex,
    graph,
    onCopyNode,
    onShowMore,
    onTogglePath,
    row,
    searchIndex,
    searchState,
  }: TreeRowProps) => {
    const node = row.kind === "show-more" ? null : graph.nodeById[row.id];

    return (
      <JsonNode
        activeMatchId={activeMatchId}
        collapsedIds={collapsedIds}
        diffIndex={diffIndex}
        node={node}
        onCopyNode={onCopyNode}
        onShowMore={onShowMore}
        onTogglePath={onTogglePath}
        row={row}
        searchIndex={searchIndex}
        searchState={searchState}
      />
    );
  },
);

TreeRow.displayName = "TreeRow";
