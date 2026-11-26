"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { DashboardBotanicalAccent } from "@/components/DashboardBotanicalAccent";
import { formatMaterialCategory, formatRelativeTimestamp } from "@/lib/format";
import type { DashboardPayload, LearningMaterial, NoteItem } from "@/lib/types";

const SKILL_CARDS = [
  {
    href: "/listening",
    title: "Listening",
    subtitle: "Watch, listen and take notes",
    icon: "headphones",
  },
  {
    href: "/reading",
    title: "Reading",
    subtitle: "Read texts and grow vocabulary",
    icon: "menu_book",
  },
  {
    href: "/speaking",
    title: "Speaking",
    subtitle: "Practice speaking with AI feedback",
    icon: "mic",
  },
  {
    href: "/writing",
    title: "Writing",
    subtitle: "Improve your writing with detailed feedback",
    icon: "edit",
  },
];

function getContinueHref(material: LearningMaterial): string {
  if (material.type === "youtube") {
    return `/listening?materialId=${encodeURIComponent(material.id)}`;
  }
  if (material.type === "pdf") {
    return `/reading?materialId=${encodeURIComponent(material.id)}`;
  }
  if (material.type === "reading" && material.sourceUrl) {
    return `/reading?passageId=${encodeURIComponent(material.sourceUrl)}`;
  }
  return "/reading";
}

function getNoteDestination(note: NoteItem): string {
  if (note.materialType === "youtube" && note.materialId) {
    return `/listening?materialId=${encodeURIComponent(note.materialId)}&noteId=${encodeURIComponent(note.id)}`;
  }
  if (note.materialType === "pdf" && note.materialId) {
    return `/reading?materialId=${encodeURIComponent(note.materialId)}&noteId=${encodeURIComponent(note.id)}`;
  }
  if (note.materialType === "reading" && note.materialId) {
    return `/reading?passageId=${encodeURIComponent(note.materialId)}&noteId=${encodeURIComponent(note.id)}`;
  }
  return "/listening";
}

export function DashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuNoteId, setOpenMenuNoteId] = useState<string | null>(null);
  const [showAllNotesModal, setShowAllNotesModal] = useState(false);
  const [allNotes, setAllNotes] = useState<NoteItem[]>([]);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Desktop header notification popover
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load dashboard");
      const json = (await res.json()) as DashboardPayload;
      setData(json);
    } catch {
      setError("Could not load your learning workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load dashboard");
        return res.json() as Promise<DashboardPayload>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load your learning workspace.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onProfileUpdated = () => {
      void loadDashboard();
    };
    window.addEventListener("focus-profile-updated", onProfileUpdated);
    return () =>
      window.removeEventListener("focus-profile-updated", onProfileUpdated);
  }, [loadDashboard]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenuNoteId(null);
        setNotifOpen(false);
        setEditingNote(null);
        setShowAllNotesModal(false);
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (openMenuNoteId && !target?.closest("[data-note-menu]")) {
        setOpenMenuNoteId(null);
      }
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openMenuNoteId, notifOpen]);

  const loadAllNotes = async () => {
    setShowAllNotesModal(true);
    try {
      const res = await fetch("/api/notes", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setAllNotes(json.notes ?? []);
      }
    } catch {
      // keep existing state
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setOpenMenuNoteId(null);
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              recentNotes: prev.recentNotes.filter((n) => n.id !== noteId),
            }
          : prev
      );
      setAllNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  };

  const handleStartEditNote = (note: NoteItem) => {
    setOpenMenuNoteId(null);
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const handleSaveEditedNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !editTitle.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(
        `/api/notes/${encodeURIComponent(editingNote.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle, content: editContent }),
        }
      );
      if (res.ok) {
        setEditingNote(null);
        await loadDashboard();
        if (showAllNotesModal) {
          const allRes = await fetch("/api/notes", { cache: "no-store" });
          if (allRes.ok) {
            const json = await allRes.json();
            setAllNotes(json.notes ?? []);
          }
        }
      }
    } finally {
      setSavingNote(false);
    }
  };

  const greetingName =
    data?.user?.name && data.user.name !== "Learner"
      ? `, ${data.user.name}`
      : "";
  const userInitial = (data?.user?.name?.trim()?.[0] || "A").toUpperCase();

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      {/* Dashboard Welcome Header with subtle botanical accent (only on Dashboard) */}
      <section className="relative flex items-start justify-between gap-4 pt-1 pb-1">
        {/* Subtle Botanical Sprig behind top-right (desktop/tablet, per references) */}
        <div className="hidden sm:block absolute -top-6 right-10 -z-0 pointer-events-none overflow-hidden">
          <DashboardBotanicalAccent />
        </div>

        <div className="relative z-10">
          <h1 className="text-[24px] md:text-[32px] leading-[32px] md:leading-[40px] font-semibold tracking-[-0.025em] text-on-surface">
            Welcome back{greetingName}!
          </h1>
          <p className="text-[14px] md:text-[15px] leading-[22px] text-on-surface-variant mt-1">
            Practice your English skills in one place.
          </p>
        </div>

        {/* Desktop Header Actions: Notification Bell & User Initial Avatar (matching references) */}
        <div
          className="hidden md:flex items-center gap-2.5 relative z-20"
          ref={notifRef}
        >
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Study Notifications"
            aria-expanded={notifOpen}
            className="w-10 h-10 rounded-full bg-surface-container-lowest border border-border-subtle flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:border-primary/50 transition-colors"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <span className="material-symbols-outlined text-[20px]">
              notifications
            </span>
          </button>

          <Link
            href="/settings"
            aria-label="Profile and Appearance Settings"
            className="w-10 h-10 rounded-full bg-surface-container-high border border-border-subtle flex items-center justify-center text-[14px] font-semibold text-primary hover:border-primary transition-colors"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {userInitial}
          </Link>

          {notifOpen && (
            <div className="absolute right-0 top-12 w-72 focus-card-elevated p-4 z-50">
              <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle">
                <span className="text-[13px] font-semibold text-on-surface">
                  Workspace Updates
                </span>
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  className="text-outline hover:text-on-surface"
                  aria-label="Close notifications"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              </div>
              <div className="py-3 space-y-2 text-[12px] text-on-surface-variant">
                <p>
                  {data?.continueLearning
                    ? `Last studied: ${data.continueLearning.title}`
                    : "Ready for your next focused study session."}
                </p>
                <p className="text-outline">
                  Saved vocabulary: {data?.vocabularyCount ?? 0} words · Target CEFR{" "}
                  {data?.user?.targetLevel ?? "B2"}
                </p>
              </div>
              <div className="pt-2.5 border-t border-border-subtle flex gap-2">
                <Link
                  href="/settings"
                  onClick={() => setNotifOpen(false)}
                  className="flex-1 text-center py-2 px-3 rounded-lg bg-surface-container text-[12px] font-medium text-primary hover:bg-surface-container-high transition-colors"
                >
                  Appearance & Themes
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-error-container text-on-error-container text-[13px] flex items-center justify-between gap-3"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadDashboard}
            className="underline font-medium shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4 Main Skill Cards (2x2 mobile, 4 columns horizontal desktop) */}
      <section
        aria-label="Four English Skills"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-4"
      >
        {SKILL_CARDS.map((skill) => (
          <Link
            key={skill.href}
            href={skill.href}
            className="group focus-card p-4 md:p-5 flex flex-col justify-between hover:border-primary/50 active:scale-[0.985] transition-all"
          >
            <div className="flex items-center justify-between w-full">
              <span className="material-symbols-outlined text-primary text-[28px] group-hover:scale-105 transition-transform">
                {skill.icon}
              </span>
              <span className="material-symbols-outlined text-outline text-[18px] group-hover:translate-x-0.5 transition-transform">
                chevron_right
              </span>
            </div>
            <div className="mt-4 md:mt-5">
              <span className="text-[16px] leading-6 font-semibold text-on-surface block">
                {skill.title}
              </span>
              <span className="hidden sm:block text-[12px] leading-[17px] text-outline mt-1">
                {skill.subtitle}
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* Main Content Grid:
          Mobile order matches references: Continue Learning -> Recent Notes -> My Vocabulary.
          Desktop uses clean 7:5 balance with My Vocabulary spanning under Continue Learning. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6 items-start">
        {/* Continue Learning (1st mobile, top-left 7 cols desktop) */}
        <section className="order-1 lg:col-span-7 focus-card p-4 md:p-5 flex flex-col gap-3.5">
          <h2 className="text-[16px] leading-6 font-semibold text-on-surface">
            Continue Learning
          </h2>

          {loading ? (
            <div className="h-[88px] rounded-xl bg-surface-container animate-pulse" />
          ) : data?.continueLearning ? (
            <div className="flex items-center gap-3.5 md:gap-4">
              {/* Thumbnail */}
              <div className="relative w-16 h-16 md:w-36 md:h-24 rounded-xl overflow-hidden shrink-0 bg-surface-container flex items-center justify-center border border-border-subtle">
                {data.continueLearning.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.continueLearning.thumbnailUrl}
                    alt={data.continueLearning.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="material-symbols-outlined text-primary text-[30px]">
                    {data.continueLearning.type === "pdf"
                      ? "picture_as_pdf"
                      : "menu_book"}
                  </span>
                )}
              </div>

              {/* Title + Progress + Continue Button */}
              <div className="flex flex-col flex-1 min-w-0 gap-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {data.continueLearning.type === "youtube" ? (
                    <svg
                      className="w-4 h-4 shrink-0 fill-[#d93025]"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  ) : (
                    <span className="material-symbols-outlined text-primary text-[16px] shrink-0">
                      {data.continueLearning.type === "pdf"
                        ? "description"
                        : "menu_book"}
                    </span>
                  )}
                  <span className="text-[14px] md:text-[15px] leading-5 font-semibold text-on-surface truncate">
                    {data.continueLearning.title}
                  </span>
                </div>

                <div className="flex items-center gap-3 w-full">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(
                            4,
                            data.continueLearning.progressPercent
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-[12px] font-medium text-on-surface-variant shrink-0">
                      {data.continueLearning.progressPercent}%
                    </span>
                  </div>

                  {/* Desktop Continue Pill Button (matching reference sheets) */}
                  <Link
                    href={getContinueHref(data.continueLearning)}
                    className="hidden sm:inline-flex focus-btn-primary px-4 py-2 text-[13px] items-center gap-1 shrink-0"
                  >
                    <span className="material-symbols-outlined material-symbols-filled text-[17px]">
                      play_arrow
                    </span>
                    Continue
                  </Link>
                </div>
              </div>

              {/* Mobile Circular Play Button (matching mobile reference) */}
              <Link
                href={getContinueHref(data.continueLearning)}
                aria-label={`Continue ${data.continueLearning.title}`}
                className="sm:hidden w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 hover:bg-primary-container active:scale-95 transition-all text-on-primary"
              >
                <span className="material-symbols-outlined material-symbols-filled text-[20px]">
                  play_arrow
                </span>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center shrink-0 text-primary">
                  <span className="material-symbols-outlined text-[22px]">
                    play_lesson
                  </span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-on-surface">
                    Start your first focused session
                  </p>
                  <p className="text-[13px] text-on-surface-variant mt-0.5">
                    Paste a YouTube study video or open a reading passage to resume here anytime.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/listening"
                  className="focus-btn-primary px-4 py-2 text-[13px]"
                >
                  Open Listening
                </Link>
                <Link
                  href="/reading"
                  className="focus-btn-secondary px-3.5 py-2 text-[13px]"
                >
                  Reading
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Recent Notes (2nd mobile, right 5 cols desktop — grouped card matching references) */}
        <section className="order-2 lg:col-span-5 lg:row-span-2 focus-card p-4 md:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] leading-6 font-semibold text-on-surface">
              Recent Notes
            </h2>
            <button
              type="button"
              onClick={loadAllNotes}
              className="text-[13px] font-medium text-primary flex items-center gap-0.5 hover:underline"
            >
              <span>See all</span>
              <span className="material-symbols-outlined text-[15px]">
                chevron_right
              </span>
            </button>
          </div>

          {loading ? (
            <div className="h-[74px] rounded-xl bg-surface-container animate-pulse" />
          ) : data && data.recentNotes.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {data.recentNotes.slice(0, 4).map((note) => (
                <div
                  key={note.id}
                  className="relative flex items-center justify-between py-3 first:pt-1 last:pb-0"
                >
                  <button
                    type="button"
                    onClick={() => router.push(getNoteDestination(note))}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary">
                      <span className="material-symbols-outlined text-[20px]">
                        description
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] leading-5 font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                        {note.title}
                      </span>
                      <span className="text-[12px] leading-[18px] text-outline truncate">
                        {formatMaterialCategory(note.materialType)} ·{" "}
                        {formatRelativeTimestamp(note.updatedAt)}
                      </span>
                    </div>
                  </button>

                  <div className="relative ml-2" data-note-menu>
                    <button
                      type="button"
                      aria-label={`Options for ${note.title}`}
                      onClick={() =>
                        setOpenMenuNoteId((curr) =>
                          curr === note.id ? null : note.id
                        )
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-full text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        more_horiz
                      </span>
                    </button>

                    {openMenuNoteId === note.id && (
                      <div className="absolute right-0 top-9 w-40 focus-card-elevated py-1.5 z-30">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuNoteId(null);
                            router.push(getNoteDestination(note));
                          }}
                          className="w-full px-3.5 py-2 text-left text-[13px] text-on-surface hover:bg-surface-container-low flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            open_in_new
                          </span>
                          Open source
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditNote(note)}
                          className="w-full px-3.5 py-2 text-left text-[13px] text-on-surface hover:bg-surface-container-low flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            edit
                          </span>
                          Edit note
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="w-full px-3.5 py-2 text-left text-[13px] text-error hover:bg-error-container/40 flex items-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            delete
                          </span>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center mx-auto mb-2.5 text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]">
                  description
                </span>
              </div>
              <p className="text-[14px] font-medium text-on-surface">
                No notes yet
              </p>
              <p className="text-[12px] text-outline mt-1">
                Notes you write while watching a video or reading will appear here.
              </p>
            </div>
          )}
        </section>

        {/* My Vocabulary Bar (3rd mobile, bottom-left 7 cols desktop) */}
        <section className="order-3 lg:col-span-7">
          <Link
            href="/vocabulary"
            className="focus-card flex items-center justify-between p-4 md:px-5 md:py-4 hover:border-primary/50 active:bg-surface-container-low transition-colors group"
          >
            <div className="flex items-center gap-3.5">
              <span className="material-symbols-outlined text-primary text-[22px]">
                layers
              </span>
              <span className="text-[16px] leading-6 font-semibold text-on-surface">
                My Vocabulary
              </span>
            </div>
            <div className="flex items-center gap-0.5 text-primary text-[13px] font-medium">
              <span>
                {loading
                  ? "…"
                  : `${data?.vocabularyCount ?? 0} ${
                      (data?.vocabularyCount ?? 0) === 1 ? "word" : "words"
                    }`}
              </span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
                chevron_right
              </span>
            </div>
          </Link>
        </section>
      </div>

      {/* All Notes Modal */}
      {showAllNotesModal && (
        <div
          className="fixed inset-0 z-50 focus-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="All Saved Notes"
        >
          <div className="focus-card-elevated w-full max-w-2xl max-h-[82vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-on-surface">
                All Saved Notes ({allNotes.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowAllNotesModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                aria-label="Close all notes"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              {allNotes.length === 0 ? (
                <p className="text-[13px] text-on-surface-variant text-center py-8">
                  You have not saved any notes yet.
                </p>
              ) : (
                allNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 rounded-xl border border-border-subtle bg-surface-container-low/60 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-on-surface">
                          {note.title}
                        </p>
                        <p className="text-[12px] text-outline">
                          {formatMaterialCategory(note.materialType)}
                          {note.materialTitle ? ` · ${note.materialTitle}` : ""} ·{" "}
                          {formatRelativeTimestamp(note.updatedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditNote(note)}
                          className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-primary hover:bg-tertiary-fixed"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="px-2.5 py-1 rounded-lg text-[12px] font-medium text-error hover:bg-error-container/50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {note.content && (
                      <p className="text-[13px] text-on-surface-variant whitespace-pre-wrap line-clamp-3">
                        {note.content}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Edit Note Modal */}
      {editingNote && (
        <div
          className="fixed inset-0 z-50 focus-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Note"
        >
          <form
            onSubmit={handleSaveEditedNote}
            className="focus-card-elevated w-full max-w-lg p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-on-surface">
                Edit Note
              </h3>
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                aria-label="Cancel edit"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                Title
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                Content
              </label>
              <textarea
                rows={7}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="focus-input w-full px-3.5 py-2.5 text-[14px] leading-6 resize-y"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="focus-btn-secondary px-4 py-2 text-[13px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingNote}
                className="focus-btn-primary px-4 py-2 text-[13px]"
              >
                {savingNote ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
