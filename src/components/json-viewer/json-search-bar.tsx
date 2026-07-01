type JsonSearchBarProps = {
  mode: "text" | "path";
  query: string;
  onModeChange: (mode: "text" | "path") => void;
  onQueryChange: (value: string) => void;
  matchCount: number;
  isBusy: boolean;
};

export const JsonSearchBar = ({
  mode,
  query,
  onModeChange,
  onQueryChange,
  matchCount,
  isBusy,
}: JsonSearchBarProps) => {
  const buttonClassName = (active: boolean) =>
    [
      "border border-border-default bg-background px-3 py-2 text-foreground",
      active ? "border-accent-border text-accent" : "hover:border-accent-border hover:text-accent",
    ].join(" ");

  return (
    <div className="border border-x-0 border-b-0 border-border-default bg-panel text-base">
      <div className="flex items-start justify-between gap-4 border-b border-b-border-default p-4">
        <div>
          <p className="mb-1.5 font-display text-xs uppercase tracking-[0.08em] text-muted">
            Tree search
          </p>
          <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-foreground">
            Search and inspect
          </h2>
        </div>
        <span className="whitespace-nowrap border border-border-default bg-background px-[10px] py-[6px] font-display tracking-[0.02em] text-foreground">
          {isBusy
            ? "Searching"
            : `${matchCount} match${matchCount === 1 ? "" : "es"}`}
        </span>
      </div>

      <div className="flex gap-2 p-4">
        <button
          type="button"
          className={buttonClassName(mode === "text")}
          onClick={() => onModeChange("text")}
        >
          Text mode
        </button>
        <button
          type="button"
          className={buttonClassName(mode === "path")}
          onClick={() => onModeChange("path")}
        >
          Path mode
        </button>
      </div>

      <input
        className="w-full border-0 bg-panel-alt px-4 py-3 text-base text-foreground outline-0"
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={
          mode === "text"
            ? "Search keys or values"
            : "Search paths like users[0].profile.name"
        }
      />
    </div>
  );
};
