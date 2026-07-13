import { CompactIcon, TextIcon, TreeIcon } from "@/components/json-viewer/json-icons";
import {
  ACTIVE_BUTTON_CLASS,
  BUTTON_CLASS,
} from "@/components/json-viewer/json-ui";
import type { ViewerMode } from "@/lib/json-viewer";

type JsonViewModeToggleProps = {
  onChange: (mode: ViewerMode) => void;
  value: ViewerMode;
};

const MODE_OPTIONS: Array<{
  icon: typeof TreeIcon;
  label: string;
  value: ViewerMode;
}> = [
  { icon: TreeIcon, label: "Tree", value: "tree" },
  { icon: TextIcon, label: "Text", value: "text" },
  { icon: CompactIcon, label: "Compact", value: "compact" },
];

export const JsonViewModeToggle = ({
  onChange,
  value,
}: JsonViewModeToggleProps) => (
  <div className="flex flex-wrap gap-2">
    {MODE_OPTIONS.map((option) => {
      const Icon = option.icon;

      return (
        <button
          key={option.value}
          type="button"
          className={`${BUTTON_CLASS} px-3 py-2 text-sm ${value === option.value ? ACTIVE_BUTTON_CLASS : ""}`}
          onClick={() => onChange(option.value)}
        >
          <Icon />
          <span>{option.label}</span>
        </button>
      );
    })}
  </div>
);
