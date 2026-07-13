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
  const [comparisonPair, setComparisonPair] = useState<ComparisonPair | null>(null);
  const { theme, toggleTheme } = useThemeMode();
  const left = useJsonDocument("left", EMPTY_JSON_INPUT);
  const right = useJsonDocument("right", EMPTY_JSON_INPUT);
  const setLeftInput = left.setInput;
  const setRightInput = right.setInput;
  const requestLeftDiff = left.diff;
  const requestRightDiff = right.diff;
  const isComparisonStale = useMemo(
    () =>
      comparisonPair !== null &&
      (comparisonPair.left !== left.inputVersion || comparisonPair.right !== right.inputVersion),
    [comparisonPair, left.inputVersion, right.inputVersion],
  );
  const showComparison = comparisonPair !== null && !isComparisonStale && left.valid && right.valid;
  const visibleLeftDiffIndex = showComparison ? leftDiffIndex : EMPTY_DIFF_INDEX;
  const visibleRightDiffIndex = showComparison ? rightDiffIndex : EMPTY_DIFF_INDEX;

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
            isCompared={comparisonPair !== null}
            isStale={isComparisonStale}
            onCompare={handleCompare}
          />

          <JsonComparePanel
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
