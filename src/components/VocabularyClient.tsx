"use client";

import React, { useCallback, useEffect, useState } from "react";
import { formatRelativeTimestamp } from "@/lib/format";
import type { VocabularyEntry } from "@/lib/types";

const SOURCE_FILTERS = [
  { key: "all", label: "All sources" },
  { key: "youtube", label: "Listening" },
  { key: "reading", label: "Reading" },
  { key: "pdf", label: "PDFs" },
  { key: "manual", label: "Added manually" },
] as const;

function sourceBadgeLabel(sourceType: VocabularyEntry["sourceType"]): string {
  switch (sourceType) {
    case "youtube":
      return "Listening";
    case "reading":
      return "Reading";
    case "pdf":
      return "PDF";
    default:
      return "Personal";
  }
}

export function VocabularyClient() {
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Add word form
  const [showAddForm, setShowAddForm] = useState(false);
  const [word, setWord] = useState("");
  const [meaningUz, setMeaningUz] = useState("");
  const [example, setExample] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit entry state
  const [editingEntry, setEditingEntry] = useState<VocabularyEntry | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editMeaningUz, setEditMeaningUz] = useState("");
  const [editExample, setEditExample] = useState("");
  const [editNote, setEditNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadVocabulary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (sourceFilter !== "all") params.set("sourceType", sourceFilter);
      const res = await fetch(`/api/vocabulary?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as { entries: VocabularyEntry[] };
        setEntries(json.entries ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [query, sourceFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVocabulary();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadVocabulary]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!word.trim() || !meaningUz.trim()) {
      setFormError("Please enter both an English word and its Uzbek meaning.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.trim(),
          meaningUz: meaningUz.trim(),
          example: example.trim(),
          personalNote: personalNote.trim(),
          sourceType: "manual",
          sourceTitle: "Personal Vocabulary",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error ?? "Unable to add word.");
        return;
      }
      setWord("");
      setMeaningUz("");
      setExample("");
      setPersonalNote("");
      setShowAddForm(false);
      await loadVocabulary();
    } catch {
      setFormError("Network error while adding word.");
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (entry: VocabularyEntry) => {
    setEditingEntry(entry);
    setEditWord(entry.word);
    setEditMeaningUz(entry.meaningUz);
    setEditExample(entry.example);
    setEditNote(entry.personalNote);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editWord.trim() || !editMeaningUz.trim()) return;
    setUpdating(true);
    try {
      const res = await fetch(
        `/api/vocabulary/${encodeURIComponent(editingEntry.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            word: editWord.trim(),
            meaningUz: editMeaningUz.trim(),
            example: editExample.trim(),
            personalNote: editNote.trim(),
          }),
        }
      );
      if (res.ok) {
        setEditingEntry(null);
        await loadVocabulary();
      }
    } finally {
      setUpdating(false);
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
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] md:text-[28px] leading-[32px] md:leading-[36px] font-semibold tracking-[-0.02em] text-on-surface">
            My Vocabulary
          </h1>
          <p className="text-[14px] text-on-surface-variant mt-1">
            All English words and Uzbek meanings collected across Listening, Reading, and personal study.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="focus-btn-primary px-4 py-2.5 text-[13px] flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">
            {showAddForm ? "close" : "add"}
          </span>
          {showAddForm ? "Close Form" : "Add Word"}
        </button>
      </section>

      {/* Collapsible Add Word Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="focus-card p-5 flex flex-col gap-4"
        >
          <h2 className="text-[15px] font-semibold text-on-surface">
            New Vocabulary Entry
          </h2>
          {formError && (
            <p role="alert" className="text-[12px] text-error">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="central-vocab-word"
                className="block text-[12px] font-medium text-on-surface-variant mb-1"
              >
                English Word or Phrase *
              </label>
              <input
                id="central-vocab-word"
                type="text"
                required
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="e.g., resilience"
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>
            <div>
              <label
                htmlFor="central-vocab-uz"
                className="block text-[12px] font-medium text-on-surface-variant mb-1"
              >
                Uzbek Meaning *
              </label>
              <input
                id="central-vocab-uz"
                type="text"
                required
                value={meaningUz}
                onChange={(e) => setMeaningUz(e.target.value)}
                placeholder="e.g., chidamlilik, moslashuvchanlik"
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>
            <div>
              <label
                htmlFor="central-vocab-example"
                className="block text-[12px] font-medium text-on-surface-variant mb-1"
              >
                Example Sentence (optional)
              </label>
              <input
                id="central-vocab-example"
                type="text"
                value={example}
                onChange={(e) => setExample(e.target.value)}
                placeholder="Example in context"
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>
            <div>
              <label
                htmlFor="central-vocab-note"
                className="block text-[12px] font-medium text-on-surface-variant mb-1"
              >
                Personal Note (optional)
              </label>
              <input
                id="central-vocab-note"
                type="text"
                value={personalNote}
                onChange={(e) => setPersonalNote(e.target.value)}
                placeholder="Pronunciation cue, collocation, or reminder"
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="focus-btn-secondary px-4 py-2 text-[13px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="focus-btn-primary px-4 py-2 text-[13px]"
            >
              {saving ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </form>
      )}

      {/* Search & Source Filter Bar */}
      <section className="focus-card p-4 flex flex-col gap-3.5">
        <div className="relative">
          <span className="material-symbols-outlined text-outline text-[19px] absolute left-3.5 top-1/2 -translate-y-1/2">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by English word, Uzbek meaning, note, or source..."
            aria-label="Search vocabulary"
            className="focus-input w-full pl-10 pr-4 py-2 text-[14px]"
          />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {SOURCE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setSourceFilter(f.key)}
                className={`px-3 py-1 rounded-full text-[12px] font-medium transition-colors ${
                  sourceFilter === f.key
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-tertiary-fixed"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="text-[12px] text-outline">
            {entries.length} {entries.length === 1 ? "word" : "words"}
          </span>
        </div>
      </section>

      {/* Vocabulary List / Table */}
      <section className="focus-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-surface-container-low animate-pulse"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mx-auto mb-3 text-primary">
              <span className="material-symbols-outlined text-[24px]">
                library_books
              </span>
            </div>
            <p className="text-[15px] font-semibold text-on-surface">
              {query.trim() || sourceFilter !== "all"
                ? "No matching words found"
                : "Your vocabulary collection is empty"}
            </p>
            <p className="text-[13px] text-on-surface-variant mt-1 max-w-md mx-auto">
              Words you save while watching YouTube videos in Listening or reading passages and PDFs in Reading appear here automatically.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Clean Table (per DESIGN.md Data Tables & Lists) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-subtle text-[13px] font-medium text-outline">
                    <th className="py-3.5 px-5">English</th>
                    <th className="py-3.5 px-5">Uzbek Meaning</th>
                    <th className="py-3.5 px-5">Example & Note</th>
                    <th className="py-3.5 px-5">Source</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="py-3.5 px-5 align-top">
                        <span className="text-[14px] font-semibold text-on-surface">
                          {entry.word}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 align-top">
                        <span className="text-[14px] text-primary font-medium">
                          {entry.meaningUz}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 align-top max-w-sm">
                        {entry.example && (
                          <p className="text-[13px] text-on-surface italic">
                            &ldquo;{entry.example}&rdquo;
                          </p>
                        )}
                        {entry.personalNote && (
                          <p className="text-[12px] text-on-surface-variant mt-0.5">
                            {entry.personalNote}
                          </p>
                        )}
                        {!entry.example && !entry.personalNote && (
                          <span className="text-[12px] text-outline">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex self-start px-2 py-0.5 rounded-full bg-surface-container text-[11px] font-medium text-primary">
                            {sourceBadgeLabel(entry.sourceType)}
                          </span>
                          {entry.sourceTitle && (
                            <span className="text-[12px] text-on-surface-variant truncate max-w-[180px]">
                              {entry.sourceTitle}
                            </span>
                          )}
                          <span className="text-[11px] text-outline">
                            {formatRelativeTimestamp(entry.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(entry)}
                            aria-label={`Edit ${entry.word}`}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              edit
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            aria-label={`Delete ${entry.word}`}
                            className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/40"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Clean Stacked Cards (zero horizontal overflow) */}
            <div className="md:hidden divide-y divide-border-subtle">
              {entries.map((entry) => (
                <div key={entry.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-on-surface break-words">
                        {entry.word}
                      </p>
                      <p className="text-[14px] font-medium text-primary break-words">
                        {entry.meaningUz}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(entry)}
                        aria-label={`Edit ${entry.word}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          edit
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        aria-label={`Delete ${entry.word}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/40"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>

                  {entry.example && (
                    <p className="text-[13px] text-on-surface italic">
                      &ldquo;{entry.example}&rdquo;
                    </p>
                  )}
                  {entry.personalNote && (
                    <p className="text-[12px] text-on-surface-variant">
                      {entry.personalNote}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-outline">
                    <span className="truncate">
                      {sourceBadgeLabel(entry.sourceType)}
                      {entry.sourceTitle ? ` · ${entry.sourceTitle}` : ""}
                    </span>
                    <span className="shrink-0">
                      {formatRelativeTimestamp(entry.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Edit Modal */}
      {editingEntry && (
        <div
          className="fixed inset-0 z-50 focus-modal-backdrop flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Vocabulary Entry"
        >
          <form
            onSubmit={handleUpdate}
            className="focus-card-elevated w-full max-w-lg p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-on-surface">
                Edit Vocabulary Entry
              </h2>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                aria-label="Close edit modal"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                English Word
              </label>
              <input
                type="text"
                required
                value={editWord}
                onChange={(e) => setEditWord(e.target.value)}
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                Uzbek Meaning
              </label>
              <input
                type="text"
                required
                value={editMeaningUz}
                onChange={(e) => setEditMeaningUz(e.target.value)}
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                Example Sentence
              </label>
              <input
                type="text"
                value={editExample}
                onChange={(e) => setEditExample(e.target.value)}
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-on-surface-variant mb-1">
                Personal Note
              </label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="focus-input w-full px-3.5 py-2 text-[14px]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="focus-btn-secondary px-4 py-2 text-[13px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="focus-btn-primary px-4 py-2 text-[13px]"
              >
                {updating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
