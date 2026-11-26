"use client";

import React, { useEffect, useState } from "react";
import { AppearanceSelector } from "@/components/AppearanceSelector";
import type { AiStatusInfo, CefrLevel, UserProfile } from "@/lib/types";

const CEFR_LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

interface StorageStatusInfo {
  databaseMode: "turso" | "local_sqlite";
  fileStorageMode: "vercel_blob" | "local_disk";
}

export function SettingsClient() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ai, setAi] = useState<AiStatusInfo | null>(null);
  const [storage, setStorage] = useState<StorageStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [targetLevel, setTargetLevel] = useState<CefrLevel>("B2");
  const [nativeLanguage, setNativeLanguage] = useState("Uzbek");
  const [readingWidth, setReadingWidth] =
    useState<UserProfile["readingWidth"]>("medium");
  const [readingFontSize, setReadingFontSize] =
    useState<UserProfile["readingFontSize"]>("md");

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const u = data.user as UserProfile;
        setUser(u);
        setAi(data.ai as AiStatusInfo);
        if (data.storage) setStorage(data.storage as StorageStatusInfo);
        setName(u.name);
        setEmail(u.email);
        setTargetLevel(u.targetLevel);
        setNativeLanguage(u.nativeLanguage);
        setReadingWidth(u.readingWidth);
        setReadingFontSize(u.readingFontSize);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          targetLevel,
          nativeLanguage,
          readingWidth,
          readingFontSize,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: json.error ?? "Unable to save preferences.",
        });
        return;
      }
      setUser(json.user as UserProfile);
      setStatusMessage({
        type: "success",
        text: "Your preferences have been saved.",
      });
      window.dispatchEvent(new Event("focus-profile-updated"));
    } catch {
      setStatusMessage({
        type: "error",
        text: "Network error while saving settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-[24px] md:text-[28px] leading-[32px] md:leading-[36px] font-semibold tracking-[-0.02em] text-on-surface">
          Settings
        </h1>
        <p className="text-[14px] text-on-surface-variant mt-1">
          Customize your visual theme, learner profile, reading comfort, and AI examiner settings.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Appearance / 5-Theme Selector (matches reference card proportion) */}
        <div className="lg:col-span-5">
          <AppearanceSelector />
        </div>

        {/* Right Column (7 cols): Profile, AI & Data Settings */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {loading ? (
            <div className="h-64 rounded-2xl bg-surface-container-lowest border border-border-subtle animate-pulse" />
          ) : (
            <>
              <form
                onSubmit={handleSave}
                className="focus-card p-5 md:p-6 flex flex-col gap-5"
              >
                <div>
                  <h2 className="text-[16px] font-semibold text-on-surface">
                    Learner Profile & Reading Comfort
                  </h2>
                  <p className="text-[13px] text-on-surface-variant mt-0.5">
                    Used to personalize your dashboard greeting and default reading workspace.
                  </p>
                </div>

                {statusMessage && (
                  <div
                    role="status"
                    className={`p-3.5 rounded-xl text-[13px] ${
                      statusMessage.type === "success"
                        ? "bg-tertiary-fixed text-on-surface font-medium"
                        : "bg-error-container text-on-error-container"
                    }`}
                  >
                    {statusMessage.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="settings-name"
                      className="block text-[12px] font-medium text-on-surface-variant mb-1"
                    >
                      Display Name
                    </label>
                    <input
                      id="settings-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="focus-input w-full px-3.5 py-2 text-[14px]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="settings-email"
                      className="block text-[12px] font-medium text-on-surface-variant mb-1"
                    >
                      Email (optional)
                    </label>
                    <input
                      id="settings-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="focus-input w-full px-3.5 py-2 text-[14px]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="settings-level"
                      className="block text-[12px] font-medium text-on-surface-variant mb-1"
                    >
                      Target CEFR Level
                    </label>
                    <select
                      id="settings-level"
                      value={targetLevel}
                      onChange={(e) =>
                        setTargetLevel(e.target.value as CefrLevel)
                      }
                      className="focus-input w-full px-3.5 py-2 text-[14px]"
                    >
                      {CEFR_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="settings-native"
                      className="block text-[12px] font-medium text-on-surface-variant mb-1"
                    >
                      Translation Language
                    </label>
                    <input
                      id="settings-native"
                      type="text"
                      value={nativeLanguage}
                      onChange={(e) => setNativeLanguage(e.target.value)}
                      className="focus-input w-full px-3.5 py-2 text-[14px]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="settings-width"
                      className="block text-[12px] font-medium text-on-surface-variant mb-1"
                    >
                      Default Reading Width
                    </label>
                    <select
                      id="settings-width"
                      value={readingWidth}
                      onChange={(e) =>
                        setReadingWidth(
                          e.target.value as UserProfile["readingWidth"]
                        )
                      }
                      className="focus-input w-full px-3.5 py-2 text-[14px]"
                    >
                      <option value="narrow">Narrow (54 characters)</option>
                      <option value="medium">Medium (68 characters)</option>
                      <option value="wide">Wide (full panel)</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="settings-fontsize"
                      className="block text-[12px] font-medium text-on-surface-variant mb-1"
                    >
                      Default Reading Text Size
                    </label>
                    <select
                      id="settings-fontsize"
                      value={readingFontSize}
                      onChange={(e) =>
                        setReadingFontSize(
                          e.target.value as UserProfile["readingFontSize"]
                        )
                      }
                      className="focus-input w-full px-3.5 py-2 text-[14px]"
                    >
                      <option value="sm">Compact (15px)</option>
                      <option value="md">Comfortable (16px)</option>
                      <option value="lg">Large (18px)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                  <span className="text-[12px] text-outline">
                    {user ? `Profile ID: ${user.id}` : ""}
                  </span>
                  <button
                    type="submit"
                    disabled={saving}
                    className="focus-btn-primary px-5 py-2 text-[13px]"
                  >
                    {saving ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </form>

              {/* Server-Side AI Integration Status */}
              <section className="focus-card p-5 md:p-6 flex flex-col gap-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[16px] font-semibold text-on-surface">
                    AI Examiner Configuration
                  </h2>
                  <span
                    className={`px-3 py-1 rounded-full text-[12px] font-medium ${
                      ai?.configured
                        ? "bg-tertiary-fixed text-primary"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {ai?.configured ? "Connected" : "Server Key Required"}
                  </span>
                </div>

                <p className="text-[13px] text-on-surface-variant leading-6">
                  {ai?.note}
                </p>

                {ai && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                    <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                      <span className="text-outline block">Provider</span>
                      <span className="font-semibold text-on-surface uppercase mt-0.5 block">
                        {ai.provider}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                      <span className="text-outline block">
                        Speaking Audio Model
                      </span>
                      <span className="font-semibold text-on-surface mt-0.5 block truncate">
                        {ai.speakingModel}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                      <span className="text-outline block">Writing Model</span>
                      <span className="font-semibold text-on-surface mt-0.5 block truncate">
                        {ai.writingModel}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-surface-container-low border border-border-subtle text-[12px] text-on-surface-variant space-y-1.5">
                  <p className="font-medium text-on-surface">
                    Server-only security policy:
                  </p>
                  <p>
                    API keys are never stored in browser storage or frontend environment variables. Configure{" "}
                    <code className="px-1.5 py-0.5 rounded bg-surface-container text-primary">
                      GEMINI_API_KEY
                    </code>{" "}
                    (or{" "}
                    <code className="px-1.5 py-0.5 rounded bg-surface-container text-primary">
                      AI_PROVIDER=openai
                    </code>{" "}
                    with{" "}
                    <code className="px-1.5 py-0.5 rounded bg-surface-container text-primary">
                      OPENAI_API_KEY
                    </code>
                    ) in{" "}
                    <code className="px-1.5 py-0.5 rounded bg-surface-container">
                      .env.local
                    </code>{" "}
                    and restart the server.
                  </p>
                </div>
              </section>

              {/* Database & File Storage Status */}
              <section className="focus-card p-5 md:p-6 flex flex-col gap-3">
                <h2 className="text-[16px] font-semibold text-on-surface">
                  Data & Storage
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                  <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                    <span className="text-outline block">Database</span>
                    <span className="font-semibold text-on-surface mt-0.5 block">
                      {storage?.databaseMode === "turso"
                        ? "Turso Cloud (libSQL)"
                        : "Local SQLite (data/focus-english.db)"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container-low border border-border-subtle">
                    <span className="text-outline block">PDF & Audio Storage</span>
                    <span className="font-semibold text-on-surface mt-0.5 block">
                      {storage?.fileStorageMode === "vercel_blob"
                        ? "Vercel Blob Storage"
                        : "Local Disk (data/uploads/)"}
                    </span>
                  </div>
                </div>
                <p className="text-[12px] text-on-surface-variant leading-5">
                  On Vercel, set{" "}
                  <code className="px-1.5 py-0.5 rounded bg-surface-container text-primary">
                    TURSO_DATABASE_URL
                  </code>
                  ,{" "}
                  <code className="px-1.5 py-0.5 rounded bg-surface-container text-primary">
                    TURSO_AUTH_TOKEN
                  </code>{" "}
                  and connect a Vercel Blob store (
                  <code className="px-1.5 py-0.5 rounded bg-surface-container text-primary">
                    BLOB_READ_WRITE_TOKEN
                  </code>
                  ). Locally, it automatically falls back to SQLite and local disk storage.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
