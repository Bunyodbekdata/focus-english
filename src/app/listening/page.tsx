import React, { Suspense } from "react";
import { ListeningClient } from "@/components/ListeningClient";

export default function ListeningPage() {
  return (
    <Suspense
      fallback={
        <div className="h-64 rounded-2xl bg-surface-container-lowest border border-border-subtle animate-pulse" />
      }
    >
      <ListeningClient />
    </Suspense>
  );
}
