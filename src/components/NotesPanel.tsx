"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { formatRelativeTimestamp } from "@/lib/format";
import type { NoteItem } from "@/lib/types";

interface NotesPanelProps {
  materialId: string | null;
  materialType: NoteItem["materialType"];
  materialTitle: string;
  initialNoteId?: string | null;
  getTimestampLabel?: () => string | null;
}

export function NotesPanel({
  materialId,
  materialType,
  materialTitle,
  initialNoteId,
  getTimestampLabel,
}: NotesPanelProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHydratingRef = useRef(false);
  const activeNoteIdRef = useRef<string | null>(null);
  const inFlightCreateRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    activeNoteIdRef.current = activeNoteId;
  }, [activeNoteId]);

  useEffect(() => {
    let cancelled = false;
    const qs = materialId
      ? `?materialId=${encodeURIComponent(materialId)}`
      : `?materialType=${encodeURIComponent(materialType)}`;

    fetch(`/api/notes${qs}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ notes: NoteItem[] }>) : null))
      .then((json) => {
        if (cancelled || !json) return;
        const fetched = json.notes ?? [];
        setNotes(fetched);

        const target =
          (initialNoteId && fetched.find((n) => n.id === initialNoteId)) ||
          fetched[0] ||
          null;

        isHydratingRef.current = true;
        if (target) {
          setActiveNoteId(target.id);
          setTitle(target.title);
          setContent(target.content);
        } else {
          setActiveNoteId(null);
          setTitle(materialTitle ? `${materialTitle} – notes` : "");
          setContent("");
        }
        setSaveState("idle");
        setTimeout(() => {
          isHydratingRef.current = false;
        }, 50);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [materialId, materialType, materialTitle, initialNoteId]);

  const persistNote = useCallback(
    async (
      nextNoteId: string | null,
      nextTitle: string,
      nextContent: string
    ) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      const cleanTitle =
        nextTitle.trim() ||
        (materialTitle ? `${materialTitle} – notes` : "Study notes");

      let resolvedId = nextNoteId ?? activeNoteIdRef.current;
      if (!resolvedId && inFlightCreateRef.current) {
        resolvedId = await inFlightCreateRef.current;
      }

      if (!resolvedId && !nextContent.trim() && !nextTitle.trim()) {
        return;
      }

      setSaveState("saving");
      try {
        if (resolvedId) {
          const res = await fetch(`/api/notes/${encodeURIComponent(resolvedId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: cleanTitle, content: nextContent }),
          });
          if (!res.ok) throw new Error("Save failed");
          const { note } = (await res.json()) as { note: NoteItem };
          setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
          setSaveState("saved");
        } else {
          const createPromise = (async (): Promise<string | null> => {
            const res = await fetch("/api/notes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                materialId,
                materialType,
                materialTitle,
                title: cleanTitle,
                content: nextContent,
              }),
            });
            if (!res.ok) throw new Error("Create failed");
            const { note } = (await res.json()) as { note: NoteItem };
            activeNoteIdRef.current = note.id;
            setActiveNoteId(note.id);
            setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
            return note.id;
          })();
          inFlightCreateRef.current = createPromise;
          try {
            await createPromise;
            setSaveState("saved");
          } finally {
            inFlightCreateRef.current = null;
          }
        }
      } catch {
        setSaveState("error");
      }
    },
    [materialId, materialType, materialTitle]
  );

  // Debounced auto-save
  useEffect(() => {
    if (isHydratingRef.current) return;
    if (!activeNoteId && !content.trim()) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      persistNote(activeNoteId, title, content);
    }, 850);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, content, activeNoteId, persistNote]);

  const handleSelectNote = async (note: NoteItem) => {
    if (debounceRef.current) {
      await persistNote(activeNoteIdRef.current, title, content);
    }
    isHydratingRef.current = true;
    activeNoteIdRef.current = note.id;
    setActiveNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setSaveState("idle");
    setTimeout(() => {
      isHydratingRef.current = false;
    }, 50);
  };

  const handleNewNote = async () => {
    if (debounceRef.current) {
      await persistNote(activeNoteIdRef.current, title, content);
    }
    isHydratingRef.current = true;
    activeNoteIdRef.current = null;
    setActiveNoteId(null);
    setTitle(materialTitle ? `${materialTitle} – note ${notes.length + 1}` : "");
    setContent("");
    setSaveState("idle");
    setTimeout(() => {
      isHydratingRef.current = false;
      textareaRef.current?.focus();
    }, 50);
  };

  const handleDeleteCurrent = async () => {
    if (!activeNoteId) {
      setTitle("");
      setContent("");
      return;
    }
    const res = await fetch(`/api/notes/${encodeURIComponent(activeNoteId)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const remaining = notes.filter((n) => n.id !== activeNoteId);
      setNotes(remaining);
      isHydratingRef.current = true;
      if (remaining[0]) {
        setActiveNoteId(remaining[0].id);
        setTitle(remaining[0].title);
        setContent(remaining[0].content);
      } else {
        setActiveNoteId(null);
        setTitle(materialTitle ? `${materialTitle} – notes` : "");
        setContent("");
      }
      setSaveState("idle");
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 50);
    }
  };

  const applyFormat = (prefix: string, suffix = "") => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const updated =
      content.slice(0, start) + prefix + selected + suffix + content.slice(end);
    setContent(updated);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + prefix.length + selected.length + suffix.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const insertTimestamp = () => {
    const ts = getTimestampLabel?.();
    if (!ts) return;
    applyFormat(`[${ts}] `);
  };

  return (
    <section
      aria-label="Study Notes"
      className="focus-card p-4 md:p-5 flex flex-col gap-3.5 h-full"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary text-[20px]">
            description
          </span>
          <h2 className="text-[16px] font-semibold text-on-surface truncate">
            Notes
          </h2>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant shrink-0">
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
              ? "Saved"
              : saveState === "error"
              ? "Save failed"
              : "Auto-save"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleNewNote}
            className="px-2.5 py-1.5 rounded-lg bg-surface-container text-[12px] font-medium text-primary hover:bg-tertiary-fixed transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
            New
          </button>
          {activeNoteId && (
            <button
              type="button"
              onClick={handleDeleteCurrent}
              aria-label="Delete current note"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/40 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                delete
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Existing notes switcher for this material */}
      {notes.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleSelectNote(n)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium shrink-0 transition-colors ${
                activeNoteId === n.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-tertiary-fixed"
              }`}
            >
              {n.title}
            </button>
          ))}
        </div>
      )}

      {/* Note Title */}
      <div>
        <label htmlFor="note-title-input" className="sr-only">
          Note title
        </label>
        <input
          id="note-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title (e.g., Key expressions & ideas)"
          className="focus-input w-full px-3.5 py-2 text-[14px] font-medium"
        />
      </div>

      {/* Lightweight Formatting Bar */}
      <div className="flex items-center flex-wrap gap-1 border-b border-border-subtle pb-2">
        <button
          type="button"
          onClick={() => applyFormat("**", "**")}
          title="Bold"
          className="px-2 py-1 rounded-md text-[12px] font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => applyFormat("*", "*")}
          title="Italic"
          className="px-2 py-1 rounded-md text-[12px] italic font-serif text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => applyFormat("## ")}
          title="Heading"
          className="px-2 py-1 rounded-md text-[12px] font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => applyFormat("\n- ")}
          title="Bullet point"
          className="px-2 py-1 rounded-md text-[12px] text-on-surface-variant hover:bg-surface-container transition-colors flex items-center"
        >
          <span className="material-symbols-outlined text-[16px]">
            format_list_bulleted
          </span>
        </button>
        {getTimestampLabel && (
          <button
            type="button"
            onClick={insertTimestamp}
            className="ml-auto px-2.5 py-1 rounded-md bg-surface-container text-[12px] font-medium text-primary hover:bg-tertiary-fixed transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">
              schedule
            </span>
            Timestamp
          </button>
        )}
      </div>

      {/* Editor Textarea */}
      <div className="flex-1 flex flex-col min-h-[220px]">
        <label htmlFor="note-content-editor" className="sr-only">
          Note content
        </label>
        <textarea
          ref={textareaRef}
          id="note-content-editor"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading}
          placeholder="Write key ideas, phrases, or grammar patterns as you study..."
          className="focus-input w-full flex-1 min-h-[220px] p-3.5 text-[14px] leading-[1.65] resize-y"
        />
      </div>

      {/* Footer status & manual Save */}
      <div className="flex items-center justify-between gap-2 pt-1 text-[12px] text-outline">
        <span>
          {activeNoteId && notes.find((n) => n.id === activeNoteId)
            ? `Updated ${formatRelativeTimestamp(
                notes.find((n) => n.id === activeNoteId)!.updatedAt
              )}`
            : "Start typing to save automatically"}
        </span>
        <button
          type="button"
          onClick={() => persistNote(activeNoteId, title, content)}
          disabled={saveState === "saving" || (!content.trim() && !title.trim())}
          className="focus-btn-primary px-3.5 py-1.5 text-[12px]"
        >
          Save Note
        </button>
      </div>
    </section>
  );
}
