"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { JsonEditor } from "@/components/json-viewer/json-editor";
import { JsonSearchBar } from "@/components/json-viewer/json-search-bar";
import { JsonTree } from "@/components/json-viewer/json-tree";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  buildCollapseAllSet,
  buildJsonGraph,
  buildRootCollapsedSet,
  buildSearchIndex,
  createSearchState,
  isLargeGraph,
  parseJsonInput,
  type SearchIndex,
} from "@/lib/json-viewer";

const sampleJson = `{
  "name": "json-viewer",
  "version": 1,
  "enabled": true,
  "tags": ["parser", "viewer", "search"],
  "users": [
    {
      "id": 1,
      "profile": {
        "name": "Ava",
        "roles": ["admin", "editor"]
      }
    },
    {
      "id": 2,
      "profile": {
        "name": "Noah",
        "roles": ["viewer"]
      }
    }
  ]
}`;

const EMPTY_SEARCH_INDEX: SearchIndex = {
  ancestorMatchIds: new Set<string>(),
  directMatchIds: new Set<string>(),
  matchCount: 0,
};

const INPUT_DEBOUNCE_MS = 180;
const SEARCH_DEBOUNCE_MS = 120;
const HEAVY_PAYLOAD_NODE_THRESHOLD = 1500;

export const JsonWorkbench = () => {
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState(sampleJson);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"text" | "path">("text");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [searchIndex, setSearchIndex] = useState<SearchIndex>(EMPTY_SEARCH_INDEX);
  const [resolvedSearchToken, setResolvedSearchToken] = useState("");
  const lastParsedInputRef = useRef("");
  const debouncedInput = useDebouncedValue(input, INPUT_DEBOUNCE_MS);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const parsed = useMemo(() => parseJsonInput(debouncedInput), [debouncedInput]);
  const graph = useMemo(
    () => (parsed.valid ? buildJsonGraph(parsed.value) : null),
    [parsed],
  );
  const searchState = useMemo(
    () => createSearchState(debouncedSearchQuery, searchMode),
    [debouncedSearchQuery, searchMode],
  );
  const isParsing = input !== debouncedInput;
  const searchToken = `${searchMode}:${searchState.query}`;
  const isSearching =
    searchQuery !== debouncedSearchQuery ||
    (Boolean(searchState.query) && resolvedSearchToken !== searchToken);

  useEffect(() => {
    if (!parsed.valid || !graph || debouncedInput === lastParsedInputRef.current) {
      return;
    }

    lastParsedInputRef.current = debouncedInput;

    startTransition(() => {
      setCollapsedIds(
        isLargeGraph(graph, HEAVY_PAYLOAD_NODE_THRESHOLD)
          ? buildRootCollapsedSet(graph)
          : new Set(),
      );
    });
  }, [debouncedInput, graph, parsed, startTransition]);

  useEffect(() => {
    const nextIndex =
      !graph || !searchState.query
        ? EMPTY_SEARCH_INDEX
        : buildSearchIndex(graph, searchState);

    const timeoutId = window.setTimeout(() => {
      setSearchIndex(nextIndex);
      setResolvedSearchToken(searchToken);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [graph, searchState, searchToken]);

  const togglePath = (path: string) => {
    startTransition(() => {
      setCollapsedIds((current) => {
        const next = new Set(current);

        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }

        return next;
      });
    });
  };

  const handlePrettyPrint = () => {
    if (!parsed.valid) {
      return;
    }

    setInput(JSON.stringify(parsed.value, null, 2));
  };

  const handleCollapseAll = () => {
    if (!graph) {
      return;
    }

    startTransition(() => {
      setCollapsedIds(buildCollapseAllSet(graph));
    });
  };

  const handleExpandAll = () => {
    startTransition(() => {
      setCollapsedIds(new Set());
    });
  };

  return (
    <main className="app-shell">
      <section className="page-header">
        <p className="page-kicker">v1 plan to implement</p>
        <h1 className="page-title">JSON parser and interactive viewer</h1>
        <p className="page-copy">
          Paste JSON, validate it, pretty print it, search by text or nested path,
          and expand or collapse deeply nested arrays and objects.
        </p>
      </section>

      <section className="workspace-grid">
        <JsonEditor
          input={input}
          onInputChange={setInput}
          onPrettyPrint={handlePrettyPrint}
          onCollapseAll={handleCollapseAll}
          onExpandAll={handleExpandAll}
          isValid={parsed.valid}
          validationMessage={
            isParsing
              ? "Parsing updated JSON..."
              : parsed.valid
                ? "Valid JSON"
                : parsed.error
          }
          isBusy={isParsing || isPending}
        />

        <section className="viewer-panel">
          <JsonSearchBar
            mode={searchMode}
            query={searchQuery}
            onModeChange={setSearchMode}
            onQueryChange={setSearchQuery}
            matchCount={searchIndex.matchCount}
            isBusy={isSearching}
          />

          {isSearching ? (
            <div className="activity-strip">Searching large JSON payload...</div>
          ) : null}

          <div className="viewer-surface">
            {isParsing ? (
              <div className="empty-state">Parsing large JSON payload...</div>
            ) : graph ? (
              <JsonTree
                graph={graph}
                collapsedIds={collapsedIds}
                onTogglePath={togglePath}
                searchState={searchState}
                searchIndex={searchIndex}
              />
            ) : (
              <div className="empty-state">
                Parsed JSON will appear here once the input is valid.
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
};
