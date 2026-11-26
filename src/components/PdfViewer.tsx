"use client";

import React, { useEffect, useRef, useState } from "react";

interface PdfViewerProps {
  fileUrl: string;
  title: string;
  onProgressChange?: (percent: number) => void;
}

interface PdfDocumentLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (opts: { scale: number }) => { width: number; height: number };
    render: (opts: {
      canvasContext: CanvasRenderingContext2D;
      canvas?: HTMLCanvasElement;
      viewport: { width: number; height: number };
    }) => { promise: Promise<void>; cancel: () => void };
  }>;
  destroy?: () => Promise<void>;
}

export function PdfViewer({
  fileUrl,
  title,
  onProgressChange,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<PdfDocumentLike | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomMultiplier, setZoomMultiplier] = useState(1);
  const [containerWidth, setContainerWidth] = useState(680);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Measure container width so PDF never overflows horizontally on mobile
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 120) setContainerWidth(w - 24);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load PDF document via PDF.js
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const loadingTask = pdfjs.getDocument({ url: fileUrl });
        const doc = (await loadingTask.promise) as unknown as PdfDocumentLike;
        if (cancelled) {
          doc.destroy?.().catch(() => {});
          return;
        }
        pdfDocRef.current = doc;
        setError(null);
        setPageNumber(1);
        setNumPages(doc.numPages);
        setLoading(false);
        if (doc.numPages > 0) {
          onProgressChange?.(Math.round((1 / doc.numPages) * 100));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("PDF load error:", err);
          setError(
            "Could not render this PDF document. Verify the file is a valid, unencrypted PDF."
          );
          setLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy?.().catch(() => {});
      pdfDocRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  // Render active page to canvas
  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || numPages === 0) return;

    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null;
    let cancelled = false;

    async function renderPage() {
      try {
        const page = await doc!.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.max(
          0.4,
          Math.min(2.2, (containerWidth / baseViewport.width) * zoomMultiplier)
        );
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: fitScale * dpr });

        const ctx = canvas!.getContext("2d");
        if (!ctx) return;

        canvas!.width = Math.floor(viewport.width);
        canvas!.height = Math.floor(viewport.height);
        canvas!.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas!.style.height = `${Math.floor(viewport.height / dpr)}px`;

        renderTask = page.render({
          canvasContext: ctx,
          canvas: canvas!,
          viewport,
        });
        await renderTask.promise;
      } catch (err) {
        if (!cancelled && (err as { name?: string })?.name !== "RenderingCancelledException") {
          setError("Error rendering this page.");
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // ignore cancel
      }
    };
  }, [pageNumber, numPages, containerWidth, zoomMultiplier]);

  const goToPage = (next: number) => {
    const clamped = Math.max(1, Math.min(numPages, next));
    setPageNumber(clamped);
    if (numPages > 0) {
      onProgressChange?.(Math.round((clamped / numPages) * 100));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Minimal PDF Navigation Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-border-subtle">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pageNumber <= 1 || loading}
            onClick={() => goToPage(pageNumber - 1)}
            aria-label="Previous page"
            className="focus-btn-secondary w-9 h-9 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[19px]">
              chevron_left
            </span>
          </button>
          <span className="px-2.5 text-[13px] font-medium text-on-surface">
            {numPages > 0 ? `Page ${pageNumber} of ${numPages}` : "Loading..."}
          </span>
          <button
            type="button"
            disabled={pageNumber >= numPages || loading}
            onClick={() => goToPage(pageNumber + 1)}
            aria-label="Next page"
            className="focus-btn-secondary w-9 h-9 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[19px]">
              chevron_right
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomMultiplier((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
            aria-label="Zoom out"
            className="focus-btn-secondary w-8 h-8 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[17px]">remove</span>
          </button>
          <button
            type="button"
            onClick={() => setZoomMultiplier(1)}
            className="focus-btn-secondary px-2.5 h-8 text-[12px]"
          >
            {Math.round(zoomMultiplier * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoomMultiplier((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}
            aria-label="Zoom in"
            className="focus-btn-secondary w-8 h-8 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[17px]">add</span>
          </button>
        </div>
      </div>

      {/* Responsive PDF Canvas Surface */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto rounded-2xl bg-surface-container/60 border border-border-subtle p-3 flex justify-center min-h-[420px]"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 text-on-surface-variant py-16">
            <span className="material-symbols-outlined text-[28px] text-primary animate-spin">
              progress_activity
            </span>
            <p className="text-[13px]">Rendering {title}...</p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-2 text-center py-12 px-4 max-w-md"
          >
            <span className="material-symbols-outlined text-[30px] text-error">
              picture_as_pdf
            </span>
            <p className="text-[14px] font-medium text-on-surface">{error}</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            aria-label={`${title} page ${pageNumber}`}
            className="bg-white rounded-lg border border-border-subtle shadow-[0_2px_12px_rgba(0,0,0,0.12)] max-w-full h-auto"
          />
        )}
      </div>
    </div>
  );
}
