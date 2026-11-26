"use client";

import React from "react";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, type ThemeDefinition } from "@/lib/themes";

function ThemeSwatch({ swatch }: { swatch: ThemeDefinition["swatch"] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 44"
      className="w-14 h-10 rounded-lg shrink-0 border border-border-subtle overflow-hidden"
    >
      <rect width="64" height="44" fill={swatch.sky} />
      <path
        d="M0 30C12 22 22 20 34 26C44 31 54 24 64 19V44H0V30Z"
        fill={swatch.hillBack}
      />
      <path
        d="M0 36C14 31 28 24 44 29C53 32 59 29 64 26V44H0V36Z"
        fill={swatch.hillFront}
      />
    </svg>
  );
}

export function AppearanceSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <section
      aria-label="Appearance"
      className="focus-card p-5 md:p-6 flex flex-col gap-4"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[21px]">
            palette
          </span>
          <h2 className="text-[17px] font-semibold text-on-surface">
            Appearance
          </h2>
        </div>
        <p className="text-[13px] text-on-surface-variant mt-1">
          Choose a theme that feels comfortable for you.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Color Theme"
        className="flex flex-col gap-2.5"
      >
        {THEMES.map((option) => {
          const selected = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-theme-option={option.id}
              onClick={() => setTheme(option.id)}
              className={`w-full flex items-center justify-between gap-3.5 p-3 rounded-xl border text-left transition-all ${
                selected
                  ? "bg-surface-container-high border-primary"
                  : "bg-surface-container-lowest border-border-subtle hover:bg-surface-container-low hover:border-border-strong"
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <ThemeSwatch swatch={option.swatch} />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-on-surface leading-5">
                    {option.name}
                  </p>
                  <p className="text-[12px] text-on-surface-variant leading-4 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </div>

              {/* Radio selection indicator matching references */}
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selected ? "border-primary" : "border-border-strong"
                }`}
              >
                {selected && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
