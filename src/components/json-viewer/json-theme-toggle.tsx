import { MoonIcon, SunIcon } from "@/components/json-viewer/json-icons";
import { ACTIVE_BUTTON_CLASS, ICON_BUTTON_CLASS } from "@/components/json-viewer/json-ui";

export type ThemeMode = "dark" | "light";

type JsonThemeToggleProps = {
  onToggle: () => void;
  theme: ThemeMode;
};

export const JsonThemeToggle = ({ onToggle, theme }: JsonThemeToggleProps) => (
  <button
    type="button"
    className={`${ICON_BUTTON_CLASS} ${theme === "light" ? ACTIVE_BUTTON_CLASS : ""}`}
    onClick={onToggle}
    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
  >
    {theme === "dark" ? <SunIcon /> : <MoonIcon />}
  </button>
);
