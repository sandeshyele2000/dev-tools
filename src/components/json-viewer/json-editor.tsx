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
  return (
    <section className="editor-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Input</p>
          <h2 className="panel-title">Paste JSON</h2>
        </div>
        <span className={`status-badge ${isValid ? "status-valid" : "status-invalid"}`}>
          {isBusy ? "Working" : isValid ? "Valid" : "Invalid"}
        </span>
      </div>

      <div className="toolbar">
        <button type="button" className="button" onClick={onPrettyPrint} disabled={!isValid}>
          Pretty print
        </button>
        <button type="button" className="button" onClick={onCollapseAll} disabled={!isValid}>
          Collapse all
        </button>
        <button type="button" className="button" onClick={onExpandAll} disabled={!isValid}>
          Expand all
        </button>
      </div>

      <textarea
        className="json-textarea"
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        spellCheck={false}
        placeholder="Paste JSON here"
      />

      <div className={`validation-strip ${isValid ? "validation-valid" : "validation-invalid"}`}>
        {validationMessage}
      </div>
    </section>
  );
};
