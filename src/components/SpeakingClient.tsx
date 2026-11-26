"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  formatDuration,
  formatRelativeTimestamp,
  getUploadedAssetUrl,
} from "@/lib/format";
import { SPEAKING_PROMPTS, type SpeakingPrompt } from "@/lib/prompts";
import type { AiStatusInfo, SpeakingSession } from "@/lib/types";

const IELTS_PARTS = ["Part 1", "Part 2", "Part 3"] as const;
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const IDLE_WAVEFORM = [
  14, 22, 18, 30, 44, 28, 62, 78, 52, 92, 68, 42, 76, 54, 32, 46, 26, 20, 14,
  16, 12, 14, 12, 12,
];

function formatTimerClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function SpeakingClient() {
  const [examType, setExamType] = useState<"ielts" | "cefr">("ielts");
  const [levelOrPart, setLevelOrPart] = useState<string>("Part 1");
  const [promptIndex, setPromptIndex] = useState(0);
  const [followUpPrompt, setFollowUpPrompt] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);

  const [aiStatus, setAiStatus] = useState<AiStatusInfo | null>(null);
  const [sessions, setSessions] = useState<SpeakingSession[]>([]);
  const [activeSession, setActiveSession] = useState<SpeakingSession | null>(
    null
  );

  // Audio recording states
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "paused" | "recorded"
  >("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [waveBars, setWaveBars] = useState<number[]>(IDLE_WAVEFORM);

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<{
    type: "error" | "unconfigured";
    message: string;
    missingEnvVar?: string;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const availablePrompts = useMemo(
    () =>
      SPEAKING_PROMPTS.filter(
        (p) => p.examType === examType && p.levelOrPart === levelOrPart
      ),
    [examType, levelOrPart]
  );

  const selectedPrompt: SpeakingPrompt | undefined =
    availablePrompts[promptIndex % Math.max(1, availablePrompts.length)];

  const activeQuestionText = followUpPrompt ?? selectedPrompt?.question ?? "";

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/ai/status", { cache: "no-store" }),
      fetch("/api/speaking", { cache: "no-store" }),
    ])
      .then(async ([statusRes, histRes]) => {
        if (cancelled) return;
        if (statusRes.ok) {
          setAiStatus((await statusRes.json()) as AiStatusInfo);
        }
        if (histRes.ok) {
          const json = (await histRes.json()) as {
            sessions: SpeakingSession[];
          };
          setSessions(json.sessions ?? []);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup audio resources on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  const cleanupActiveRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {
        // ignore stop race
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopWaveformMonitor();
  };

  const handleSelectExamType = (next: "ielts" | "cefr") => {
    cleanupActiveRecording();
    resetRecording();
    setExamType(next);
    setLevelOrPart(next === "ielts" ? "Part 1" : "B1");
    setPromptIndex(0);
    setFollowUpPrompt(null);
    setConversationHistory([]);
  };

  const handleSelectLevelOrPart = (val: string) => {
    cleanupActiveRecording();
    resetRecording();
    setLevelOrPart(val);
    setPromptIndex(0);
    setFollowUpPrompt(null);
    setConversationHistory([]);
  };

  const stopWaveformMonitor = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setWaveBars(IDLE_WAVEFORM);
  };

  const startWaveformMonitor = (stream: MediaStream) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = ctx;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars: number[] = [];
        for (let i = 0; i < 24; i++) {
          const val = dataArray[i % dataArray.length] ?? 0;
          bars.push(Math.max(12, Math.min(96, Math.round((val / 255) * 96))));
        }
        setWaveBars(bars);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // Fallback to calm static wave
    }
  };

  const resetRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopWaveformMonitor();
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsedSeconds(0);
    setRecordingState("idle");
    setMicError(null);
    setSubmitNotice(null);
  };

  const startRecording = async () => {
    setMicError(null);
    setSubmitNotice(null);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setMicError(
        "Audio recording is not supported in this browser. Please use a modern browser with microphone support."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = preferredTypes.find((t) =>
        MediaRecorder.isTypeSupported(t)
      );

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopWaveformMonitor();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setRecordingState("recorded");
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      startWaveformMonitor(stream);
      setElapsedSeconds(0);
      setRecordingState("recording");

      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicError(
          "Microphone access was denied. Allow microphone permissions in your browser settings and try again."
        );
      } else if (name === "NotFoundError") {
        setMicError(
          "No microphone was detected on this device. Connect a microphone and try again."
        );
      } else {
        setMicError(
          "Unable to start microphone recording. Check your device audio settings."
        );
      }
    }
  };

  const pauseOrResumeRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recordingState === "recording" && recorder.state === "recording") {
      recorder.pause();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setRecordingState("paused");
    } else if (recordingState === "paused" && recorder.state === "paused") {
      recorder.resume();
      if (streamRef.current) {
        startWaveformMonitor(streamRef.current);
      }
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
      setRecordingState("recording");
    }
  };

  const handleDeleteSession = async (id: string) => {
    const res = await fetch(`/api/speaking/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession?.id === id) setActiveSession(null);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const handleSubmitRecording = async () => {
    if (!recordedBlob || !activeQuestionText) return;
    setSubmitting(true);
    setSubmitNotice(null);

    try {
      const formData = new FormData();
      const ext = recordedBlob.type.includes("mp4")
        ? "m4a"
        : recordedBlob.type.includes("ogg")
        ? "ogg"
        : "webm";
      formData.append("audio", recordedBlob, `speaking-response.${ext}`);
      formData.append("examType", examType);
      formData.append("levelOrPart", levelOrPart);
      formData.append("promptQuestion", activeQuestionText);
      formData.append("durationSeconds", String(elapsedSeconds));
      if (conversationHistory.length > 0) {
        formData.append(
          "conversationContext",
          conversationHistory.join("\n---\n")
        );
      }

      const res = await fetch("/api/speaking", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (json.session) {
        const saved = json.session as SpeakingSession;
        setSessions((prev) => [saved, ...prev]);
        setActiveSession(saved);
        if (saved.transcript) {
          setConversationHistory((prev) => [
            ...prev,
            `Examiner: ${activeQuestionText}\nCandidate: ${saved.transcript}`,
          ]);
        }
      }

      if (res.status === 503 && json.code === "AI_NOT_CONFIGURED") {
        setSubmitNotice({
          type: "unconfigured",
          message: json.error,
          missingEnvVar: json.missingEnvVar,
        });
        return;
      }

      if (!res.ok) {
        setSubmitNotice({
          type: "error",
          message: json.error ?? "AI speaking assessment failed.",
        });
      }
    } catch {
      setSubmitNotice({
        type: "error",
        message: "Network error while sending your audio recording.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueWithFollowUp = (question: string) => {
    setFollowUpPrompt(question);
    resetRecording();
    setActiveSession(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] md:text-[28px] leading-[32px] md:leading-[36px] font-semibold tracking-[-0.02em] text-on-surface">
            Speaking
          </h1>
          <p className="text-[14px] text-on-surface-variant mt-1">
            Structured IELTS and CEFR audio speaking practice with pronunciation and language assessment.
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
              ? `Audio AI Ready (${aiStatus.provider})`
              : "Configure AI Key in Settings"}
          </Link>
        )}
      </section>

      {/* Exam & Level Selector */}
      <section className="focus-card p-4 md:p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-surface-container p-1">
            <button
              type="button"
              onClick={() => handleSelectExamType("ielts")}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                examType === "ielts"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              IELTS Speaking
            </button>
            <button
              type="button"
              onClick={() => handleSelectExamType("cefr")}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                examType === "cefr"
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              CEFR Speaking
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(examType === "ielts" ? IELTS_PARTS : CEFR_LEVELS).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleSelectLevelOrPart(item)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                  levelOrPart === item
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant hover:bg-tertiary-fixed"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Examiner Prompt + Recorder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Prompt & Audio Recorder (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Examiner Prompt Card */}
          <section className="focus-card p-5 md:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-primary text-[12px] font-semibold">
                  {examType === "ielts" ? `IELTS ${levelOrPart}` : `CEFR ${levelOrPart}`}
                </span>
                {followUpPrompt && (
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[12px] font-medium">
                    Examiner Follow-up
                  </span>
                )}
              </div>

              {availablePrompts.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setFollowUpPrompt(null);
                    setPromptIndex((i) => i + 1);
                    resetRecording();
                  }}
                  className="text-[12px] font-medium text-primary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    refresh
                  </span>
                  Another question
                </button>
              )}
            </div>

            <div>
              {selectedPrompt && !followUpPrompt && (
                <p className="text-[12px] font-medium text-outline uppercase tracking-wide mb-1.5">
                  {selectedPrompt.title}
                </p>
              )}
              <p className="text-[17px] leading-[27px] font-medium text-on-surface">
                {activeQuestionText}
              </p>
            </div>

            {selectedPrompt?.cueCardPoints && !followUpPrompt && (
              <div className="p-4 rounded-xl bg-surface-container-low border border-border-subtle">
                <p className="text-[12px] font-semibold text-on-surface-variant mb-2">
                  You should say:
                </p>
                <ul className="space-y-1.5 text-[14px] text-on-surface list-disc pl-5">
                  {selectedPrompt.cueCardPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedPrompt && (
              <p className="text-[12px] text-on-surface-variant">
                {selectedPrompt.guidance}
              </p>
            )}
          </section>

          {/* Microphone Recording Studio Card */}
          <section className="focus-card p-5 md:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-on-surface">
                Your Audio Response
              </h2>
              <span className="text-[13px] font-mono font-medium text-primary">
                {formatDuration(elapsedSeconds)}
                {selectedPrompt
                  ? ` / ~${formatDuration(selectedPrompt.targetDurationSeconds)}`
                  : ""}
              </span>
            </div>

            {micError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-error-container text-on-error-container text-[13px] flex items-start gap-2"
              >
                <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">
                  mic_off
                </span>
                <span>{micError}</span>
              </div>
            )}

            {/* Audio Waveform + Duration Bar (Matches Speaking Reference) */}
            <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-surface-container-low border border-border-subtle">
              <div
                aria-hidden="true"
                className="flex-1 flex items-center gap-[3px] h-9 overflow-hidden"
              >
                {waveBars.map((heightPct, idx) => (
                  <span
                    key={idx}
                    className={`flex-1 max-w-[6px] rounded-full transition-all duration-100 ${
                      recordingState === "recording"
                        ? "bg-primary"
                        : idx < 11
                        ? "bg-primary/65"
                        : "bg-border-strong"
                    }`}
                    style={{ height: `${Math.max(14, heightPct)}%` }}
                  />
                ))}
              </div>
              <span className="text-[12px] font-mono font-medium text-on-surface-variant shrink-0">
                {formatTimerClock(elapsedSeconds)} /{" "}
                {formatTimerClock(selectedPrompt?.targetDurationSeconds ?? 120)}
              </span>
            </div>

            {/* Recording State Display */}
            <div className="p-5 rounded-xl bg-surface-container-low/80 border border-border-subtle flex flex-col items-center justify-center gap-4 text-center">
              {recordingState === "idle" && (
                <>
                  <button
                    type="button"
                    onClick={startRecording}
                    className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center hover:bg-primary-container active:scale-95 transition-all shadow-[0_4px_16px_rgba(66,101,87,0.2)]"
                    aria-label="Start microphone recording"
                  >
                    <span className="material-symbols-outlined text-[30px]">
                      mic
                    </span>
                  </button>
                  <div>
                    <p className="text-[14px] font-medium text-on-surface">
                      Tap to start speaking
                    </p>
                    <p className="text-[12px] text-on-surface-variant mt-0.5">
                      Your original audio is preserved for acoustic pronunciation analysis.
                    </p>
                  </div>
                </>
              )}

              {(recordingState === "recording" ||
                recordingState === "paused") && (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        recordingState === "recording"
                          ? "bg-error animate-pulse"
                          : "bg-outline"
                      }`}
                    />
                    <span className="text-[14px] font-semibold text-on-surface">
                      {recordingState === "recording"
                        ? "Recording in progress..."
                        : "Recording paused"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={pauseOrResumeRecording}
                      className="focus-btn-secondary px-4 py-2.5 text-[13px] flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {recordingState === "recording" ? "pause" : "play_arrow"}
                      </span>
                      {recordingState === "recording" ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="focus-btn-primary px-5 py-2.5 text-[13px] flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        stop
                      </span>
                      Finish Recording
                    </button>
                  </div>
                </>
              )}

              {recordingState === "recorded" && recordedUrl && (
                <div className="w-full flex flex-col gap-4">
                  <div className="flex items-center justify-between text-left">
                    <span className="text-[13px] font-medium text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">
                        check_circle
                      </span>
                      Recording ready ({formatDuration(elapsedSeconds)})
                    </span>
                    <button
                      type="button"
                      onClick={resetRecording}
                      className="text-[12px] font-medium text-on-surface-variant hover:text-on-surface underline"
                    >
                      Record again
                    </button>
                  </div>

                  <audio
                    controls
                    src={recordedUrl}
                    className="w-full h-10"
                    aria-label="Preview your recorded answer"
                  />

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitRecording}
                      disabled={submitting}
                      className="focus-btn-primary px-5 py-2.5 text-[13px] flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {submitting ? "progress_activity" : "analytics"}
                      </span>
                      {submitting
                        ? "Analyzing audio..."
                        : "Submit for AI Assessment"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {submitNotice && (
              <div
                role="status"
                className={`p-4 rounded-xl text-[13px] flex flex-col gap-1.5 ${
                  submitNotice.type === "unconfigured"
                    ? "bg-surface-container border border-border-subtle text-on-surface"
                    : "bg-error-container text-on-error-container"
                }`}
              >
                <p className="font-semibold">
                  {submitNotice.type === "unconfigured"
                    ? "Recording Saved — Live AI Assessment Requires Server Key"
                    : "Evaluation Could Not Be Completed"}
                </p>
                <p className="text-[12px] leading-5 opacity-90">
                  {submitNotice.message}
                </p>
                {submitNotice.type === "unconfigured" && (
                  <p className="text-[12px] text-on-surface-variant mt-1">
                    Your audio recording was saved in Session History below so you can replay it anytime. No synthetic or fake scores were generated.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Right: Assessment Results & History (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5 min-w-0">
          {/* Active Evaluation Report */}
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
                  {activeSession.examType.toUpperCase()} ·{" "}
                  {activeSession.levelOrPart}
                </span>
              </div>

              <p className="text-[11px] text-outline bg-surface-container-low px-3 py-2 rounded-lg">
                {activeSession.assessment.disclaimer}
              </p>

              {/* Transcript */}
              <div>
                <h3 className="text-[13px] font-semibold text-on-surface mb-1">
                  What You Said (Transcript)
                </h3>
                <p className="text-[13px] text-on-surface-variant leading-6 bg-surface-container-low p-3 rounded-xl">
                  {activeSession.assessment.transcript || "No speech detected."}
                </p>
              </div>

              {/* Acoustic Pronunciation Analysis */}
              {activeSession.assessment.pronunciationAnalysis && (
                <div>
                  <h3 className="text-[13px] font-semibold text-on-surface mb-1">
                    Audio Pronunciation Analysis
                  </h3>
                  <p className="text-[13px] text-on-surface-variant leading-6">
                    {activeSession.assessment.pronunciationAnalysis}
                  </p>
                </div>
              )}

              {/* Criterion Breakdown */}
              <div className="space-y-2.5">
                <h3 className="text-[13px] font-semibold text-on-surface">
                  Criteria Breakdown
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

              {/* Mistakes */}
              {activeSession.assessment.mistakes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[13px] font-semibold text-on-surface">
                    Key Corrections
                  </h3>
                  {activeSession.assessment.mistakes.map((m, idx) => (
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

              {/* Improvements */}
              {activeSession.assessment.improvements.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-semibold text-on-surface mb-1.5">
                    Suggestions for Improvement
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-[13px] text-on-surface-variant">
                    {activeSession.assessment.improvements.map((imp, idx) => (
                      <li key={idx}>{imp}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Follow-up Prompt */}
              {activeSession.assessment.followUpQuestion && (
                <div className="pt-3 border-t border-border-subtle flex flex-col gap-2">
                  <p className="text-[12px] font-semibold text-on-surface">
                    Examiner Follow-up Question:
                  </p>
                  <p className="text-[13px] text-on-surface-variant italic">
                    &ldquo;{activeSession.assessment.followUpQuestion}&rdquo;
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleContinueWithFollowUp(
                        activeSession.assessment!.followUpQuestion!
                      )
                    }
                    className="focus-btn-primary px-4 py-2 text-[12px] self-start"
                  >
                    Answer Follow-up
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="focus-card p-5 flex flex-col gap-3">
              <h2 className="text-[16px] font-semibold text-on-surface">
                Assessment Rubric
              </h2>
              <p className="text-[13px] text-on-surface-variant leading-6">
                {examType === "ielts"
                  ? "IELTS Speaking answers are assessed from your audio recording across Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, and Pronunciation."
                  : "CEFR Speaking answers are evaluated from your audio recording against Grammar, Vocabulary, Fluency, Pronunciation, Coherence, and Communicative Effectiveness."}
              </p>
              <p className="text-[12px] text-outline">
                All AI scores are clearly marked as practice estimates for self-study.
              </p>
            </section>
          )}

          {/* Session History */}
          <section className="focus-card p-5 flex flex-col gap-3">
            <h2 className="text-[15px] font-semibold text-on-surface">
              Recent Speaking Recordings ({sessions.length})
            </h2>
            {sessions.length === 0 ? (
              <p className="text-[13px] text-on-surface-variant">
                Your recorded speaking sessions will appear here for review and playback.
              </p>
            ) : (
              <div className="space-y-3">
                {sessions.slice(0, 6).map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl border border-border-subtle bg-surface-container-low/50 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-primary">
                        {s.examType.toUpperCase()} · {s.levelOrPart}
                      </span>
                      <span className="text-[11px] text-outline flex items-center gap-1.5">
                        <span>
                          {formatDuration(s.durationSeconds)} ·{" "}
                          {formatRelativeTimestamp(s.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s.id)}
                          aria-label="Delete speaking session"
                          className="w-6 h-6 rounded-md inline-flex items-center justify-center text-outline hover:text-error hover:bg-error-container/40"
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            delete
                          </span>
                        </button>
                      </span>
                    </div>
                    <p className="text-[12px] text-on-surface line-clamp-2">
                      {s.promptQuestion}
                    </p>
                    {s.audioPath && (
                      <audio
                        controls
                        src={getUploadedAssetUrl(s.audioPath)}
                        className="w-full h-8"
                      />
                    )}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-on-surface-variant">
                        {s.assessment
                          ? `Estimate: ${s.assessment.estimatedOverall}`
                          : s.status === "ai_unconfigured"
                          ? "Saved (awaiting AI key)"
                          : "Recorded"}
                      </span>
                      {s.assessment && (
                        <button
                          type="button"
                          onClick={() => setActiveSession(s)}
                          className="text-primary font-medium hover:underline"
                        >
                          View feedback
                        </button>
                      )}
                    </div>
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
