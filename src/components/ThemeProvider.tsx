"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_THEME,
  isValidTheme,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      if (isValidTheme(e.newValue)) {
        applyThemeToDom(e.newValue);
      }
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getClientSnapshot(): ThemeId {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (isValidTheme(attr)) return attr;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isValidTheme(stored)) return stored;
    } catch {
      // ignore storage errors
    }
  }
  return DEFAULT_THEME;
}

function getServerSnapshot(): ThemeId {
  return DEFAULT_THEME;
}

function applyThemeToDom(theme: ThemeId) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme =
    theme === "forest" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  // Sync from SQLite profile only if localStorage has no explicit theme saved yet
  useEffect(() => {
    let cancelled = false;
    let hasLocal = false;
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isValidTheme(stored)) {
        hasLocal = true;
      }
    } catch {
      // ignore
    }

    if (hasLocal) return;

    fetch("/api/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.user?.theme) return;
        const dbTheme = data.user.theme;
        if (isValidTheme(dbTheme) && dbTheme !== getClientSnapshot()) {
          applyThemeToDom(dbTheme);
          try {
            window.localStorage.setItem(THEME_STORAGE_KEY, dbTheme);
          } catch {
            // ignore
          }
          notifyListeners();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    applyThemeToDom(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage quota
    }
    notifyListeners();
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
