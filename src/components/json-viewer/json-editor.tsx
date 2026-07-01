type JsonEditorProps = {
  input: string;
  onInputChange: (value: string) => void;
  onPrettyPrint: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  isValid: boolean;
  validationMessage: string;
  isBusy: boolean;
};

export const JsonEditor = ({
  input,
  onInputChange,
  onPrettyPrint,
  onCollapseAll,
  onExpandAll,
  isValid,
  validationMessage,
  isBusy,
}: JsonEditorProps) => {
  const statusClassName = isValid
    ? "border-accent-border text-accent"
    : "border-border-invalid text-muted-strong";

  return (
    <section className="flex min-h-0 flex-col border border-border-default bg-panel text-base">
      <div className="flex items-start justify-between gap-4 border-b border-b-border-default p-4">
        <div>
          <p className="mb-1.5 font-display text-xs uppercase tracking-[0.08em] text-muted">
            Input
          </p>
          <h2 className="font-display text-xl font-semibold tracking-[-0.03em] text-foreground">
            Paste JSON
          </h2>
        </div>
        <span
          className={`whitespace-nowrap border bg-background px-[10px] py-[6px] font-display tracking-[0.02em] ${statusClassName}`}
        >
          {isBusy ? "Working" : isValid ? "Valid" : "Invalid"}
        </span>
      </div>

      <div className="flex gap-2 p-4">
        <button
          type="button"
          className="border border-border-default bg-background px-[14px] py-[10px] text-foreground enabled:hover:border-accent-border enabled:hover:text-accent disabled:cursor-not-allowed disabled:text-neutral-500"
          onClick={onPrettyPrint}
          disabled={!isValid}
        >
          Pretty print
        </button>
        <button
          type="button"
          className="border border-border-default bg-background px-[14px] py-[10px] text-foreground enabled:hover:border-accent-border enabled:hover:text-accent disabled:cursor-not-allowed disabled:text-neutral-500"
          onClick={onCollapseAll}
          disabled={!isValid}
        >
          Collapse all
        </button>
        <button
          type="button"
          className="border border-border-default bg-background px-[14px] py-[10px] text-foreground enabled:hover:border-accent-border enabled:hover:text-accent disabled:cursor-not-allowed disabled:text-neutral-500"
          onClick={onExpandAll}
          disabled={!isValid}
        >
          Expand all
        </button>
      </div>

      <textarea
        className="min-h-[420px] flex-1 resize-none bg-panel-alt p-4 font-mono text-base leading-6 text-foreground outline-0"
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        spellCheck={false}
        placeholder="Paste JSON here"
      />

      <div
        className={`border-t border-t-border-default px-4 py-3 text-sm ${
          isValid ? "bg-accent-valid text-accent" : "bg-invalid-panel text-muted-bright"
        }`}
      >
        {validationMessage}
      </div>
    </section>
  );
};
