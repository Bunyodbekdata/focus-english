"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatRelativeTimestamp } from "@/lib/format";
import { WRITING_PROMPTS, type WritingPrompt } from "@/lib/prompts";
import type { AiStatusInfo, WritingSession } from "@/lib/types";

type ExamMode = "ielts_academic" | "ielts_general" | "cefr";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function WritingClient() {
  const [examType, setExamType] = useState<ExamMode>("ielts_academic");
  const [levelOrTask, setLevelOrTask] = useState<string>("Task 2");
  const [customPromptMode, setCustomPromptMode] = useState(false);
  const [customPromptText, setCustomPromptText] = useState("");
  const [answerText, setAnswerText] = useState("");

  const [aiStatus, setAiStatus] = useState<AiStatusInfo | null>(null);
  const [sessions, setSessions] = useState<WritingSession[]>([]);
  const [activeSession, setActiveSession] = useState<WritingSession | null>(
    null
  );

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    type: "error" | "unconfigured";
    message: string;
  } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const applyFormat = (prefix: string, suffix = "") => {
    const el = editorRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = answerText.slice(start, end);
    const updated =
      answerText.slice(0, start) +
      prefix +
      selected +
      suffix +
      answerText.slice(end);
    setAnswerText(updated);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + prefix.length + selected.length + suffix.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const activePrompt: WritingPrompt | undefined = useMemo(
    () =>
      WRITING_PROMPTS.find(
        (p) => p.examType === examType && p.levelOrTask === levelOrTask
      ),
    [examType, levelOrTask]
  );

  const wordCount = useMemo(() => countWords(answerText), [answerText]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/ai/status", { cache: "no-store" }),
      fetch("/api/writing", { cache: "no-store" }),
    ])
      .then(async ([statusRes, histRes]) => {
        if (cancelled) return;
        if (statusRes.ok) {
          setAiStatus((await statusRes.json()) as AiStatusInfo);
        }
        if (histRes.ok) {
          const json = (await histRes.json()) as { sessions: WritingSession[] };
          setSessions(json.sessions ?? []);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleExamModeChange = (next: ExamMode) => {
    setExamType(next);
    setLevelOrTask(next === "cefr" ? "B1" : "Task 2");
    setCustomPromptMode(false);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const promptText = customPromptMode
      ? customPromptText.trim()
      : activePrompt?.prompt ?? "";
    const promptTitle = customPromptMode
      ? "Custom Writing Prompt"
      : activePrompt?.title ?? `${examType} ${levelOrTask}`;

    if (!promptText) {
      setNotice({
        type: "error",
        message: "Please enter a writing prompt before submitting.",
      });
      return;
    }

    if (answerText.trim().length < 20) {
      setNotice({
        type: "error",
        message: "Write a bit more before requesting evaluation (at least 20 characters).",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/writing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examType,
          levelOrTask,
          promptTitle,
          promptText,
          answerText: answerText.trim(),
        }),
      });
      const json = await res.json();

      if (json.session) {
        const saved = json.session as WritingSession;
        setSessions((prev) => [saved, ...prev]);
        setActiveSession(saved);
      }

      if (res.status === 503 && json.code === "AI_NOT_CONFIGURED") {
        setNotice({
          type: "unconfigured",
          message: json.error,
        });
        return;
      }

      if (!res.ok) {
        setNotice({
          type: "error",
          message: json.error ?? "Unable to evaluate writing.",
        });
      }
    } catch {
      setNotice({
        type: "error",
        message: "Network error while submitting your writing.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPastSession = (session: WritingSession) => {
    setActiveSession(session);
    setExamType(session.examType);
    setLevelOrTask(session.levelOrTask);
    setAnswerText(session.answerText);
    setNotice(null);
  };

  const handleDeleteSession = async (id: string) => {
    const res = await fetch(`/api/writing/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession?.id === id) setActiveSession(null);
    }
  };

  const minTargetWords = activePrompt?.minWords ?? 150;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] md:text-[28px] leading-[32px] md:leading-[36px] font-semibold tracking-[-0.02em] text-on-surface">
            Writing
          </h1>
          <p className="text-[14px] text-on-surface-variant mt-1">
            Practice IELTS Academic, IELTS General Training, and CEFR A1–C2 tasks with diagnostic feedback.
          </p>
        </div>

        {aiStatus && (
          <Link
            href="/settings"
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-medium border transition-colors self-start sm:self-auto ${
              aiStatus.configured
                ? "bg-surface-container-lowest border-border-subtle text-primary"
                : "bg-surface-container border-border-subtle text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {aiStatus.configured ? "check_circle" : "tune"}
            </span>
            {aiStatus.configured
              ? `Writing AI Ready (${aiStatus.provider})`
              : "Configure AI Key in Settings"}
          </Link>
        )}
      </section>

      {/* Mode & Task Selector (Matches Writing Reference) */}
      <section className="focus-card p-4 md:p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-surface-container p-1 gap-0.5">
            <button
              type="button"
              onClick={() => {
                if (examType === "cefr") handleExamModeChange("ielts_academic");
              }}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                examType !== "cefr"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              IELTS Writing
            </button>
            <button
              type="button"
              onClick={() => handleExamModeChange("cefr")}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                examType === "cefr"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              CEFR Writing
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {examType === "cefr" ? (
              CEFR_LEVELS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setLevelOrTask(item);
                    setCustomPromptMode(false);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                    levelOrTask === item
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface-variant hover:bg-tertiary-fixed"
                  }`}
                >
                  {item}
                </button>
              ))
            ) : (
              <>
                {(
                  [
                    {
                      mode: "ielts_academic" as const,
                      task: "Task 1",
                      label: "Academic Task 1",
                    },
                    {
                      mode: "ielts_general" as const,
                      task: "Task 1",
                      label: "General Task 1",
                    },
                    {
                      mode: "ielts_academic" as const,
                      task: "Task 2",
                      label: "Academic Task 2",
                    },
                    {
                      mode: "ielts_general" as const,
                      task: "Task 2",
                      label: "General Task 2",
                    },
                  ] as const
                ).map((opt) => {
                  const active =
                    examType === opt.mode && levelOrTask === opt.task;
                  return (
                    <button
                      key={`${opt.mode}-${opt.task}`}
                      type="button"
                      onClick={() => {
                        setExamType(opt.mode);
                        setLevelOrTask(opt.task);
                        setCustomPromptMode(false);
                        setNotice(null);
                      }}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                        active
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container text-on-surface-variant hover:bg-tertiary-fixed"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Writing Workspace + Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Task + Spacious Editor (7 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 flex flex-col gap-5 min-w-0"
        >
          {/* Task Prompt Card */}
          <section className="focus-card p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-primary text-[12px] font-semibold">
                  {levelOrTask}
                </span>
                {activePrompt && !customPromptMode && (
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[12px] font-medium">
                    {activePrompt.taskFormat}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setCustomPromptMode((v) => !v)}
                className="text-[12px] font-medium text-primary hover:underline"
              >
                {customPromptMode ? "Use curated prompt" : "Use my own prompt"}
              </button>
            </div>

            {customPromptMode ? (
              <div>
                <label
                  htmlFor="custom-writing-prompt"
                  className="block text-[12px] font-medium text-on-surface-variant mb-1"
                >
                  Your Writing Task Prompt
                </label>
                <textarea
                  id="custom-writing-prompt"
                  rows={3}
                  value={customPromptText}
                  onChange={(e) => setCustomPromptText(e.target.value)}
                  placeholder="Paste any IELTS or CEFR essay/letter question you want to practice..."
                  className="focus-input w-full p-3 text-[14px] leading-6"
                />
              </div>
            ) : activePrompt ? (
              <>
                <h2 className="text-[16px] font-semibold text-on-surface">
                  {activePrompt.title}
                </h2>
                <p className="text-[14px] leading-[23px] text-on-surface-variant whitespace-pre-line">
                  {activePrompt.prompt}
                </p>
                <p className="text-[12px] text-outline">
                  Minimum recommended length: {activePrompt.minWords} words ·
                  Suggested time: {activePrompt.recommendedMinutes} minutes
                </p>
              </>
            ) : null}
          </section>

          {/* Clean Writing Editor */}
          <section className="focus-card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-border-subtle">
              <div className="flex items-center gap-1">
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
                  onClick={() => applyFormat("\n- ")}
                  title="Bullet list"
                  className="px-2 py-1 rounded-md text-[12px] text-on-surface-variant hover:bg-surface-container transition-colors flex items-center"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    format_list_bulleted
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-3 text-[12px]">
                <span
                  className={`font-medium px-2.5 py-0.5 rounded-full ${
                    wordCount >= minTargetWords
                      ? "bg-tertiary-fixed text-primary"
                      : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {wordCount} / {minTargetWords} words
                </span>
              </div>
            </div>

            <label htmlFor="writing-answer-editor" className="sr-only">
              Your Writing Response
            </label>
            <textarea
              ref={editorRef}
              id="writing-answer-editor"
              rows={14}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Write your essay, letter, email, or report here in clear paragraphs..."
              className="focus-input w-full p-4 text-[15px] leading-[1.75] resize-y min-h-[300px]"
            />

            {notice && (
              <div
                role="status"
                className={`p-3.5 rounded-xl text-[13px] ${
                  notice.type === "unconfigured"
                    ? "bg-surface-container border border-border-subtle text-on-surface"
                    : "bg-error-container text-on-error-container"
                }`}
              >
                <p className="font-semibold">
                  {notice.type === "unconfigured"
                    ? "Draft Saved — Live AI Assessment Requires Server Key"
                    : "Submission Issue"}
                </p>
                <p className="text-[12px] mt-0.5 leading-5 opacity-90">
                  {notice.message}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setAnswerText("");
                  setNotice(null);
                }}
                disabled={!answerText}
                className="focus-btn-secondary px-3.5 py-2 text-[13px]"
              >
                Clear Editor
              </button>

              <button
                type="submit"
                disabled={submitting || !answerText.trim()}
                className="focus-btn-primary px-5 py-2.5 text-[14px] flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {submitting ? "progress_activity" : "send"}
                </span>
                {submitting ? "Evaluating..." : "Submit for Evaluation"}
              </button>
            </div>
          </section>
        </form>

        {/* Right: Structured AI Feedback & Past Submissions (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5 min-w-0">
          {activeSession?.assessment ? (
            <section className="focus-card p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-subtle">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-outline">
                    Practice Estimate
                  </span>
                  <h2 className="text-[22px] font-semibold text-primary mt-0.5">
                    {activeSession.assessment.estimatedOverall}
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-surface-container text-[12px] font-medium text-on-surface-variant">
                  {activeSession.wordCount} words
                </span>
              </div>

              <p className="text-[11px] text-outline bg-surface-container-low px-3 py-2 rounded-lg">
                {activeSession.assessment.disclaimer}
              </p>

              {activeSession.assessment.summary && (
                <p className="text-[13px] text-on-surface leading-6">
                  {activeSession.assessment.summary}
                </p>
              )}

              {/* Criteria */}
              <div className="space-y-2.5">
                <h3 className="text-[13px] font-semibold text-on-surface">
                  Criteria Scores
                </h3>
                {activeSession.assessment.criteria.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-border-subtle bg-surface-container-low/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-on-surface">
                        {c.name}
                      </span>
                      <span className="text-[12px] font-semibold text-primary px-2 py-0.5 rounded-full bg-tertiary-fixed">
                        {c.score}
                      </span>
                    </div>
                    <p className="text-[12px] text-on-surface-variant mt-1 leading-5">
                      {c.feedback}
                    </p>
                  </div>
                ))}
              </div>

              {/* Grammar Mistakes */}
              {activeSession.assessment.grammarMistakes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[13px] font-semibold text-on-surface">
                    Grammar Mistakes
                  </h3>
                  {activeSession.assessment.grammarMistakes.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-border-subtle text-[12px] space-y-1"
                    >
                      <p className="text-error line-through">{m.original}</p>
                      <p className="text-primary font-medium">{m.correction}</p>
                      <p className="text-on-surface-variant">{m.explanation}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Vocabulary Weaknesses */}
              {activeSession.assessment.vocabularyWeaknesses.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[13px] font-semibold text-on-surface">
                    Vocabulary Improvements
                  </h3>
                  {activeSession.assessment.vocabularyWeaknesses.map(
                    (v, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-border-subtle text-[12px] space-y-1"
                      >
                        <p className="text-on-surface">
                          <span className="text-outline">Original:</span>{" "}
                          {v.phrase}
                        </p>
                        <p className="text-primary font-medium">
                          Better: {v.suggestion}
                        </p>
                        <p className="text-on-surface-variant">{v.reason}</p>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Structural Issues */}
              {activeSession.assessment.structuralIssues.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold text-on-surface mb-1.5">
                    Structural Notes
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-[13px] text-on-surface-variant">
                    {activeSession.assessment.structuralIssues.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actionable Improvements */}
              {activeSession.assessment.improvements.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold text-on-surface mb-1.5">
                    How to Improve Next Draft
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-[13px] text-on-surface-variant">
                    {activeSession.assessment.improvements.map((imp, idx) => (
                      <li key={idx}>{imp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ) : (
            <section className="focus-card p-5 flex flex-col gap-3">
              <h2 className="text-[16px] font-semibold text-on-surface">
                Assessment Focus
              </h2>
              <p className="text-[13px] text-on-surface-variant leading-6">
                {examType === "cefr"
                  ? "CEFR writing feedback diagnoses Grammar, Vocabulary, Sentence Construction, Coherence, Organization, and Task Completion so you understand how to revise your own work."
                  : "IELTS writing feedback follows Task Achievement / Task Response, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy."}
              </p>
              <p className="text-[12px] text-outline">
                Feedback explains the underlying issues instead of simply rewriting your essay.
              </p>
            </section>
          )}

          {/* Saved Submissions */}
          <section className="focus-card p-5 flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-on-surface">
              Saved Drafts & Evaluations ({sessions.length})
            </h2>
            {sessions.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant">
                Submitted writing drafts and evaluations are saved here automatically.
              </p>
            ) : (
              <div className="divide-y divide-border-subtle">
                {sessions.slice(0, 6).map((s) => (
                  <div
                    key={s.id}
                    className="py-3 first:pt-1 last:pb-0 flex items-start justify-between gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenPastSession(s)}
                      className="flex-1 min-w-0 text-left hover:bg-surface-container-low/50 rounded-lg px-2 py-0.5 -mx-2 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold text-on-surface truncate">
                          {s.promptTitle}
                        </span>
                        <span className="text-[11px] font-medium text-primary shrink-0">
                          {s.assessment
                            ? s.assessment.estimatedOverall
                            : `${s.wordCount}w`}
                        </span>
                      </div>
                      <p className="text-[11px] text-outline mt-0.5">
                        {s.levelOrTask} · {s.wordCount} words ·{" "}
                        {formatRelativeTimestamp(s.updatedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(s.id)}
                      aria-label={`Delete draft ${s.promptTitle}`}
                      className="w-7 h-7 rounded-md shrink-0 inline-flex items-center justify-center text-outline hover:text-error hover:bg-error-container/40"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        delete
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
