"use client";

import { JsonSearchBar } from "@/components/json-viewer/json-search-bar";
import { JsonTree } from "@/components/json-viewer/json-tree";
import { CompactIcon, CollapseIcon, CopyIcon, ExpandIcon, SparklesIcon } from "@/components/json-viewer/json-icons";
import {
  BUTTON_CLASS,
  ICON_BUTTON_CLASS,
  STATUS_BADGE_CLASS,
} from "@/components/json-viewer/json-ui";
import { JsonViewModeToggle } from "@/components/json-viewer/json-view-mode-toggle";
import { useJsonDocument } from "@/hooks/use-json-document";
import type { DiffIndex, ViewerMode } from "@/lib/json-viewer";

type JsonComparePanelProps = {
  copyLabel: string;
  diffIndex: DiffIndex;
  document: ReturnType<typeof useJsonDocument>;
  onCopyDocument: () => void;
  onCopyNode: (path: string) => void;
  onPrettyPrint: () => void;
  onViewerModeChange: (mode: ViewerMode) => void;
  viewerMode: ViewerMode;
};

export const JsonComparePanel = ({
  copyLabel,
  diffIndex,
  document,
  onCopyDocument,
  onCopyNode,
  onPrettyPrint,
  onViewerModeChange,
  viewerMode,
}: JsonComparePanelProps) => {
  const validationMessage = document.isParsing
    ? "Parsing JSON..."
    : document.valid
      ? "Valid JSON"
      : document.error;
  const statusClassName = document.valid
    ? "border-accent-border text-accent"
    : "border-border-invalid text-muted-strong";
  const activeMatchNumber =
    document.matchCursor >= 0 ? document.matchCursor + 1 : 0;

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[12px] border border-border-default bg-panel text-base max-[900px]:h-[72vh] max-[720px]:h-[680px]">
      <div className="shrink-0 border-b border-b-border-default p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${BUTTON_CLASS} px-3 py-2 text-sm`}
              onClick={onCopyDocument}
              disabled={!document.valid}
            >
              <CopyIcon />
              <span>{copyLabel}</span>
            </button>
            <button
              type="button"
              className={`${BUTTON_CLASS} px-3 py-2 text-sm`}
              onClick={onPrettyPrint}
              disabled={!document.valid}
            >
              <SparklesIcon />
              <span>Pretty</span>
            </button>
            {viewerMode === "tree" ? (
              <>
                <button
                  type="button"
                  className={ICON_BUTTON_CLASS}
                  onClick={document.collapseAll}
                  disabled={!document.valid}
                  title="Collapse all"
                >
                  <CollapseIcon />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON_CLASS}
                  onClick={document.expandAll}
                  disabled={!document.valid || Boolean(document.expandAllDisabledReason)}
                  title="Expand all"
                >
                  <ExpandIcon />
                </button>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className={`${STATUS_BADGE_CLASS} ${statusClassName}`}>
              {document.isParsing ? "Working" : document.valid ? "Valid" : "Invalid"}
            </span>
          </div>
        </div>

        <JsonViewModeToggle value={viewerMode} onChange={onViewerModeChange} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-background">
        {viewerMode === "text" ? (
          <textarea
            className="h-full min-h-0 w-full resize-none bg-panel-alt p-4 font-mono text-base leading-6 text-foreground outline-0"
            value={document.input}
            onChange={(event) => document.setInput(event.target.value)}
            spellCheck={false}
            placeholder="Paste JSON here"
          />
        ) : viewerMode === "compact" ? (
          <div className="min-h-full bg-panel-alt p-4 font-mono text-base leading-6 text-foreground">
            <div className="mb-3 flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-muted">
              <CompactIcon />
              <span>Compact JSON</span>
            </div>
            <pre className="m-0 whitespace-pre-wrap break-all">{document.valid ? document.compactText : ""}</pre>
          </div>
        ) : document.isParsing ? (
          <div className="p-4 text-base text-muted">Parsing JSON...</div>
        ) : document.graph ? (
          <div className="flex h-full min-h-0 flex-col">
            <JsonSearchBar
              activeMatchNumber={activeMatchNumber}
              isBusy={document.isSearching}
              matchCount={document.searchIndex.matchCount}
              mode={document.searchMode}
              onModeChange={document.setSearchMode}
              onNextMatch={document.goToNextMatch}
              onPreviousMatch={document.goToPreviousMatch}
              onQueryChange={document.setSearchQuery}
              query={document.searchQuery}
            />
            <div className="min-h-0 flex-1">
              <JsonTree
                activeMatchId={document.activeMatchId}
                collapsedIds={document.collapsedIds}
                diffIndex={diffIndex}
                graph={document.graph}
                isHeavy={document.isHeavy}
                onCopyNode={onCopyNode}
                onShowMore={document.showMoreChildren}
                onTogglePath={document.togglePath}
                searchIndex={document.searchIndex}
                searchState={{
                  mode: document.searchMode,
                  query: document.searchQuery.trim().toLowerCase(),
                }}
                visibleChildCountById={document.visibleChildCountById}
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
        className={`shrink-0 rounded-b-[12px] border-t border-t-border-default px-4 py-3 text-sm ${
          document.valid ? "bg-accent-valid text-accent" : "bg-invalid-panel text-muted-bright"
        }`}
      >
        {validationMessage}
      </div>
    </section>
  );
};
