"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import type { AiStatusInfo, UserProfile } from "@/lib/types";
import { FocusLogo } from "./FocusLogo";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const DESKTOP_MAIN_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/listening", label: "Listening", icon: "headphones" },
  { href: "/reading", label: "Reading", icon: "menu_book" },
  { href: "/speaking", label: "Speaking", icon: "mic" },
  { href: "/writing", label: "Writing", icon: "edit" },
  { href: "/vocabulary", label: "Vocabulary", icon: "layers" },
];

const MOBILE_BOTTOM_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/listening", label: "Listening", icon: "headphones" },
  { href: "/reading", label: "Reading", icon: "menu_book" },
  { href: "/speaking", label: "Speaking", icon: "mic" },
  { href: "/writing", label: "Writing", icon: "edit" },
];

function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatusInfo | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (data.user) setUser(data.user);
        if (data.ai) setAiStatus(data.ai);
      })
      .catch(() => {});

    const handleProfileUpdated = () => {
      fetch("/api/settings")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.user) setUser(data.user);
          if (data?.ai) setAiStatus(data.ai);
        })
        .catch(() => {});
    };

    window.addEventListener("focus-profile-updated", handleProfileUpdated);
    return () => {
      active = false;
      window.removeEventListener("focus-profile-updated", handleProfileUpdated);
    };
  }, []);

  useEffect(() => {
    if (!statusMenuOpen) return;
    const onOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [statusMenuOpen]);

  const userInitial = (user?.name?.trim()?.[0] || "A").toUpperCase();
  const settingsActive = isRouteActive(pathname, "/settings");

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-surface text-on-surface">
      {/* Desktop Persistent Sidebar (Matches all 5 reference sheets) */}
      <aside
        aria-label="Primary Navigation"
        className="hidden md:flex md:flex-col md:w-[248px] md:shrink-0 md:fixed md:inset-y-0 md:left-0 bg-sidebar border-r border-border-subtle z-40 transition-colors"
      >
        {/* Brand Header */}
        <div className="px-6 pt-6 pb-5 flex items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <FocusLogo className="w-8 h-8 shrink-0" />
            <span className="text-[18px] font-semibold tracking-[-0.02em] text-on-surface">
              Focus English
            </span>
          </Link>
        </div>

        {/* Main Navigation Items */}
        <nav className="flex-1 px-4 py-1 flex flex-col gap-1 overflow-y-auto">
          {DESKTOP_MAIN_NAV.map((item) => {
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] transition-colors ${
                  active
                    ? "bg-surface-container-high text-on-surface font-semibold"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-medium"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[21px] ${
                    active ? "text-primary" : "text-on-surface-variant"
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Settings Item (exact placement from visual references) */}
        <div className="px-4 py-4 border-t border-border-subtle">
          <Link
            href="/settings"
            aria-current={settingsActive ? "page" : undefined}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] transition-colors ${
              settingsActive
                ? "bg-surface-container-high text-on-surface font-semibold"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-medium"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[21px] ${
                settingsActive ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              settings
            </span>
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Fixed Top Header */}
      <header
        className="md:hidden fixed top-0 inset-x-0 z-50 focus-header-glass pt-safe border-b border-border-subtle/70"
        style={{ boxShadow: "var(--shadow-header)" }}
      >
        <div className="h-16 px-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <FocusLogo className="w-7 h-7 shrink-0" />
            <span className="text-[16px] font-semibold leading-6 tracking-tight text-on-surface">
              Focus English
            </span>
          </Link>

          <div className="flex items-center gap-1.5 relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setStatusMenuOpen((v) => !v)}
              aria-label="Workspace Status & Shortcuts"
              aria-expanded={statusMenuOpen}
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[21px]">
                notifications
              </span>
            </button>

            <Link
              href="/settings"
              aria-label="Appearance and Settings"
              className="w-8 h-8 rounded-full bg-surface-container-high border border-border-subtle flex items-center justify-center text-[13px] font-semibold text-primary hover:border-primary transition-colors"
            >
              {userInitial}
            </Link>

            {statusMenuOpen && (
              <div className="absolute right-0 top-13 w-72 focus-card-elevated p-4 z-50">
                <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle">
                  <span className="text-[13px] font-semibold text-on-surface">
                    Workspace Status
                  </span>
                  <button
                    type="button"
                    onClick={() => setStatusMenuOpen(false)}
                    className="text-outline hover:text-on-surface p-1"
                    aria-label="Close menu"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      close
                    </span>
                  </button>
                </div>

                <div className="py-3 space-y-2.5 text-[12px] text-on-surface-variant">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[17px] text-primary mt-0.5">
                      database
                    </span>
                    <p>
                      Notes, history, and vocabulary save automatically to local storage.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[17px] text-primary mt-0.5">
                      {aiStatus?.configured ? "check_circle" : "info"}
                    </span>
                    <p>
                      {aiStatus?.configured
                        ? `AI Examiner ready (${aiStatus.provider}).`
                        : "AI Examiner needs a server API key in Settings for live scores."}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-border-subtle flex items-center justify-between gap-2">
                  <Link
                    href="/vocabulary"
                    onClick={() => setStatusMenuOpen(false)}
                    className="flex-1 text-center py-2 px-3 rounded-lg bg-surface-container text-[12px] font-medium text-primary hover:bg-tertiary-fixed transition-colors"
                  >
                    Vocabulary
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setStatusMenuOpen(false)}
                    className="flex-1 text-center py-2 px-3 rounded-lg border border-border-subtle text-[12px] font-medium text-on-surface hover:bg-surface-container-low transition-colors"
                  >
                    Appearance
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="flex-1 w-full md:pl-[248px] pt-16 pb-24 md:pt-0 md:pb-10 min-w-0">
        <div className="w-full max-w-[1260px] mx-auto px-5 md:px-9 py-5 md:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 pb-safe focus-header-glass border-t border-border-subtle/80"
        style={{ boxShadow: "var(--shadow-nav-bottom)" }}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-[2px] transition-colors ${
                  active
                    ? "text-primary font-semibold"
                    : "text-on-surface-variant hover:text-on-surface font-medium"
                }`}
              >
                <span className="material-symbols-outlined text-[22px]">
                  {item.icon}
                </span>
                <span className="text-[11px] leading-4 tracking-[0.01em]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
