"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import type { VocabularyEntry } from "@/lib/types";

interface InlineVocabularyPanelProps {
  sourceMaterialId: string | null;
  sourceTitle: string;
  sourceType: VocabularyEntry["sourceType"];
}

export function InlineVocabularyPanel({
  sourceMaterialId,
  sourceTitle,
  sourceType,
}: InlineVocabularyPanelProps) {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [word, setWord] = useState("");
  const [meaningUz, setMeaningUz] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"source" | "all">("source");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editMeaning, setEditMeaning] = useState("");
  const [editNote, setEditNote] = useState("");

  const loadEntries = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (scope === "source" && sourceMaterialId) {
      params.set("sourceMaterialId", sourceMaterialId);
    }
    const res = await fetch(`/api/vocabulary?${params.toString()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { entries: VocabularyEntry[] };
      setEntries(json.entries ?? []);
    }
  }, [search, scope, sourceMaterialId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEntries();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadEntries]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!word.trim() || !meaningUz.trim()) {
      setError("Enter both an English word and its Uzbek meaning.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.trim(),
          meaningUz: meaningUz.trim(),
          personalNote: personalNote.trim(),
          sourceMaterialId,
          sourceTitle,
          sourceType,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Unable to save word.");
        return;
      }
      setWord("");
      setMeaningUz("");
      setPersonalNote("");
      await loadEntries();
    } catch {
      setError("Network error while saving vocabulary.");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item: VocabularyEntry) => {
    setEditingId(item.id);
    setEditWord(item.word);
    setEditMeaning(item.meaningUz);
    setEditNote(item.personalNote);
  };

  const handleSaveEdit = async (id: string) => {
    setError(null);
    if (!editWord.trim() || !editMeaning.trim()) {
      setError("Both English word and Uzbek meaning are required.");
      return;
    }
    const res = await fetch(`/api/vocabulary/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: editWord.trim(),
        meaningUz: editMeaning.trim(),
        personalNote: editNote.trim(),
      }),
    });
    if (res.ok) {
      setEditingId(null);
      await loadEntries();
    } else {
      const json = await res.json().catch(() => null);
      setError(json?.error ?? "Unable to update entry.");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/vocabulary/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setEntries((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <section
      aria-label="Vocabulary"
      className="focus-card p-4 md:p-5 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">
            library_books
          </span>
          <h2 className="text-[16px] font-semibold text-on-surface">
            Vocabulary
          </h2>
          <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-surface-container text-primary">
            {entries.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {sourceMaterialId && (
            <div className="inline-flex rounded-lg bg-surface-container p-0.5 text-[12px]">
              <button
                type="button"
                onClick={() => setScope("source")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  scope === "source"
                    ? "bg-surface-container-lowest text-on-surface shadow-xs"
                    : "text-on-surface-variant"
                }`}
              >
                This material
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  scope === "all"
                    ? "bg-surface-container-lowest text-on-surface shadow-xs"
                    : "text-on-surface-variant"
                }`}
              >
                All saved
              </button>
            </div>
          )}
          <Link
            href="/vocabulary"
            className="text-[12px] font-medium text-primary hover:underline flex items-center gap-0.5"
          >
            Full list
            <span className="material-symbols-outlined text-[15px]">
              chevron_right
            </span>
          </Link>
        </div>
      </div>

      {/* Add Word Form */}
      <form
        onSubmit={handleAdd}
        className="grid grid-cols-1 sm:grid-cols-12 gap-2.5"
      >
        <div className="sm:col-span-4">
          <label htmlFor="vocab-word-input" className="sr-only">
            English word
          </label>
          <input
            id="vocab-word-input"
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="English word or phrase"
            className="focus-input w-full px-3 py-2 text-[13px]"
          />
        </div>
        <div className="sm:col-span-4">
          <label htmlFor="vocab-uz-input" className="sr-only">
            Uzbek meaning
          </label>
          <input
            id="vocab-uz-input"
            type="text"
            value={meaningUz}
            onChange={(e) => setMeaningUz(e.target.value)}
            placeholder="Uzbek meaning"
            className="focus-input w-full px-3 py-2 text-[13px]"
          />
        </div>
        <div className="sm:col-span-4 flex gap-2">
          <label htmlFor="vocab-note-input" className="sr-only">
            Optional note
          </label>
          <input
            id="vocab-note-input"
            type="text"
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            placeholder="Note (optional)"
            className="focus-input flex-1 min-w-0 px-3 py-2 text-[13px]"
          />
          <button
            type="submit"
            disabled={submitting}
            className="focus-btn-primary px-3.5 py-2 text-[13px] shrink-0"
          >
            {submitting ? "..." : "Add"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-[12px] text-error">
          {error}
        </p>
      )}

      {/* Search saved words */}
      <div className="relative">
        <span className="material-symbols-outlined text-outline text-[18px] absolute left-3 top-1/2 -translate-y-1/2">
          search
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved vocabulary..."
          aria-label="Search saved vocabulary"
          className="focus-input w-full pl-9 pr-3 py-2 text-[13px]"
        />
      </div>

      {/* Word List */}
      {entries.length === 0 ? (
        <p className="text-[13px] text-on-surface-variant py-4 text-center">
          {search.trim()
            ? "No vocabulary matches your search."
            : "Save unfamiliar words here — they automatically appear in My Vocabulary."}
        </p>
      ) : (
        <div className="divide-y divide-border-subtle">
          {entries.map((item) => (
            <div key={item.id} className="py-3 first:pt-1 last:pb-0">
              {editingId === item.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={editWord}
                    onChange={(e) => setEditWord(e.target.value)}
                    className="focus-input sm:col-span-4 px-2.5 py-1.5 text-[13px]"
                    aria-label="Edit English word"
                  />
                  <input
                    type="text"
                    value={editMeaning}
                    onChange={(e) => setEditMeaning(e.target.value)}
                    className="focus-input sm:col-span-4 px-2.5 py-1.5 text-[13px]"
                    aria-label="Edit Uzbek meaning"
                  />
                  <div className="sm:col-span-4 flex gap-1.5">
                    <input
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Note"
                      className="focus-input flex-1 min-w-0 px-2.5 py-1.5 text-[13px]"
                      aria-label="Edit personal note"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(item.id)}
                      className="focus-btn-primary px-2.5 py-1 text-[12px]"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="focus-btn-secondary px-2 py-1 text-[12px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="text-[14px] font-semibold text-on-surface">
                        {item.word}
                      </span>
                      <span className="text-[13px] text-primary font-medium">
                        {item.meaningUz}
                      </span>
                    </div>
                    {item.personalNote && (
                      <p className="text-[12px] text-on-surface-variant mt-0.5">
                        {item.personalNote}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label={`Edit ${item.word}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        edit
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      aria-label={`Delete ${item.word}`}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/40"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
