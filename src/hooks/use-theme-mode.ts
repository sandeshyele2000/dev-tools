"use client";

import { useEffect, useState } from "react";
import type { ThemeMode } from "@/components/json-viewer/json-theme-toggle";

const THEME_STORAGE_KEY = "json-viewer:theme:v1";

export const useThemeMode = () => {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme: ThemeMode = storedTheme === "light" ? "light" : "dark";

    const timeoutId = window.setTimeout(() => {
      setTheme(nextTheme);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((current) => {
      const nextTheme: ThemeMode = current === "dark" ? "light" : "dark";

      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

      return nextTheme;
    });
  };

  return {
    theme,
    toggleTheme,
  };
};
