"use client";

import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { JsonCenterControls } from "@/components/json-viewer/json-center-controls";
import { JsonComparePanel } from "@/components/json-viewer/json-compare-panel";
import { JsonThemeToggle } from "@/components/json-viewer/json-theme-toggle";
import { STATUS_BADGE_CLASS } from "@/components/json-viewer/json-ui";
import { useJsonDocument } from "@/hooks/use-json-document";
import { useThemeMode } from "@/hooks/use-theme-mode";
import {
  EMPTY_DIFF_INDEX,
  materializeDiffIndex,
  type DiffIndex,
  type ViewerMode,
} from "@/lib/json-viewer";

const EMPTY_JSON_INPUT = "";

type ComparisonPair = {
  left: string;
  right: string;
};

export const JsonWorkbench = () => {
  const [leftViewerMode, setLeftViewerMode] = useState<ViewerMode>("tree");
  const [rightViewerMode, setRightViewerMode] = useState<ViewerMode>("tree");
  const [leftDiffIndex, setLeftDiffIndex] = useState<DiffIndex>(EMPTY_DIFF_INDEX);
  const [rightDiffIndex, setRightDiffIndex] = useState<DiffIndex>(EMPTY_DIFF_INDEX);
  const [diffCursor, setDiffCursor] = useState(-1);
  const [comparisonPair, setComparisonPair] = useState<ComparisonPair | null>(null);
  const { theme, toggleTheme } = useThemeMode();
  const left = useJsonDocument("left", EMPTY_JSON_INPUT);
  const right = useJsonDocument("right", EMPTY_JSON_INPUT);
  const setLeftInput = left.setInput;
  const setRightInput = right.setInput;
  const requestLeftDiff = left.diff;
  const requestRightDiff = right.diff;
  const revealLeftNode = left.revealNode;
  const revealRightNode = right.revealNode;
  const leftSearchQuery = left.searchQuery;
  const rightSearchQuery = right.searchQuery;
  const isComparisonStale = useMemo(
    () =>
      comparisonPair !== null &&
      (comparisonPair.left !== left.inputVersion || comparisonPair.right !== right.inputVersion),
    [comparisonPair, left.inputVersion, right.inputVersion],
  );
  const showComparison = comparisonPair !== null && !isComparisonStale && left.valid && right.valid;
  const visibleLeftDiffIndex = showComparison ? leftDiffIndex : EMPTY_DIFF_INDEX;
  const visibleRightDiffIndex = showComparison ? rightDiffIndex : EMPTY_DIFF_INDEX;
  const diffTargets = useMemo(
    () => buildSharedDiffTargets(visibleLeftDiffIndex, left.graph, visibleRightDiffIndex, right.graph),
    [left.graph, visibleLeftDiffIndex, right.graph, visibleRightDiffIndex],
  );
  const activeDiffNumber = diffCursor >= 0 ? diffCursor + 1 : 0;
  const activeDiffTarget = diffCursor >= 0 ? diffTargets[diffCursor] ?? null : null;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLeftInput(EMPTY_JSON_INPUT);
      setRightInput(EMPTY_JSON_INPUT);
      setComparisonPair(null);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [setLeftInput, setRightInput]);

  useEffect(() => {
    if (diffTargets.length === 0) {
      setDiffCursor(-1);
      return;
    }

    setDiffCursor((current) => (current >= 0 && current < diffTargets.length ? current : 0));
  }, [diffTargets]);

  useEffect(() => {
    if (!activeDiffTarget) {
      return;
    }

    if (!leftSearchQuery.trim() && activeDiffTarget.leftNodeId) {
      revealLeftNode(activeDiffTarget.leftNodeId);
    }

    if (!rightSearchQuery.trim() && activeDiffTarget.rightNodeId) {
      revealRightNode(activeDiffTarget.rightNodeId);
    }
  }, [activeDiffTarget, leftSearchQuery, revealLeftNode, revealRightNode, rightSearchQuery]);

  useEffect(() => {
    let isCancelled = false;

    if (!showComparison || !comparisonPair) {
      return;
    }

    void requestLeftDiff(comparisonPair.right)
      .then((snapshot) => {
        if (!isCancelled) {
          setLeftDiffIndex(materializeDiffIndex(snapshot));
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLeftDiffIndex(EMPTY_DIFF_INDEX);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [comparisonPair, requestLeftDiff, showComparison]);

  useEffect(() => {
    let isCancelled = false;

    if (!showComparison || !comparisonPair) {
      return;
    }

    void requestRightDiff(comparisonPair.left)
      .then((snapshot) => {
        if (!isCancelled) {
          setRightDiffIndex(materializeDiffIndex(snapshot));
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setRightDiffIndex(EMPTY_DIFF_INDEX);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [comparisonPair, requestRightDiff, showComparison]);

  const showToast = (message: string, tone: "error" | "success") => {
    if (tone === "success") {
      toast.success(message);
      return;
    }

    toast.error(message);
  };

  const writeClipboard = async (
    value: string,
    options: {
      failureMessage: string;
      successMessage: string;
    },
  ) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(options.successMessage, "success");
    } catch {
      showToast(options.failureMessage, "error");
    }
  };

  const handleCompare = () => {
    if (!left.valid || !right.valid) {
      return;
    }

    setComparisonPair({
      left: left.inputVersion,
      right: right.inputVersion,
    });
    showToast("Panels compared.", "success");
  };

  const goToDiff = (direction: 1 | -1) => {
    if (diffTargets.length === 0) {
      return;
    }

    setDiffCursor((current) => {
      const nextCursor =
        current < 0 ? 0 : (current + direction + diffTargets.length) % diffTargets.length;
      const nextTarget = diffTargets[nextCursor];

      if (nextTarget?.leftNodeId && !leftSearchQuery.trim()) {
        revealLeftNode(nextTarget.leftNodeId);
      }

      if (nextTarget?.rightNodeId && !rightSearchQuery.trim()) {
        revealRightNode(nextTarget.rightNodeId);
      }

      return nextCursor;
    });
  };

  return (
    <main className="h-screen overflow-hidden bg-background p-8 max-[900px]:h-auto max-[900px]:overflow-visible max-[720px]:p-4">
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col text-base">
        <section className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {showComparison ? (
              <span className={`${STATUS_BADGE_CLASS} border-accent-border text-accent`}>
                Compared
              </span>
            ) : null}
          </div>

          <JsonThemeToggle theme={theme} onToggle={toggleTheme} />
        </section>

        <section className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] items-stretch gap-4 max-[900px]:grid-cols-1">
          <JsonComparePanel
            activeDiffId={activeDiffTarget?.leftNodeId ?? null}
            copyLabel="Copy left"
            diffIndex={visibleLeftDiffIndex}
            document={left}
            onCopyDocument={() =>
              void writeClipboardPromise(left.copyDocument(), writeClipboard, showToast, {
                failureMessage: "Could not copy the left JSON to the clipboard.",
                successMessage: "Left JSON copied.",
              })
            }
            onCopyNode={(path) =>
              void writeClipboardPromise(left.copyNode(path), writeClipboard, showToast, {
                failureMessage: `Could not copy ${path} to the clipboard.`,
                successMessage: `Copied ${path}.`,
              })
            }
            onPrettyPrint={() => void prettyPrintDocument(left.prettyPrint, showToast, "left")}
            onViewerModeChange={setLeftViewerMode}
            viewerMode={leftViewerMode}
          />

          <JsonCenterControls
            canCompare={left.valid && right.valid && !left.isParsing && !right.isParsing}
            diffMatchCount={diffTargets.length}
            activeDiffNumber={activeDiffNumber}
            isCompared={comparisonPair !== null}
            isStale={isComparisonStale}
            onCompare={handleCompare}
            onNextDiff={() => goToDiff(1)}
            onPreviousDiff={() => goToDiff(-1)}
          />

          <JsonComparePanel
            activeDiffId={activeDiffTarget?.rightNodeId ?? null}
            copyLabel="Copy right"
            diffIndex={visibleRightDiffIndex}
            document={right}
            onCopyDocument={() =>
              void writeClipboardPromise(right.copyDocument(), writeClipboard, showToast, {
                failureMessage: "Could not copy the right JSON to the clipboard.",
                successMessage: "Right JSON copied.",
              })
            }
            onCopyNode={(path) =>
              void writeClipboardPromise(right.copyNode(path), writeClipboard, showToast, {
                failureMessage: `Could not copy ${path} to the clipboard.`,
                successMessage: `Copied ${path}.`,
              })
            }
            onPrettyPrint={() => void prettyPrintDocument(right.prettyPrint, showToast, "right")}
            onViewerModeChange={setRightViewerMode}
            viewerMode={rightViewerMode}
          />
        </section>
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

const writeClipboardPromise = async (
  promise: Promise<string>,
  writer: (
    value: string,
    options: { failureMessage: string; successMessage: string },
  ) => Promise<void>,
  showToast: (message: string, tone: "error" | "success") => void,
  options: {
    failureMessage: string;
    successMessage: string;
  },
) => {
  try {
    await writer(await promise, options);
  } catch {
    showToast(options.failureMessage, "error");
  }
};

const prettyPrintDocument = async (
  prettyPrint: () => Promise<void>,
  showToast: (message: string, tone: "error" | "success") => void,
  side: "left" | "right",
) => {
  try {
    await prettyPrint();
  } catch {
    showToast(`Could not pretty print the ${side} JSON.`, "error");
  }
};

type DiffTarget = {
  leftNodeId: string | null;
  rightNodeId: string | null;
};

const buildSharedDiffTargets = (
  leftDiffIndex: DiffIndex,
  leftGraph: ReturnType<typeof useJsonDocument>["graph"],
  rightDiffIndex: DiffIndex,
  rightGraph: ReturnType<typeof useJsonDocument>["graph"],
): DiffTarget[] => {
  const pathOrder: string[] = [];
  const seenPaths = new Set<string>();

  [...leftDiffIndex.entries, ...rightDiffIndex.entries].forEach((entry) => {
    if (seenPaths.has(entry.path)) {
      return;
    }

    seenPaths.add(entry.path);
    pathOrder.push(entry.path);
  });

  return pathOrder.map((path) => ({
    leftNodeId: findClosestExistingPath(leftGraph, path),
    rightNodeId: findClosestExistingPath(rightGraph, path),
  }));
};

const findClosestExistingPath = (
  graph: ReturnType<typeof useJsonDocument>["graph"],
  path: string,
): string | null => {
  if (!graph) {
    return null;
  }

  let currentPath = path || graph.rootId;

  while (currentPath) {
    if (graph.nodeById[currentPath]) {
      return currentPath;
    }

    currentPath = getParentPath(currentPath);
  }

  return graph.rootId;
};

const getParentPath = (path: string): string => {
  if (path === "root") {
    return "";
  }

  const lastArrayIndex = path.lastIndexOf("[");
  const lastObjectIndex = path.lastIndexOf(".");
  const separatorIndex = Math.max(lastArrayIndex, lastObjectIndex);

  if (separatorIndex < 0) {
    return "root";
  }

  return path.slice(0, separatorIndex);
};
