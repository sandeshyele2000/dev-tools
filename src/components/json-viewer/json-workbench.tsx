"use client";

import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  TransitionStartFunction,
} from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Toaster, toast } from "react-hot-toast";
import { JsonSearchBar } from "@/components/json-viewer/json-search-bar";
import { JsonTree } from "@/components/json-viewer/json-tree";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  buildCollapseAllSet,
  buildDiffIndex,
  buildJsonGraph,
  buildSearchIndex,
  buildRootCollapsedSet,
  createSearchState,
  getValueAtPath,
  isLargeGraph,
  parseJsonInput,
  type DiffIndex,
  type JsonGraph,
  type ParseResult,
  type ViewerMode,
} from "@/lib/json-viewer";

const EMPTY_JSON_INPUT = "";

const EMPTY_DIFF_INDEX: DiffIndex = {
  ancestorIds: new Set<string>(),
  changedIds: new Set<string>(),
  entries: [],
  matchCount: 0,
};

const EMPTY_SEARCH_INDEX = {
  ancestorMatchIds: new Set<string>(),
  directMatchIds: new Set<string>(),
  matchCount: 0,
};

const INPUT_DEBOUNCE_MS = 180;
const HEAVY_PAYLOAD_NODE_THRESHOLD = 1500;
const SESSION_STORAGE_KEY = "json-viewer:sessions:v1";
const PANEL_TITLE_CLASS =
  "font-display text-xl font-semibold tracking-[-0.03em] text-foreground";
const PANEL_KICKER_CLASS =
  "mb-1.5 font-display text-xs uppercase tracking-[0.08em] text-muted";
const STATUS_BADGE_CLASS =
  "whitespace-nowrap border border-border-default bg-background px-[10px] py-[6px] text-base font-display tracking-[0.02em] text-foreground";
const BUTTON_CLASS =
  "border border-border-default bg-background px-[14px] py-[10px] text-base text-foreground enabled:hover:border-accent-border enabled:hover:text-accent disabled:cursor-not-allowed disabled:text-neutral-500";
const ACTIVE_BUTTON_CLASS = "border-accent-border text-accent";

type SavedSession = {
  id: string;
  leftInput: string;
  name: string;
  rightInput: string;
  updatedAt: string;
};

type StoredSessions = {
  activeSessionId: string | null;
  sessions: SavedSession[];
};

type JsonDocumentState = {
  collapsedIds: Set<string>;
  debouncedInput: string;
  graph: JsonGraph | null;
  input: string;
  isParsing: boolean;
  lastParsedInputRef: MutableRefObject<string>;
  parsed: ParseResult;
  setCollapsedIds: Dispatch<SetStateAction<Set<string>>>;
  setInput: Dispatch<SetStateAction<string>>;
};

const useJsonDocument = (initialInput: string): JsonDocumentState => {
  const [input, setInput] = useState(initialInput);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const lastParsedInputRef = useRef("");
  const debouncedInput = useDebouncedValue(input, INPUT_DEBOUNCE_MS);
  const parsed = useMemo(() => parseJsonInput(debouncedInput), [debouncedInput]);
  const graph = useMemo(
    () => (parsed.valid ? buildJsonGraph(parsed.value) : null),
    [parsed],
  );
  const isParsing = input !== debouncedInput;

  return {
    collapsedIds,
    debouncedInput,
    graph,
    input,
    isParsing,
    lastParsedInputRef,
    parsed,
    setCollapsedIds,
    setInput,
  };
};

export const JsonWorkbench = () => {
  const [, startTransition] = useTransition();
  const [viewerMode, setViewerMode] = useState<ViewerMode>("tree");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [leftSearchMode, setLeftSearchMode] = useState<"text" | "path">("text");
  const [rightSearchMode, setRightSearchMode] = useState<"text" | "path">("text");
  const [leftSearchQuery, setLeftSearchQuery] = useState("");
  const [rightSearchQuery, setRightSearchQuery] = useState("");
  const left = useJsonDocument(EMPTY_JSON_INPUT);
  const right = useJsonDocument(EMPTY_JSON_INPUT);
  const setLeftDocumentInput = left.setInput;
  const setRightDocumentInput = right.setInput;

  // Hydrate session state from localStorage after mount.
  useEffect(() => {
    const storedValue = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const storedSessions = parseStoredSessions(storedValue);
    const initialSession =
      storedSessions.sessions.find((session) => session.id === storedSessions.activeSessionId) ??
      storedSessions.sessions[0] ??
      createSession("Session 1", EMPTY_JSON_INPUT, EMPTY_JSON_INPUT);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessions(
      storedSessions.sessions.length > 0 ? storedSessions.sessions : [initialSession],
    );
    setActiveSessionId(initialSession.id);
    setLeftDocumentInput(initialSession.leftInput);
    setRightDocumentInput(initialSession.rightInput);
  }, [setLeftDocumentInput, setRightDocumentInput]);

  useEffect(() => {
    syncCollapsedState(left, startTransition);
  }, [left, startTransition]);

  useEffect(() => {
    syncCollapsedState(right, startTransition);
  }, [right, startTransition]);

  const leftDiffIndex = useMemo(
    () =>
      left.parsed.valid && right.parsed.valid
        ? buildDiffIndex(left.graph, left.parsed.value, right.parsed.value)
        : EMPTY_DIFF_INDEX,
    [left.graph, left.parsed, right.parsed],
  );

  const rightDiffIndex = useMemo(
    () =>
      left.parsed.valid && right.parsed.valid
        ? buildDiffIndex(right.graph, right.parsed.value, left.parsed.value)
        : EMPTY_DIFF_INDEX,
    [left.parsed, right.graph, right.parsed],
  );

  const leftSearchState = useMemo(
    () => createSearchState(leftSearchQuery, leftSearchMode),
    [leftSearchMode, leftSearchQuery],
  );
  const rightSearchState = useMemo(
    () => createSearchState(rightSearchQuery, rightSearchMode),
    [rightSearchMode, rightSearchQuery],
  );

  const leftSearchIndex = useMemo(
    () => (left.graph ? buildSearchIndex(left.graph, leftSearchState) : EMPTY_SEARCH_INDEX),
    [left.graph, leftSearchState],
  );
  const rightSearchIndex = useMemo(
    () => (right.graph ? buildSearchIndex(right.graph, rightSearchState) : EMPTY_SEARCH_INDEX),
    [right.graph, rightSearchState],
  );

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const totalSessionCount = sessions.length;

  const persistSessions = (
    nextSessions: SavedSession[],
    nextActiveSessionId: string | null,
  ) => {
    const payload: StoredSessions = {
      activeSessionId: nextActiveSessionId,
      sessions: nextSessions,
    };

    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  };

  const showToast = (message: string, tone: "error" | "success") => {
    if (tone === "success") {
      toast.success(message);
      return;
    }

    toast.error(message);
  };

  const writeClipboard = async (
    value: unknown,
    options: {
      failureMessage: string;
      successMessage: string;
    },
  ) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      showToast(options.successMessage, "success");
    } catch {
      showToast(options.failureMessage, "error");
    }
  };

  const handleLeftInputChange = (value: string) => {
    left.setInput(value);
  };

  const handleRightInputChange = (value: string) => {
    right.setInput(value);
  };

  const handlePrettyPrintLeft = () => {
    if (!left.parsed.valid) {
      return;
    }

    handleLeftInputChange(JSON.stringify(left.parsed.value, null, 2));
  };

  const handlePrettyPrintRight = () => {
    if (!right.parsed.valid) {
      return;
    }

    handleRightInputChange(JSON.stringify(right.parsed.value, null, 2));
  };

  const handleCopyLeftDocument = () => {
    if (!left.parsed.valid) {
      return;
    }

    void writeClipboard(left.parsed.value, {
      failureMessage: "Could not copy the left JSON to the clipboard.",
      successMessage: "Left JSON copied.",
    });
  };

  const handleCopyRightDocument = () => {
    if (!right.parsed.valid) {
      return;
    }

    void writeClipboard(right.parsed.value, {
      failureMessage: "Could not copy the right JSON to the clipboard.",
      successMessage: "Right JSON copied.",
    });
  };

  const handleCopyLeftNode = (path: string) => {
    if (!left.parsed.valid) {
      return;
    }

    const value = getValueAtPath(left.parsed.value, path);

    void writeClipboard(value, {
      failureMessage: `Could not copy ${path} to the clipboard.`,
      successMessage: `Copied ${path}.`,
    });
  };

  const handleCopyRightNode = (path: string) => {
    if (!right.parsed.valid) {
      return;
    }

    const value = getValueAtPath(right.parsed.value, path);

    void writeClipboard(value, {
      failureMessage: `Could not copy ${path} to the clipboard.`,
      successMessage: `Copied ${path}.`,
    });
  };

  const handleCollapseAll = () => {
    startTransition(() => {
      if (left.graph) {
        left.setCollapsedIds(buildCollapseAllSet(left.graph));
      }

      if (right.graph) {
        right.setCollapsedIds(buildCollapseAllSet(right.graph));
      }
    });
  };

  const handleExpandAll = () => {
    startTransition(() => {
      left.setCollapsedIds(new Set());
      right.setCollapsedIds(new Set());
    });
  };

  const toggleLeftPath = (path: string) => {
    startTransition(() => {
      left.setCollapsedIds((current) => toggleCollapsedPath(current, path));
    });
  };

  const toggleRightPath = (path: string) => {
    startTransition(() => {
      right.setCollapsedIds((current) => toggleCollapsedPath(current, path));
    });
  };

  const handleCreateSession = () => {
    const nextSession = createSession(`Session ${sessions.length + 1}`, EMPTY_JSON_INPUT, EMPTY_JSON_INPUT);
    const nextSessions = [nextSession, ...sessions];

    setSessions(nextSessions);
    setActiveSessionId(nextSession.id);
    left.setInput(nextSession.leftInput);
    right.setInput(nextSession.rightInput);

    try {
      persistSessions(nextSessions, nextSession.id);
    } catch {
      showToast("Session created, but it could not be saved locally.", "error");
    }
  };

  const handleLoadSession = (sessionId: string) => {
    const selectedSession = sessions.find((session) => session.id === sessionId);

    if (!selectedSession) {
      return;
    }

    setActiveSessionId(selectedSession.id);
    left.setInput(selectedSession.leftInput);
    right.setInput(selectedSession.rightInput);
    setIsDrawerOpen(false);

    try {
      persistSessions(sessions, selectedSession.id);
    } catch {
      showToast("Session loaded, but active session state could not be saved locally.", "error");
    }
  };

  const handleSaveSession = () => {
    if (!activeSessionId) {
      return;
    }

    const nextSessions = sessions.map((session) =>
      session.id === activeSessionId
        ? {
            ...session,
            leftInput: left.input,
            rightInput: right.input,
            updatedAt: new Date().toISOString(),
          }
        : session,
    );

    setSessions(nextSessions);

    try {
      persistSessions(nextSessions, activeSessionId);
      showToast("Session saved.", "success");
    } catch (error) {
      showToast(getSaveErrorMessage(error), "error");
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const remainingSessions = sessions.filter((session) => session.id !== sessionId);

    if (remainingSessions.length === 0) {
      const fallbackSession = createSession("Session 1", EMPTY_JSON_INPUT, EMPTY_JSON_INPUT);
      setSessions([fallbackSession]);
      setActiveSessionId(fallbackSession.id);
      left.setInput(fallbackSession.leftInput);
      right.setInput(fallbackSession.rightInput);

      try {
        persistSessions([fallbackSession], fallbackSession.id);
      } catch {
        showToast("Session deleted, but the fallback session could not be saved locally.", "error");
      }
      return;
    }

    setSessions(remainingSessions);

    if (sessionId !== activeSessionId) {
      try {
        persistSessions(remainingSessions, activeSessionId);
      } catch {
        showToast("Session deleted, but changes could not be saved locally.", "error");
      }
      return;
    }

    const nextActiveSession = remainingSessions[0];
    setActiveSessionId(nextActiveSession.id);
    left.setInput(nextActiveSession.leftInput);
    right.setInput(nextActiveSession.rightInput);

    try {
      persistSessions(remainingSessions, nextActiveSession.id);
    } catch {
      showToast("Session deleted, but changes could not be saved locally.", "error");
    }
  };

  return (
    <main className="min-h-screen bg-background p-8 max-[720px]:p-4">
      <div className={`flex items-start max-[720px]:flex-col ${isDrawerOpen ? "gap-4" : "gap-0"}`}>
        {isDrawerOpen ? (
          <aside className="h-[calc(100vh-64px)] w-80 shrink-0 overflow-hidden border border-border-default bg-panel max-[720px]:h-auto max-[720px]:w-full max-[720px]:min-w-0">
            <div className="flex min-w-80 items-start justify-between gap-4 border-b border-b-border-default p-4 max-[720px]:min-w-0">
              <div>
                <p className={PANEL_KICKER_CLASS}>Sessions</p>
                <h2 className={PANEL_TITLE_CLASS}>{totalSessionCount}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`${BUTTON_CLASS} whitespace-nowrap`}
                  onClick={handleCreateSession}
                  aria-label="Add session"
                >
                  + Add Session
                </button>
              </div>
            </div>

            <div className="flex h-[calc(100%-77px)] min-w-80 flex-col gap-4 p-4 max-[720px]:h-auto max-[720px]:min-w-0">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-xs uppercase tracking-[0.08em] text-muted">
                  Session list
                </span>
                {activeSession ? <span className={STATUS_BADGE_CLASS}>{activeSession.name}</span> : null}
              </div>

              <div
                className="min-h-0 flex flex-col gap-2 overflow-y-auto pr-1"
                role="list"
                aria-label="Saved sessions"
              >
                {sessions.length === 0 ? (
                  <div className="p-4 text-base text-muted">No sessions yet. Use Add to create one.</div>
                ) : (
                  sessions.map((session) => {
                    const isActive = session.id === activeSessionId;

                    return (
                      <article
                        key={session.id}
                        className={`flex items-stretch gap-2 border p-2 ${
                          isActive
                            ? "border-accent-border bg-accent-panel"
                            : "border-border-default bg-panel-strong"
                        }`}
                      >
                        <button
                          type="button"
                          className="flex flex-1 flex-col gap-1.5 bg-transparent p-1 text-left text-inherit"
                          onClick={() => handleLoadSession(session.id)}
                          aria-label={`Load ${session.name}`}
                        >
                          <span className="font-display text-base text-foreground">{session.name}</span>
                          <span className="text-xs text-muted">
                            Updated {formatUpdatedAt(session.updatedAt)}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${BUTTON_CLASS} self-center whitespace-nowrap`}
                          onClick={() => handleDeleteSession(session.id)}
                          aria-label={`Delete ${session.name}`}
                        >
                          Delete
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </aside>
        ) : null}

        <div className="min-w-0 flex-1 text-base">
          <section className="mb-4 flex items-center justify-between gap-4">
            <button
              type="button"
              className={`${BUTTON_CLASS} min-w-11 px-0`}
              onClick={() => setIsDrawerOpen((current) => !current)}
              aria-label={isDrawerOpen ? "Collapse session drawer" : "Open session drawer"}
              aria-expanded={isDrawerOpen}
            >
              ☰
            </button>
            {activeSession ? (
              <span className={STATUS_BADGE_CLASS}>{activeSession.name}</span>
            ) : null}
          </section>

          <section className="grid grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)] items-stretch gap-4 max-[720px]:grid-cols-1">
            <JsonComparePanel
              copyLabel="Copy left"
              document={left}
              diffIndex={leftDiffIndex}
              onCopyDocument={handleCopyLeftDocument}
              onCopyNode={handleCopyLeftNode}
              searchIndex={leftSearchIndex}
              searchState={leftSearchState}
              viewerMode={viewerMode}
              onInputChange={handleLeftInputChange}
              onSearchModeChange={setLeftSearchMode}
              onSearchQueryChange={setLeftSearchQuery}
              onTogglePath={toggleLeftPath}
            />

            <section className="flex max-[720px]:order-[-1]">
              <div className="flex w-full flex-col gap-3 border border-border-default bg-panel p-4 max-[720px]:gap-3">
                <h2 className={PANEL_TITLE_CLASS}>Options</h2>
                <div className="flex flex-col gap-2 max-[720px]:grid max-[720px]:grid-cols-2">
                  <button
                    type="button"
                    className={`${BUTTON_CLASS} ${viewerMode === "tree" ? ACTIVE_BUTTON_CLASS : ""}`}
                    onClick={() => setViewerMode("tree")}
                  >
                    Tree mode
                  </button>
                  <button
                    type="button"
                    className={`${BUTTON_CLASS} ${viewerMode === "text" ? ACTIVE_BUTTON_CLASS : ""}`}
                    onClick={() => setViewerMode("text")}
                  >
                    Text mode
                  </button>
                  <button
                    type="button"
                    className={BUTTON_CLASS}
                    onClick={handleSaveSession}
                    disabled={!activeSession}
                  >
                    Save session
                  </button>
                  <button
                    type="button"
                    className={BUTTON_CLASS}
                    onClick={handlePrettyPrintLeft}
                    disabled={!left.parsed.valid}
                  >
                    Pretty left
                  </button>
                  <button
                    type="button"
                    className={BUTTON_CLASS}
                    onClick={handlePrettyPrintRight}
                    disabled={!right.parsed.valid}
                  >
                    Pretty right
                  </button>
                  <button
                    type="button"
                    className={BUTTON_CLASS}
                    onClick={handleCollapseAll}
                    disabled={viewerMode !== "tree" || (!left.parsed.valid && !right.parsed.valid)}
                  >
                    Collapse both
                  </button>
                  <button
                    type="button"
                    className={BUTTON_CLASS}
                    onClick={handleExpandAll}
                    disabled={viewerMode !== "tree"}
                  >
                    Expand both
                  </button>
                </div>
              </div>
            </section>

            <JsonComparePanel
              copyLabel="Copy right"
              document={right}
              diffIndex={rightDiffIndex}
              onCopyDocument={handleCopyRightDocument}
              onCopyNode={handleCopyRightNode}
              searchIndex={rightSearchIndex}
              searchState={rightSearchState}
              viewerMode={viewerMode}
              onInputChange={handleRightInputChange}
              onSearchModeChange={setRightSearchMode}
              onSearchQueryChange={setRightSearchQuery}
              onTogglePath={toggleRightPath}
            />
          </section>
        </div>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          className: "border border-border-default bg-panel text-foreground shadow-lg",
          duration: 2400,
          error: {
            className: "border border-border-invalid bg-invalid-panel text-muted-bright shadow-lg",
          },
          success: {
            className: "border border-accent-border bg-accent-valid text-accent shadow-lg",
          },
        }}
      />
    </main>
  );
};

type JsonComparePanelProps = {
  copyLabel: string;
  document: JsonDocumentState;
  diffIndex: DiffIndex;
  onCopyDocument: () => void;
  onInputChange: (value: string) => void;
  onCopyNode: (path: string) => void;
  onSearchModeChange: (mode: "text" | "path") => void;
  onSearchQueryChange: (value: string) => void;
  onTogglePath: (path: string) => void;
  searchIndex: typeof EMPTY_SEARCH_INDEX;
  searchState: {
    mode: "text" | "path";
    query: string;
  };
  viewerMode: ViewerMode;
};

const JsonComparePanel = ({
  copyLabel,
  document,
  diffIndex,
  onCopyDocument,
  onInputChange,
  onCopyNode,
  onSearchModeChange,
  onSearchQueryChange,
  onTogglePath,
  searchIndex,
  searchState,
  viewerMode,
}: JsonComparePanelProps) => {
  const validationMessage = document.isParsing
    ? "Parsing updated JSON..."
    : document.parsed.valid
      ? "Valid JSON"
      : document.parsed.error;
  const statusClassName = document.parsed.valid
    ? "border-accent-border text-accent"
    : "border-border-invalid text-muted-strong";

  return (
    <section className="flex min-h-[640px] min-w-0 flex-col border border-border-default bg-panel text-base max-[720px]:min-h-0">
      <div className="flex items-center justify-between gap-3 border-b border-b-border-default p-4">
        <button
          type="button"
          className={BUTTON_CLASS}
          onClick={onCopyDocument}
          disabled={!document.parsed.valid}
        >
          {copyLabel}
        </button>
        <div className="flex flex-wrap justify-end gap-2">
          <span className={`${STATUS_BADGE_CLASS} ${statusClassName}`}>
            {document.isParsing ? "Working" : document.parsed.valid ? "Valid" : "Invalid"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background">
        {viewerMode === "text" ? (
          <textarea
            className="min-h-full w-full flex-1 resize-none bg-panel-alt p-4 font-mono text-base leading-6 text-foreground outline-0"
            value={document.input}
            onChange={(event) => onInputChange(event.target.value)}
            spellCheck={false}
            placeholder="Paste JSON here"
          />
        ) : document.isParsing ? (
          <div className="p-4 text-base text-muted">Parsing large JSON payload...</div>
        ) : document.graph ? (
          <div className="flex h-full min-h-0 flex-col">
            <JsonSearchBar
              isBusy={document.isParsing}
              matchCount={searchIndex.matchCount}
              mode={searchState.mode}
              onModeChange={onSearchModeChange}
              onQueryChange={onSearchQueryChange}
              query={searchState.query}
            />
            <div className="min-h-0 flex-1">
              <JsonTree
                collapsedIds={document.collapsedIds}
                diffIndex={diffIndex}
                graph={document.graph}
                onCopyNode={onCopyNode}
                onTogglePath={onTogglePath}
                searchIndex={searchIndex}
                searchState={searchState}
              />
            </div>
          </div>
        ) : (
          <div className="p-4 text-base text-muted">
            Switch to text mode and fix the JSON to render the interactive tree.
          </div>
        )}
      </div>

      <div
        className={`border-t border-t-border-default px-4 py-3 text-sm ${
          document.parsed.valid ? "bg-accent-valid text-accent" : "bg-invalid-panel text-muted-bright"
        }`}
      >
        {validationMessage}
      </div>
    </section>
  );
};

const syncCollapsedState = (
  document: JsonDocumentState,
  startTransition: TransitionStartFunction,
) => {
  const graph = document.graph;

  if (
    !document.parsed.valid ||
    !graph ||
    document.debouncedInput === document.lastParsedInputRef.current
  ) {
    return;
  }

  document.lastParsedInputRef.current = document.debouncedInput;

  startTransition(() => {
    document.setCollapsedIds(
      isLargeGraph(graph, HEAVY_PAYLOAD_NODE_THRESHOLD)
        ? buildRootCollapsedSet(graph)
        : new Set(),
    );
  });
};

const toggleCollapsedPath = (current: Set<string>, path: string) => {
  const next = new Set(current);

  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }

  return next;
};

const createSession = (name: string, leftInput: string, rightInput: string): SavedSession => ({
  id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  leftInput,
  name,
  rightInput,
  updatedAt: new Date().toISOString(),
});

const parseStoredSessions = (storedValue: string | null): StoredSessions => {
  if (!storedValue) {
    return {
      activeSessionId: null,
      sessions: [],
    };
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<StoredSessions>;

    if (!Array.isArray(parsed.sessions)) {
      return {
        activeSessionId: null,
        sessions: [],
      };
    }

    const sessions = normalizeStoredSessions(parsed.sessions.filter(isSavedSession));

    return {
      activeSessionId:
        typeof parsed.activeSessionId === "string" ? parsed.activeSessionId : null,
      sessions,
    };
  } catch {
    return {
      activeSessionId: null,
      sessions: [],
    };
  }
};

const normalizeStoredSessions = (sessions: SavedSession[]) => {
  if (sessions.length === 1 && sessions[0]?.name === "Sample session") {
    return [createSession("Session 1", EMPTY_JSON_INPUT, EMPTY_JSON_INPUT)];
  }

  return sessions;
};

const getSaveErrorMessage = (error: unknown) => {
  if (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  ) {
    return "Session is too large to save locally. The editor still has your JSON loaded.";
  }

  return "Session could not be saved locally. The editor still has your JSON loaded.";
};

const isSavedSession = (value: unknown): value is SavedSession => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<SavedSession>;

  return (
    typeof session.id === "string" &&
    typeof session.leftInput === "string" &&
    typeof session.name === "string" &&
    typeof session.rightInput === "string" &&
    typeof session.updatedAt === "string"
  );
};

const formatUpdatedAt = (updatedAt: string) => {
  const timestamp = new Date(updatedAt);

  if (Number.isNaN(timestamp.getTime())) {
    return "Unknown update";
  }

  return timestamp.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
};
