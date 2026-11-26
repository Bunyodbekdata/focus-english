import React, { Suspense } from "react";
import { ReadingClient } from "@/components/ReadingClient";

export default function ReadingPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 rounded-2xl bg-surface-container-lowest border border-border-subtle animate-pulse" />
      }
    >
      <ReadingClient />
    </Suspense>
  );
}
