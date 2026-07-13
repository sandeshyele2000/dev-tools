type JsonSearchBarProps = {
  activeMatchNumber: number;
  isBusy: boolean;
  matchCount: number;
  mode: "text" | "path";
  onModeChange: (mode: "text" | "path") => void;
  onNextMatch: () => void;
  onPreviousMatch: () => void;
  onQueryChange: (value: string) => void;
  query: string;
};

export const JsonSearchBar = ({
  activeMatchNumber,
  isBusy,
  matchCount,
  mode,
  onModeChange,
  onNextMatch,
  onPreviousMatch,
  onQueryChange,
  query,
}: JsonSearchBarProps) => {
  const buttonClassName = (active: boolean) =>
    [
      "rounded-[4px] border border-border-default bg-background px-3 py-2 text-foreground disabled:cursor-not-allowed disabled:text-muted",
      active ? "border-accent-border text-accent" : "hover:border-accent-border hover:text-accent",
    ].join(" ");
  const matchStatus = isBusy
    ? "Searching..."
    : matchCount > 0
      ? `${activeMatchNumber} / ${matchCount}`
      : query.trim()
        ? "No matches"
        : "Search";

  return (
    <div className="border border-x-0 border-border-default bg-panel text-base">
      <div className="flex flex-wrap items-center gap-2 border-b-border-default p-4">
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
        <button
          type="button"
          className={buttonClassName(false)}
          onClick={onPreviousMatch}
          disabled={matchCount === 0}
        >
          Previous
        </button>
        <button
          type="button"
          className={buttonClassName(false)}
          onClick={onNextMatch}
          disabled={matchCount === 0}
        >
          Next
        </button>
        <span className="ml-auto text-sm text-muted">{matchStatus}</span>
      </div>

      <input
        className="w-full border-0 bg-panel-alt px-4 py-3 text-base text-foreground outline-0"
        type="text"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={
          mode === "text"
            ? "Search keys or primitive values"
            : "Search paths like users[0].profile.name"
        }
      />
    </div>
  );
};
