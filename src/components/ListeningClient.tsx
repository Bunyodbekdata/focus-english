"use client";

import { useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { InlineVocabularyPanel } from "@/components/InlineVocabularyPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { formatDuration, formatRelativeTimestamp } from "@/lib/format";
import type { LearningMaterial } from "@/lib/types";
import { parseYouTubeUrl } from "@/lib/youtube";

interface YTPlayerInstance {
  destroy?: () => void;
  getCurrentTime?: () => number;
  getDuration?: () => number;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: {
              data: number;
              target: YTPlayerInstance;
            }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_ERROR_MESSAGES: Record<number, string> = {
  2: "The video ID appears invalid. Please check the YouTube link.",
  5: "This video encountered an HTML5 playback issue in your browser.",
  100: "This YouTube video was not found or has been marked private.",
  101: "The owner of this video has disabled playback on external websites.",
  150: "The owner of this video has disabled embedding or restricted its region.",
};

export function ListeningClient() {
  const searchParams = useSearchParams();
  const requestedMaterialId = searchParams.get("materialId");
  const requestedNoteId = searchParams.get("noteId");

  const [urlInput, setUrlInput] = useState("");
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const [history, setHistory] = useState<LearningMaterial[]>([]);
  const [activeMaterial, setActiveMaterial] =
    useState<LearningMaterial | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const activeMaterialRef = useRef<LearningMaterial | null>(null);

  useEffect(() => {
    activeMaterialRef.current = activeMaterial;
  }, [activeMaterial]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/materials?type=youtube", { cache: "no-store" })
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{ materials: LearningMaterial[] }>)
          : null
      )
      .then((json) => {
        if (cancelled || !json) return;
        const list = json.materials ?? [];
        setHistory(list);

        if (requestedMaterialId) {
          const found = list.find((m) => m.id === requestedMaterialId);
          if (found) {
            setActiveMaterial(found);
            setUrlInput(found.sourceUrl ?? "");
            return;
          }
        }

        if (!activeMaterialRef.current && list[0]) {
          setActiveMaterial(list[0]);
          setUrlInput(list[0].sourceUrl ?? "");
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [requestedMaterialId]);

  const syncProgress = useCallback(async (materialId: string) => {
    const player = playerRef.current;
    if (!player?.getCurrentTime || !player?.getDuration) return;
    const current = player.getCurrentTime();
    const duration = player.getDuration();
    if (!Number.isFinite(current) || !Number.isFinite(duration) || duration <= 0)
      return;

    setCurrentTimeSec(current);
    const percent = Math.min(100, Math.max(0, Math.round((current / duration) * 100)));

    try {
      const res = await fetch(`/api/materials/${encodeURIComponent(materialId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progressPercent: percent,
          lastPositionSeconds: Math.floor(current),
        }),
      });
      if (res.ok) {
        const { material } = (await res.json()) as {
          material: LearningMaterial;
        };
        setActiveMaterial((prev) =>
          prev && prev.id === material.id ? material : prev
        );
        setHistory((prev) =>
          prev.map((m) => (m.id === material.id ? material : m))
        );
      }
    } catch {
      // ignore transient sync error
    }
  }, []);

  // Mount Official YouTube IFrame Player whenever active videoId changes
  useEffect(() => {
    const videoId = activeMaterial?.videoId;
    const materialId = activeMaterial?.id;
    const startSec = activeMaterial?.lastPositionSeconds ?? 0;

    if (!videoId || !materialId || !playerHostRef.current) {
      return;
    }

    let cancelled = false;
    setPlayerError(null);

    const mountPlayer = () => {
      if (cancelled || !playerHostRef.current || !window.YT?.Player) return;

      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore cleanup
      }

      playerHostRef.current.innerHTML = "";
      const mountNode = document.createElement("div");
      mountNode.className = "w-full h-full";
      playerHostRef.current.appendChild(mountNode);

      playerRef.current = new window.YT.Player(mountNode, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: startSec > 3 ? startSec : 0,
        },
        events: {
          onReady: () => {
            setCurrentTimeSec(startSec);
          },
          onStateChange: (event) => {
            // 1 = PLAYING, 2 = PAUSED, 0 = ENDED
            if (event.data === 1) {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
              }
              progressIntervalRef.current = setInterval(() => {
                syncProgress(materialId);
              }, 8000);
            } else {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
              if (event.data === 2 || event.data === 0) {
                syncProgress(materialId);
              }
            }
          },
          onError: (event) => {
            const msg =
              YT_ERROR_MESSAGES[event.data] ??
              "This video cannot be played inside the embedded player due to YouTube restrictions.";
            setPlayerError(msg);
          },
        },
      });
    };

    if (window.YT?.Player) {
      mountPlayer();
    } else {
      const existingScript = document.getElementById("youtube-iframe-api");
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        mountPlayer();
      };
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "youtube-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
    // Re-initialize only when video switches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMaterial?.videoId, activeMaterial?.id, syncProgress]);

  const handleLoadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);
    setPlayerError(null);

    const parsed = parseYouTubeUrl(urlInput);
    if (!parsed) {
      setUrlError(
        "Enter a valid YouTube URL (youtube.com/watch, youtu.be, or youtube.com/shorts)."
      );
      return;
    }

    setLoadingVideo(true);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "youtube", url: urlInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setUrlError(json.error ?? "Unable to load this YouTube video.");
        return;
      }
      const material = json.material as LearningMaterial;
      setActiveMaterial(material);
      setUrlInput(material.sourceUrl ?? urlInput.trim());
      setHistory((prev) => [
        material,
        ...prev.filter((m) => m.id !== material.id),
      ]);
    } catch {
      setUrlError("Could not reach the server to load this video.");
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleSelectHistory = async (item: LearningMaterial) => {
    setUrlError(null);
    setPlayerError(null);
    setActiveMaterial(item);
    setUrlInput(item.sourceUrl ?? "");
    // Bump last_opened_at so Continue Learning stays fresh
    fetch(`/api/materials/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressPercent: item.progressPercent }),
    }).catch(() => {});
  };

  const handleDeleteHistory = async (id: string) => {
    const res = await fetch(`/api/materials/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const next = history.filter((m) => m.id !== id);
      setHistory(next);
      if (activeMaterial?.id === id) {
        setActiveMaterial(next[0] ?? null);
        setUrlInput(next[0]?.sourceUrl ?? "");
      }
    }
  };

  const getCurrentTimestampLabel = useCallback(() => {
    const sec = playerRef.current?.getCurrentTime?.() ?? currentTimeSec;
    return formatDuration(sec);
  }, [currentTimeSec]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <section className="flex flex-col gap-1">
        <h1 className="text-[24px] md:text-[28px] leading-[32px] md:leading-[36px] font-semibold tracking-[-0.02em] text-on-surface">
          Listening
        </h1>
        <p className="text-[14px] text-on-surface-variant">
          Study with your own YouTube videos — take notes and save vocabulary without feed distractions.
        </p>
      </section>

      {/* YouTube URL Loader Bar */}
      <section className="focus-card p-4">
        <form
          onSubmit={handleLoadVideo}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined text-outline text-[20px] absolute left-3.5 top-1/2 -translate-y-1/2">
              smart_display
            </span>
            <label htmlFor="youtube-url-input" className="sr-only">
              YouTube Video URL
            </label>
            <input
              id="youtube-url-input"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                if (urlError) setUrlError(null);
              }}
              placeholder="Paste a YouTube link (youtube.com/watch, youtu.be, or shorts)"
              className="focus-input w-full pl-10 pr-4 py-2.5 text-[14px]"
            />
          </div>
          <button
            type="submit"
            disabled={loadingVideo}
            className="focus-btn-primary px-5 py-2.5 text-[14px] shrink-0 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[19px]">
              {loadingVideo ? "progress_activity" : "play_circle"}
            </span>
            {loadingVideo ? "Loading..." : "Load Video"}
          </button>
        </form>

        {urlError && (
          <div
            role="alert"
            className="mt-3 px-3.5 py-2.5 rounded-lg bg-error-container text-on-error-container text-[13px] flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px] shrink-0">
              error
            </span>
            <span>{urlError}</span>
          </div>
        )}
      </section>

      {/* Studio 7:5 Layout on Desktop, Clean Vertical Stack on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Video + Vocabulary Column (7 cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col gap-6 min-w-0">
          {/* Embedded Video Player Card */}
          <section className="focus-card overflow-hidden">
            {activeMaterial?.videoId ? (
              <div>
                <div className="relative w-full aspect-video bg-inverse-surface">
                  <div
                    ref={playerHostRef}
                    className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
                  />
                  {playerError && (
                    <div className="absolute inset-0 bg-inverse-surface/95 text-inverse-on-surface flex flex-col items-center justify-center text-center p-6 gap-3">
                      <span className="material-symbols-outlined text-[36px] text-inverse-primary">
                        videocam_off
                      </span>
                      <p className="text-[15px] font-medium max-w-md">
                        {playerError}
                      </p>
                      <p className="text-[12px] text-inverse-on-surface/75 max-w-md">
                        Focus English respects YouTube creator and regional embedding settings. Please try another video that permits embedding.
                      </p>
                    </div>
                  )}
                </div>

                {/* Clean Video Metadata Strip */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border-subtle">
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-on-surface truncate">
                      {activeMaterial.title}
                    </h2>
                    <p className="text-[12px] text-outline mt-0.5">
                      Progress saved automatically · {activeMaterial.progressPercent}% watched
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${activeMaterial.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-medium text-on-surface-variant">
                      {activeMaterial.progressPercent}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center text-center p-6 bg-surface-container-low/60">
                <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mb-3 text-primary">
                  <span className="material-symbols-outlined text-[30px]">
                    headphones
                  </span>
                </div>
                <p className="text-[16px] font-semibold text-on-surface">
                  No video loaded yet
                </p>
                <p className="text-[13px] text-on-surface-variant max-w-sm mt-1">
                  Paste any embeddable YouTube lecture, podcast, or interview URL above to study here without distractions.
                </p>
              </div>
            )}
          </section>

          {/* Mobile-order Note: On mobile (<lg), show Notes directly under the video! */}
          <div className="lg:hidden">
            <NotesPanel
              materialId={activeMaterial?.id ?? null}
              materialType="youtube"
              materialTitle={activeMaterial?.title ?? "Listening"}
              initialNoteId={requestedNoteId}
              getTimestampLabel={
                activeMaterial ? getCurrentTimestampLabel : undefined
              }
            />
          </div>

          {/* Vocabulary Area Directly Under Video */}
          <InlineVocabularyPanel
            sourceMaterialId={activeMaterial?.id ?? null}
            sourceTitle={activeMaterial?.title ?? "Listening"}
            sourceType="youtube"
          />

          {/* User's Own Video History (Distraction-free, personal only) */}
          {history.length > 0 && (
            <section className="focus-card p-4 md:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-on-surface">
                  Your Study Videos
                </h2>
                <span className="text-[12px] text-outline">
                  {history.length} saved
                </span>
              </div>
              <div className="divide-y divide-border-subtle">
                {history.map((item) => {
                  const isActive = activeMaterial?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`py-2.5 flex items-center gap-3 ${
                        isActive ? "bg-surface-container-low/70 -mx-2 px-2 rounded-xl" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectHistory(item)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div className="w-14 h-10 rounded-lg overflow-hidden bg-surface-container shrink-0">
                          {item.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined text-[18px]">
                                play_arrow
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-on-surface truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-outline">
                            {item.progressPercent}% ·{" "}
                            {formatRelativeTimestamp(item.lastOpenedAt)}
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteHistory(item.id)}
                        aria-label={`Remove ${item.title} from history`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:text-error hover:bg-error-container/40 shrink-0"
                      >
                        <span className="material-symbols-outlined text-[17px]">
                          delete
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Desktop Notes Column (5 cols, right beside video) */}
        <div className="hidden lg:block lg:col-span-5 lg:sticky lg:top-6">
          <NotesPanel
            materialId={activeMaterial?.id ?? null}
            materialType="youtube"
            materialTitle={activeMaterial?.title ?? "Listening"}
            initialNoteId={requestedNoteId}
            getTimestampLabel={
              activeMaterial ? getCurrentTimestampLabel : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
