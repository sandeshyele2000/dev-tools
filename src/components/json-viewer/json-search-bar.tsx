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
  return (
    <div className="search-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Viewer</p>
          <h2 className="panel-title">Search and inspect</h2>
        </div>
        <span className="status-badge">
          {isBusy
            ? "Searching"
            : `${matchCount} match${matchCount === 1 ? "" : "es"}`}
        </span>
      </div>

      <div className="search-toolbar">
        <button
          type="button"
          className={`button ${mode === "text" ? "button-active" : ""}`}
          onClick={() => onModeChange("text")}
        >
          Text mode
        </button>
        <button
          type="button"
          className={`button ${mode === "path" ? "button-active" : ""}`}
          onClick={() => onModeChange("path")}
        >
          Path mode
        </button>
      </div>

      <input
        className="search-input"
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
