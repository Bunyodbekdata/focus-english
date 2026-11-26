"use client";

import { useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { InlineVocabularyPanel } from "@/components/InlineVocabularyPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { PdfViewer } from "@/components/PdfViewer";
import { ReadingCategoryThumb } from "@/components/ReadingCategoryThumb";
import { formatRelativeTimestamp, getUploadedAssetUrl } from "@/lib/format";
import type {
  CefrLevel,
  LearningMaterial,
  ReadingCategory,
  ReadingPassage,
  UserProfile,
} from "@/lib/types";

const CEFR_LEVELS: Array<"ALL" | CefrLevel> = [
  "ALL",
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
];

const CATEGORIES: Array<"ALL" | ReadingCategory> = [
  "ALL",
  "Technology",
  "Science",
  "History",
  "Business",
  "Nature",
  "Society",
];

export function ReadingClient() {
  const searchParams = useSearchParams();
  const requestedPassageId = searchParams.get("passageId");
  const requestedMaterialId = searchParams.get("materialId");
  const requestedNoteId = searchParams.get("noteId");

  const [tab, setTab] = useState<"library" | "pdfs">("library");
  const [selectedLevel, setSelectedLevel] = useState<"ALL" | CefrLevel>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<
    "ALL" | ReadingCategory
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [passages, setPassages] = useState<ReadingPassage[]>([]);
  const [pdfs, setPdfs] = useState<LearningMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  const [activePassage, setActivePassage] = useState<ReadingPassage | null>(
    null
  );
  const [activePdf, setActivePdf] = useState<LearningMaterial | null>(null);
  const [markedFinished, setMarkedFinished] = useState(false);

  // Reading comfort preferences
  const [readingWidth, setReadingWidth] =
    useState<UserProfile["readingWidth"]>("medium");
  const [readingFontSize, setReadingFontSize] =
    useState<UserProfile["readingFontSize"]>("md");
  const [sideTab, setSideTab] = useState<"notes" | "vocabulary">("notes");

  // PDF upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Add Passage modal state (keeps library extensible without code changes)
  const [showAddPassage, setShowAddPassage] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newLevel, setNewLevel] = useState<CefrLevel>("B1");
  const [newCategory, setNewCategory] = useState<ReadingCategory>("Science");
  const [newSummary, setNewSummary] = useState("");
  const [newContent, setNewContent] = useState("");
  const [addingPassage, setAddingPassage] = useState(false);
  const [addPassageError, setAddPassageError] = useState<string | null>(null);

  // Fetch user reading preferences
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setReadingWidth(data.user.readingWidth ?? "medium");
          setReadingFontSize(data.user.readingFontSize ?? "md");
        }
      })
      .catch(() => {});
  }, []);

  const openPassage = useCallback(async (passage: ReadingPassage) => {
    setActivePdf(null);
    setActivePassage(passage);
    setMarkedFinished(false);
    try {
      await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reading",
          readingId: passage.id,
          title: passage.title,
          progressPercent: 15,
        }),
      });
    } catch {
      // ignore transient history save error
    }
  }, []);

  const restoredRef = useRef(false);

  const loadLibraryAndPdfs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedLevel !== "ALL") params.set("cefrLevel", selectedLevel);
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const [readingRes, pdfRes] = await Promise.all([
        fetch(`/api/reading?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/materials?type=pdf", { cache: "no-store" }),
      ]);

      let fetchedPassages: ReadingPassage[] = [];
      let fetchedPdfs: LearningMaterial[] = [];

      if (readingRes.ok) {
        const json = (await readingRes.json()) as {
          passages: ReadingPassage[];
        };
        fetchedPassages = json.passages ?? [];
        setPassages(fetchedPassages);
      }

      if (pdfRes.ok) {
        const json = (await pdfRes.json()) as {
          materials: LearningMaterial[];
        };
        fetchedPdfs = json.materials ?? [];
        setPdfs(fetchedPdfs);
      }

      if (!restoredRef.current) {
        if (requestedPassageId) {
          const found = fetchedPassages.find((p) => p.id === requestedPassageId);
          if (found) {
            restoredRef.current = true;
            void openPassage(found);
          }
        } else if (requestedMaterialId) {
          const found = fetchedPdfs.find((m) => m.id === requestedMaterialId);
          if (found) {
            restoredRef.current = true;
            setTab("pdfs");
            setActivePdf(found);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [
    selectedLevel,
    selectedCategory,
    searchQuery,
    requestedPassageId,
    requestedMaterialId,
    openPassage,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadLibraryAndPdfs();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadLibraryAndPdfs]);

  const handleMarkPassageComplete = async () => {
    if (!activePassage) return;
    const res = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "reading",
        readingId: activePassage.id,
        title: activePassage.title,
        progressPercent: 100,
      }),
    });
    if (res.ok) {
      setMarkedFinished(true);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingPdf(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/pdfs/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error ?? "PDF upload failed.");
        return;
      }
      const material = json.material as LearningMaterial;
      setPdfs((prev) => [material, ...prev]);
      setActivePassage(null);
      setActivePdf(material);
      setTab("pdfs");
    } catch {
      setUploadError("Could not upload PDF document.");
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePdf = async (id: string) => {
    const res = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setPdfs((prev) => prev.filter((p) => p.id !== id));
      if (activePdf?.id === id) setActivePdf(null);
    }
  };

  const handlePdfProgress = useCallback(
    (percent: number) => {
      if (!activePdf) return;
      fetch(`/api/materials/${encodeURIComponent(activePdf.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progressPercent: percent }),
      }).catch(() => {});
    },
    [activePdf]
  );

  const handleCreatePassage = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddPassageError(null);
    setAddingPassage(true);
    try {
      const res = await fetch("/api/reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          cefrLevel: newLevel,
          category: newCategory,
          summary: newSummary,
          content: newContent,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddPassageError(json.error ?? "Unable to save passage.");
        return;
      }
      setShowAddPassage(false);
      setNewTitle("");
      setNewSummary("");
      setNewContent("");
      await loadLibraryAndPdfs();
      openPassage(json.passage as ReadingPassage);
    } catch {
      setAddPassageError("Network error while adding passage.");
    } finally {
      setAddingPassage(false);
    }
  };

  const updateComfortPref = (patch: Partial<UserProfile>) => {
    if (patch.readingWidth) setReadingWidth(patch.readingWidth);
    if (patch.readingFontSize) setReadingFontSize(patch.readingFontSize);
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  };

  const widthClass =
    readingWidth === "narrow"
      ? "max-w-[54ch]"
      : readingWidth === "wide"
      ? "max-w-none"
      : "max-w-[68ch]";

  const fontSizeClass =
    readingFontSize === "sm"
      ? "text-[15px] leading-[1.75]"
      : readingFontSize === "lg"
      ? "text-[18px] leading-[1.85]"
      : "text-[16px] leading-[1.8]";

  // --- WORKSPACE VIEW (Active Passage or Active PDF) ---
  if (activePassage || activePdf) {
    const workspaceTitle = activePassage
      ? activePassage.title
      : activePdf?.title ?? "Document";
    const sourceId = activePassage
      ? activePassage.id
      : activePdf?.id ?? null;
    const sourceType = activePassage ? "reading" : "pdf";

    return (
      <div className="flex flex-col gap-5">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setActivePassage(null);
              setActivePdf(null);
            }}
            className="focus-btn-secondary px-3.5 py-2 text-[13px] flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            Back to Reading
          </button>

          {activePassage && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Width selector */}
              <div
                aria-label="Reading width"
                className="hidden sm:inline-flex items-center rounded-lg bg-surface-container p-0.5 text-[12px]"
              >
                {(["narrow", "medium", "wide"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updateComfortPref({ readingWidth: w })}
                    className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                      readingWidth === w
                        ? "bg-surface-container-lowest text-on-surface"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>

              {/* Font size selector */}
              <div
                aria-label="Reading text size"
                className="inline-flex items-center rounded-lg bg-surface-container p-0.5 text-[12px]"
              >
                {(
                  [
                    { key: "sm", label: "A-" },
                    { key: "md", label: "A" },
                    { key: "lg", label: "A+" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      updateComfortPref({ readingFontSize: item.key })
                    }
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                      readingFontSize === item.key
                        ? "bg-surface-container-lowest text-on-surface"
                        : "text-on-surface-variant"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Reading Stage + Notes/Vocabulary Side Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Primary Reading Surface (7 cols) */}
          <article className="lg:col-span-7 focus-card p-5 sm:p-8 min-w-0">
            {activePassage ? (
              <div className={`${widthClass} mx-auto`}>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-primary text-[12px] font-semibold">
                    {activePassage.cefrLevel}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[12px] font-medium">
                    {activePassage.category}
                  </span>
                  <span className="text-[12px] text-outline">
                    {activePassage.wordCount} words · ~
                    {activePassage.estimatedMinutes} min read
                  </span>
                </div>

                <h1 className="text-[22px] sm:text-[26px] leading-[32px] sm:leading-[36px] font-semibold tracking-[-0.015em] text-on-surface mb-6">
                  {activePassage.title}
                </h1>

                <div className={`space-y-5 text-on-surface ${fontSizeClass}`}>
                  {activePassage.content
                    .split(/\n\s*\n/)
                    .filter(Boolean)
                    .map((para, index) => (
                      <p key={index} className="break-words">
                        {para.trim()}
                      </p>
                    ))}
                </div>

                <div className="mt-8 pt-5 border-t border-border-subtle flex items-center justify-between gap-3">
                  <span className="text-[12px] text-outline">
                    Save unfamiliar words or takeaways in the study panel.
                  </span>
                  <button
                    type="button"
                    onClick={handleMarkPassageComplete}
                    disabled={markedFinished}
                    className={`px-3.5 py-2 text-[13px] flex items-center gap-1.5 ${
                      markedFinished ? "focus-btn-primary" : "focus-btn-secondary"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      check_circle
                    </span>
                    {markedFinished ? "Finished" : "Mark Finished"}
                  </button>
                </div>
              </div>
            ) : activePdf?.filePath ? (
              <div className="flex flex-col gap-4">
                <div>
                  <span className="text-[12px] font-medium text-primary">
                    Personal PDF Document
                  </span>
                  <h1 className="text-[20px] font-semibold text-on-surface mt-0.5 break-words">
                    {activePdf.title}
                  </h1>
                </div>
                <PdfViewer
                  fileUrl={getUploadedAssetUrl(activePdf.filePath)}
                  title={activePdf.title}
                  onProgressChange={handlePdfProgress}
                />
              </div>
            ) : null}
          </article>

          {/* Study Companion Panel: Notes & Vocabulary (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-3 lg:sticky lg:top-6 min-w-0">
            <div className="inline-flex rounded-xl bg-surface-container p-1 self-start">
              <button
                type="button"
                onClick={() => setSideTab("notes")}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  sideTab === "notes"
                    ? "bg-surface-container-lowest text-on-surface shadow-xs"
                    : "text-on-surface-variant"
                }`}
              >
                Notes
              </button>
              <button
                type="button"
                onClick={() => setSideTab("vocabulary")}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                  sideTab === "vocabulary"
                    ? "bg-surface-container-lowest text-on-surface shadow-xs"
                    : "text-on-surface-variant"
                }`}
              >
                Vocabulary
              </button>
            </div>

            {sideTab === "notes" ? (
              <NotesPanel
                materialId={sourceId}
                materialType={sourceType}
                materialTitle={workspaceTitle}
                initialNoteId={requestedNoteId}
              />
            ) : (
              <InlineVocabularyPanel
                sourceMaterialId={sourceId}
                sourceTitle={workspaceTitle}
                sourceType={sourceType}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- LIBRARY & PERSONAL PDF BROWSER ---
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] md:text-[28px] leading-[32px] md:leading-[36px] font-semibold tracking-[-0.02em] text-on-surface">
            Reading
          </h1>
          <p className="text-[14px] text-on-surface-variant mt-1">
            Read CEFR-graded articles or upload your own PDF documents in a calm workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handlePdfUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploadingPdf}
            onClick={() => fileInputRef.current?.click()}
            className="focus-btn-primary px-4 py-2.5 text-[13px] flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">
              upload_file
            </span>
            {uploadingPdf ? "Uploading..." : "Upload PDF"}
          </button>
          <button
            type="button"
            onClick={() => setShowAddPassage(true)}
            className="focus-btn-secondary px-3.5 py-2.5 text-[13px] flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Passage
          </button>
        </div>
      </section>

      {uploadError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-error-container text-on-error-container text-[13px]"
        >
          {uploadError}
        </div>
      )}

      {/* Mode Switcher (Matches Reference: My Documents | Reading Library) */}
      <div className="inline-flex rounded-xl bg-surface-container p-1 self-start">
        <button
          type="button"
          onClick={() => setTab("pdfs")}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
            tab === "pdfs"
              ? "bg-surface-container-lowest text-on-surface"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          My Documents ({pdfs.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("library")}
          className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
            tab === "library"
              ? "bg-surface-container-lowest text-on-surface"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Reading Library ({passages.length})
        </button>
      </div>

      {tab === "library" ? (
        <div className="flex flex-col gap-5">
          {/* Filters Card */}
          <section className="focus-card p-4 flex flex-col gap-3.5">
            <div className="relative">
              <span className="material-symbols-outlined text-outline text-[19px] absolute left-3.5 top-1/2 -translate-y-1/2">
                search
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles by title or topic..."
                aria-label="Search reading library"
                className="focus-input w-full pl-10 pr-4 py-2 text-[14px]"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12px] font-medium text-outline mr-1">
                  CEFR:
                </span>
                {CEFR_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl)}
                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                      selectedLevel === lvl
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-tertiary-fixed"
                    }`}
                  >
                    {lvl === "ALL" ? "All" : lvl}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12px] font-medium text-outline mr-1">
                  Topic:
                </span>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                      selectedCategory === cat
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-tertiary-fixed"
                    }`}
                  >
                    {cat === "ALL" ? "All" : cat}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Article Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-44 rounded-2xl bg-surface-container-lowest border border-border-subtle animate-pulse"
                />
              ))}
            </div>
          ) : passages.length === 0 ? (
            <div className="focus-card p-8 text-center">
              <p className="text-[15px] font-semibold text-on-surface">
                No matching reading passages
              </p>
              <p className="text-[13px] text-on-surface-variant mt-1">
                Try clearing a CEFR or topic filter, or add your own passage.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {passages.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => openPassage(article)}
                  className="focus-card p-4 sm:p-5 text-left flex items-start gap-4 hover:border-primary/50 transition-colors group"
                >
                  <ReadingCategoryThumb category={article.category} />

                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <h2 className="text-[15px] sm:text-[16px] leading-[22px] font-semibold text-on-surface group-hover:text-primary transition-colors">
                      {article.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-primary font-semibold">
                        {article.cefrLevel}
                      </span>
                      <span className="text-on-surface-variant font-medium">
                        {article.category}
                      </span>
                      <span className="text-outline">·</span>
                      <span className="text-outline">
                        {article.estimatedMinutes} min read
                      </span>
                    </div>

                    <p className="text-[13px] text-on-surface-variant line-clamp-2 mt-0.5">
                      {article.summary}
                    </p>
                  </div>

                  <span className="material-symbols-outlined text-outline text-[20px] shrink-0 mt-0.5 group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                    chevron_right
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Personal PDFs Tab */
        <section className="flex flex-col gap-4">
          {pdfs.length === 0 ? (
            <div className="focus-card p-8 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[26px]">
                  picture_as_pdf
                </span>
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-on-surface">
                  Upload your own PDF reading materials
                </h2>
                <p className="text-[13px] text-on-surface-variant mt-1 max-w-md">
                  Read academic papers, short stories, or IELTS reading PDFs inside Focus English alongside notes and vocabulary.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="focus-btn-primary px-4 py-2 text-[13px]"
              >
                Choose PDF File
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pdfs.map((doc) => (
                <div
                  key={doc.id}
                  className="focus-card p-4 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActivePassage(null);
                      setActivePdf(doc);
                    }}
                    className="flex items-center gap-3.5 flex-1 min-w-0 text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center shrink-0 text-primary">
                      <span className="material-symbols-outlined text-[22px]">
                        picture_as_pdf
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-on-surface truncate">
                        {doc.title}
                      </p>
                      <p className="text-[12px] text-outline">
                        {doc.progressPercent}% read ·{" "}
                        {formatRelativeTimestamp(doc.lastOpenedAt)}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePdf(doc.id)}
                    aria-label={`Delete ${doc.title}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-error hover:bg-error-container/40 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Add Reading Passage Modal */}
      {showAddPassage && (
        <div
          className="fixed inset-0 z-50 focus-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Add Reading Passage"
        >
          <form
            onSubmit={handleCreatePassage}
            className="focus-card-elevated w-full max-w-xl max-h-[88vh] overflow-y-auto p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-on-surface">
                Add Passage to Reading Library
              </h2>
              <button
                type="button"
                onClick={() => setShowAddPassage(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            {addPassageError && (
              <p role="alert" className="text-[12px] text-error">
                {addPassageError}
              </p>
            )}

            <div>
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                Title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Passage title"
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                  CEFR Level
                </label>
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value as CefrLevel)}
                  className="focus-input w-full px-3 py-2 text-[14px]"
                >
                  {(["A1", "A2", "B1", "B2", "C1", "C2"] as const).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(e.target.value as ReadingCategory)
                  }
                  className="focus-input w-full px-3 py-2 text-[14px]"
                >
                  {(
                    [
                      "Technology",
                      "Science",
                      "History",
                      "Business",
                      "Nature",
                      "Society",
                    ] as const
                  ).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                Short Summary
              </label>
              <input
                type="text"
                required
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
                placeholder="One-sentence overview of this reading"
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                Reading Text
              </label>
              <textarea
                rows={7}
                required
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Paste or write paragraphs separated by blank lines..."
                className="focus-input w-full px-3.5 py-2.5 text-[14px] leading-6 resize-y"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddPassage(false)}
                className="focus-btn-secondary px-4 py-2 text-[13px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addingPassage}
                className="focus-btn-primary px-4 py-2 text-[13px]"
              >
                {addingPassage ? "Saving..." : "Add to Library"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
