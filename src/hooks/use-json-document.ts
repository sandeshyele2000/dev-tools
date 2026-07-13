"use client";

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  buildCollapseAllSet,
  buildRootCollapsedSet,
  createSearchState,
  EMPTY_SEARCH_INDEX,
  isHeavyGraph,
  materializeSearchIndex,
  revealNodeInTree,
  VISIBLE_CHILDREN_INCREMENT,
  toggleCollapsedPath,
  type DiffSnapshot,
  type JsonGraph,
  type NodeId,
  type SearchIndex,
  type SearchMode,
  type SearchSnapshot,
} from "@/lib/json-viewer";

type WorkerRequest =
  | {
      type: "copy-node";
      documentId: string;
      path: string;
      requestId: number;
    }
  | {
      type: "compute-diff";
      baselineInput: string;
      documentId: string;
      requestId: number;
    }
  | {
      type: "format-document";
      documentId: string;
      indentation: number;
      requestId: number;
    }
  | {
      type: "parse-document";
      documentId: string;
      input: string;
      requestId: number;
    }
  | {
      type: "search-document";
      documentId: string;
      mode: SearchMode;
      query: string;
      requestId: number;
    };

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
      requestId: number;
      type: "parse-document-result";
      compactText: string;
      error: string;
      graph: JsonGraph | null;
      valid: boolean;
    }
  | {
      requestId: number;
      type: "search-document-result";
      value: SearchSnapshot;
    };

type PendingRequest = {
  reject: (reason?: unknown) => void;
  resolve: (value: WorkerResponse) => void;
};

type JsonDocumentController = {
  activeMatchId: NodeId | null;
  collapsedIds: Set<NodeId>;
  compactText: string;
  copyDocument: () => Promise<string>;
  copyNode: (path: string) => Promise<string>;
  diff: (baselineInput: string) => Promise<DiffSnapshot>;
  error: string;
  expandAllDisabledReason: string | null;
  graph: JsonGraph | null;
  input: string;
  inputVersion: string;
  isHeavy: boolean;
  isParsing: boolean;
  isSearching: boolean;
  matchCursor: number;
  prettyPrint: () => Promise<void>;
  searchIndex: SearchIndex;
  searchMode: SearchMode;
  searchQuery: string;
  setInput: (value: string) => void;
  setSearchMode: (mode: SearchMode) => void;
  setSearchQuery: (value: string) => void;
  setVisibleChildCountById: Dispatch<SetStateAction<Record<NodeId, number>>>;
  showMoreChildren: (path: NodeId) => void;
  togglePath: (path: NodeId) => void;
  valid: boolean;
  visibleChildCountById: Record<NodeId, number>;
  goToNextMatch: () => void;
  goToPreviousMatch: () => void;
  collapseAll: () => void;
  expandAll: () => void;
};

const INPUT_DEBOUNCE_MS = 180;
const SEARCH_DEBOUNCE_MS = 120;

export const useJsonDocument = (
  documentId: string,
  initialInput: string,
): JsonDocumentController => {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingRequestsRef = useRef(new Map<number, PendingRequest>());
  const latestParseRequestIdRef = useRef(0);
  const latestSearchRequestIdRef = useRef(0);
  const [input, setInput] = useState(initialInput);
  const [graph, setGraph] = useState<JsonGraph | null>(null);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState("Paste JSON to start parsing.");
  const [compactText, setCompactText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [searchingState, setSearchingState] = useState(false);
  const [isHeavy, setIsHeavy] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<NodeId>>(new Set());
  const [visibleChildCountById, setVisibleChildCountById] = useState<Record<NodeId, number>>(
    {},
  );
  const [searchMode, setSearchMode] = useState<SearchMode>("text");
  const [searchQuery, setSearchQuery] = useState("");
  const [remoteSearchIndex, setRemoteSearchIndex] = useState<SearchIndex>(EMPTY_SEARCH_INDEX);
  const [matchCursor, setMatchCursor] = useState(-1);
  const debouncedInput = useDebouncedValue(input, INPUT_DEBOUNCE_MS);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);
  const inputVersion = useMemo(() => debouncedInput, [debouncedInput]);
  const searchState = useMemo(
    () => createSearchState(debouncedSearchQuery, searchMode),
    [debouncedSearchQuery, searchMode],
  );
  const graphRef = useRef<JsonGraph | null>(null);
  const collapsedIdsRef = useRef(collapsedIds);
  const visibleChildCountByIdRef = useRef(visibleChildCountById);
  const searchIndex = searchState.query ? remoteSearchIndex : EMPTY_SEARCH_INDEX;
  const isSearching = searchState.query ? searchingState : false;
  const activeMatchId =
    matchCursor >= 0 ? searchIndex.orderedMatchIds[matchCursor] ?? null : null;

  useEffect(() => {
    graphRef.current = graph;
  }, [graph]);

  useEffect(() => {
    collapsedIdsRef.current = collapsedIds;
  }, [collapsedIds]);

  useEffect(() => {
    visibleChildCountByIdRef.current = visibleChildCountById;
  }, [visibleChildCountById]);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/json-document-worker.ts", import.meta.url),
      { type: "module" },
    );
    const pendingRequests = pendingRequestsRef.current;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pendingRequest = pendingRequests.get(response.requestId);

      if (!pendingRequest) {
        return;
      }

      pendingRequests.delete(response.requestId);

      if (response.type === "error") {
        pendingRequest.reject(new Error(response.error));
        return;
      }

      pendingRequest.resolve(response);
    };

    workerRef.current = worker;

    return () => {
      pendingRequests.forEach(({ reject }) => {
        reject(new Error("Worker terminated."));
      });
      pendingRequests.clear();
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const revealMatch = useCallback((nodeId: NodeId) => {
    const currentGraph = graphRef.current;

    if (!currentGraph) {
      return;
    }

    const revealedTree = revealNodeInTree(
      currentGraph,
      nodeId,
      collapsedIdsRef.current,
      visibleChildCountByIdRef.current,
    );

    setCollapsedIds(revealedTree.collapsedIds);
    setVisibleChildCountById(revealedTree.visibleChildCountById);
  }, []);

  useEffect(() => {
    const worker = workerRef.current;

    if (!worker) {
      return;
    }

    setIsParsing(true);
    const requestId = nextRequestId(requestIdRef);
    latestParseRequestIdRef.current = requestId;

    void sendWorkerRequest(worker, pendingRequestsRef.current, {
      type: "parse-document",
      documentId,
      input: debouncedInput,
      requestId,
    })
      .then((response) => {
        if (
          response.type !== "parse-document-result" ||
          response.requestId !== latestParseRequestIdRef.current
        ) {
          return;
        }

        setIsParsing(false);
        setValid(response.valid);
        setError(response.error);
        setGraph(response.graph);
        setCompactText(response.compactText);
        setRemoteSearchIndex(EMPTY_SEARCH_INDEX);
        setMatchCursor(-1);
        setSearchingState(false);

        if (!response.valid || !response.graph) {
          setIsHeavy(false);
          setCollapsedIds(new Set());
          setVisibleChildCountById({});
          return;
        }

        const nextIsHeavy = isHeavyGraph(response.graph);
        setIsHeavy(nextIsHeavy);
        setCollapsedIds(nextIsHeavy ? buildRootCollapsedSet(response.graph) : new Set());
        setVisibleChildCountById({});
      })
      .catch((requestError) => {
        if (requestId !== latestParseRequestIdRef.current) {
          return;
        }

        setIsParsing(false);
        setValid(false);
        setGraph(null);
        setCompactText("");
        setError(
          requestError instanceof Error ? requestError.message : "Could not parse JSON.",
        );
      });
  }, [debouncedInput, documentId]);

  useEffect(() => {
    const worker = workerRef.current;

    if (!worker || !graph || !valid || !searchState.query) {
      return;
    }

    setSearchingState(true);
    const requestId = nextRequestId(requestIdRef);
    latestSearchRequestIdRef.current = requestId;

    void sendWorkerRequest(worker, pendingRequestsRef.current, {
      type: "search-document",
      documentId,
      mode: searchMode,
      query: searchState.query,
      requestId,
    })
      .then((response) => {
        if (
          response.type !== "search-document-result" ||
          response.requestId !== latestSearchRequestIdRef.current
        ) {
          return;
        }

        const nextSearchIndex = materializeSearchIndex(response.value);
        setSearchingState(false);
        setRemoteSearchIndex(nextSearchIndex);
        if (nextSearchIndex.orderedMatchIds.length > 0) {
          setMatchCursor(0);
          revealMatch(nextSearchIndex.orderedMatchIds[0]);
        } else {
          setMatchCursor(-1);
        }
      })
      .catch(() => {
        if (requestId !== latestSearchRequestIdRef.current) {
          return;
        }

        setSearchingState(false);
        setRemoteSearchIndex(EMPTY_SEARCH_INDEX);
        setMatchCursor(-1);
      });
  }, [documentId, graph, revealMatch, searchMode, searchState.query, valid]);

  const copyNode = useCallback(async (path: string) => {
    const worker = workerRef.current;

    if (!worker) {
      throw new Error("Worker is not ready.");
    }

    const response = await sendWorkerRequest(worker, pendingRequestsRef.current, {
      type: "copy-node",
      documentId,
      path,
      requestId: nextRequestId(requestIdRef),
    });

    if (response.type !== "copy-node-result") {
      throw new Error("Unexpected worker response.");
    }

    return response.value;
  }, [documentId]);

  const prettyPrint = useCallback(async () => {
    const worker = workerRef.current;

    if (!worker) {
      throw new Error("Worker is not ready.");
    }

    const response = await sendWorkerRequest(worker, pendingRequestsRef.current, {
      type: "format-document",
      documentId,
      indentation: 2,
      requestId: nextRequestId(requestIdRef),
    });

    if (response.type !== "format-document-result") {
      throw new Error("Unexpected worker response.");
    }

    setInput(response.value);
  }, [documentId]);

  const diff = useCallback(async (baselineInput: string) => {
    const worker = workerRef.current;

    if (!worker) {
      throw new Error("Worker is not ready.");
    }

    const response = await sendWorkerRequest(worker, pendingRequestsRef.current, {
      type: "compute-diff",
      baselineInput,
      documentId,
      requestId: nextRequestId(requestIdRef),
    });

    if (response.type !== "compute-diff-result") {
      throw new Error("Unexpected worker response.");
    }

    return response.value;
  }, [documentId]);

  return {
    activeMatchId,
    collapsedIds,
    collapseAll: () => {
      if (!graph) {
        return;
      }

      setCollapsedIds(buildCollapseAllSet(graph));
    },
    compactText,
    copyDocument: () => copyNode("root"),
    copyNode,
    diff,
    error,
    expandAll: () => {
      setCollapsedIds(new Set());
    },
    expandAllDisabledReason: isHeavy
      ? "Expand all is disabled in heavy mode to avoid locking the UI."
      : null,
    goToNextMatch: () => {
      if (searchIndex.orderedMatchIds.length === 0) {
        return;
      }

      setMatchCursor((current) => {
        const nextCursor = (current + 1) % searchIndex.orderedMatchIds.length;
        revealMatch(searchIndex.orderedMatchIds[nextCursor]);
        return nextCursor;
      });
    },
    goToPreviousMatch: () => {
      if (searchIndex.orderedMatchIds.length === 0) {
        return;
      }

      setMatchCursor((current) => {
        const nextCursor =
          current <= 0 ? searchIndex.orderedMatchIds.length - 1 : current - 1;
        revealMatch(searchIndex.orderedMatchIds[nextCursor]);
        return nextCursor;
      });
    },
    graph,
    input,
    inputVersion,
    isHeavy,
    isParsing,
    isSearching,
    matchCursor,
    prettyPrint,
    searchIndex,
    searchMode,
    searchQuery,
    setInput,
    setSearchMode,
    setSearchQuery,
    setVisibleChildCountById,
    showMoreChildren: (path) => {
      setVisibleChildCountById((current) => ({
        ...current,
        [path]: (current[path] ?? 0) + VISIBLE_CHILDREN_INCREMENT,
      }));
    },
    togglePath: (path) => {
      setCollapsedIds((current) => toggleCollapsedPath(current, path));
    },
    valid,
    visibleChildCountById,
  };
};

const nextRequestId = (requestIdRef: MutableRefObject<number>) => {
  requestIdRef.current += 1;
  return requestIdRef.current;
};

const sendWorkerRequest = (
  worker: Worker,
  pendingRequests: Map<number, PendingRequest>,
  message: WorkerRequest,
) =>
  new Promise<WorkerResponse>((resolve, reject) => {
    pendingRequests.set(message.requestId, {
      reject,
      resolve,
    });
    worker.postMessage(message);
  });
