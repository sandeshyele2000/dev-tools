"use client";

import Link from "next/link";
import { JsonThemeToggle } from "@/components/json-viewer/json-theme-toggle";
import {
  BUTTON_CLASS,
  PANEL_KICKER_CLASS,
  PANEL_TITLE_CLASS,
} from "@/components/json-viewer/json-ui";
import { useThemeMode } from "@/hooks/use-theme-mode";

export const DevToolsHome = () => {
  const { theme, toggleTheme } = useThemeMode();

  return (
    <main className="min-h-screen bg-background p-8 max-[720px]:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col max-[720px]:min-h-[calc(100vh-2rem)]">
        <section className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className={PANEL_KICKER_CLASS}>Utility Hub</p>
            <h1 className="font-display text-4xl tracking-[-0.04em] text-foreground max-[720px]:text-3xl">
              Dev tools
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted">
              A collection of focused utilities for day-to-day development work.
            </p>
          </div>

          <JsonThemeToggle theme={theme} onToggle={toggleTheme} />
        </section>

        <section className="grid flex-1 grid-cols-[minmax(0,420px)] content-start gap-4 max-[900px]:grid-cols-1">
          <Link
            href="/json-viewer"
            className="group rounded-[12px] border border-border-default bg-panel p-6 transition-colors hover:border-accent-border hover:bg-panel-alt"
          >
            <p className={PANEL_KICKER_CLASS}>Available Now</p>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className={PANEL_TITLE_CLASS}>JSON viewer</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
                  Parse, inspect, compare, and search nested JSON documents from a dedicated tool route.
                </p>
              </div>

              <span
                className={`${BUTTON_CLASS} px-3 py-2 text-sm transition-colors group-hover:border-accent-border group-hover:text-accent`}
              >
                Open
              </span>
            </div>
          </Link>
        </section>

        <footer className="pt-8 text-center text-xs text-muted">
          Made for dev, by the dev &lt;3
        </footer>
      </div>
    </main>
  );
};
