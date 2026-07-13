import { CompareIcon } from "@/components/json-viewer/json-icons";
import {
  ACTIVE_BUTTON_CLASS,
  BUTTON_CLASS,
  PANEL_TITLE_CLASS,
} from "@/components/json-viewer/json-ui";

type JsonCenterControlsProps = {
  canCompare: boolean;
  isCompared: boolean;
  isStale: boolean;
  onCompare: () => void;
};

export const JsonCenterControls = ({
  canCompare,
  isCompared,
  isStale,
  onCompare,
}: JsonCenterControlsProps) => (
  <section className="flex h-full min-h-0 max-[900px]:order-[-1] max-[900px]:h-auto">
    <div className="flex w-full flex-col items-center justify-center gap-4 rounded-[12px] border border-border-default bg-panel p-4">
      <h2 className={PANEL_TITLE_CLASS}>Compare</h2>
      <button
        type="button"
        className={`${BUTTON_CLASS} ${isCompared && !isStale ? ACTIVE_BUTTON_CLASS : ""} w-full px-4 py-3`}
        onClick={onCompare}
        disabled={!canCompare}
      >
        <CompareIcon className="h-5 w-5" />
        <span>{isStale ? "Recompare" : isCompared ? "Compared" : "Compare JSON"}</span>
      </button>
      <p className="text-center text-sm text-muted">
        {isStale && 
          "One of the panels changed. Run compare again to refresh highlights."}
      </p>
    </div>
  </section>
);
