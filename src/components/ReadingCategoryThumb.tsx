import React from "react";
import type { ReadingCategory } from "@/lib/types";

const CATEGORY_ICONS: Record<ReadingCategory, string> = {
  Technology: "memory",
  Science: "science",
  History: "account_balance",
  Business: "work_outline",
  Nature: "park",
  Society: "public",
};

/**
 * Calm, minimalist theme-adaptive thumbnail for Reading Library cards.
 */
export function ReadingCategoryThumb({
  category,
}: {
  category: ReadingCategory;
}) {
  return (
    <div
      aria-hidden="true"
      className="relative w-16 h-16 sm:w-20 sm:h-16 rounded-xl overflow-hidden shrink-0 border border-border-subtle bg-surface-container flex items-center justify-center"
    >
      <svg
        viewBox="0 0 80 64"
        fill="none"
        className="absolute inset-0 w-full h-full opacity-55"
      >
        <path
          d="M0 44C18 32 32 30 48 38C60 44 70 36 80 30V64H0V44Z"
          fill="var(--accent-soft)"
        />
        <path
          d="M0 52C20 44 40 38 62 46C70 49 76 46 80 44V64H0V52Z"
          fill="var(--accent-primary)"
          opacity="0.35"
        />
      </svg>
      <span className="material-symbols-outlined relative z-10 text-primary text-[24px]">
        {CATEGORY_ICONS[category] ?? "menu_book"}
      </span>
    </div>
  );
}
