import { MoonIcon, SunIcon } from "@/components/json-viewer/json-icons";
import { BUTTON_CLASS, ACTIVE_BUTTON_CLASS } from "@/components/json-viewer/json-ui";

export type ThemeMode = "dark" | "light";

type JsonThemeToggleProps = {
  onToggle: () => void;
  theme: ThemeMode;
};

export const JsonThemeToggle = ({ onToggle, theme }: JsonThemeToggleProps) => (
  <button
    type="button"
    className={`${BUTTON_CLASS} px-3 py-2 text-sm ${theme === "light" ? ACTIVE_BUTTON_CLASS : ""}`}
    onClick={onToggle}
    aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
  >
    {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    <span>{theme === "dark" ? "Light" : "Dark"}</span>
  </button>
);
