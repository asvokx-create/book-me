"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "bubsbookings-theme";
const TIME_ZONE_KEY = "bubsbookings-time-zone";
const TimeZoneContext = createContext<string | undefined>(undefined);

function resolvedTheme(preference: ThemePreference) {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredThemePreference(): ThemePreference | null {
  const preference = localStorage.getItem(THEME_KEY);
  return preference === "light" || preference === "dark" || preference === "system" ? preference : null;
}

function renderThemePreference(preference: ThemePreference) {
  const theme = resolvedTheme(preference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function applyThemePreference(preference: ThemePreference) {
  localStorage.setItem(THEME_KEY, preference);
  renderThemePreference(preference);
}

export function applyTimeZonePreference(preference: string) {
  localStorage.setItem(TIME_ZONE_KEY, preference);
  window.dispatchEvent(new CustomEvent("bubsbookings-preferences", { detail: { timeZone: preference } }));
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [timeZone, setTimeZone] = useState<string | undefined>(undefined);

  useEffect(() => {
    const storedTheme = getStoredThemePreference();
    const savedTheme = storedTheme ?? "system";
    const savedTimeZone = localStorage.getItem(TIME_ZONE_KEY) ?? "auto";
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if ((localStorage.getItem(THEME_KEY) ?? "system") === "system") applyThemePreference("system");
    };
    const syncPreferences = (event: Event) => {
      const detail = (event as CustomEvent<{ timeZone?: string }>).detail;
      if (detail?.timeZone) setTimeZone(detail.timeZone === "auto" ? undefined : detail.timeZone);
    };
    systemTheme.addEventListener("change", syncSystemTheme);
    window.addEventListener("bubsbookings-preferences", syncPreferences);
    if (storedTheme) applyThemePreference(storedTheme);
    else renderThemePreference(savedTheme);
    applyTimeZonePreference(savedTimeZone);

    fetch("/api/account/settings", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const preferences = await response.json() as { theme?: ThemePreference; timeZone?: string };
      if (preferences.theme && !storedTheme) applyThemePreference(preferences.theme);
      if (preferences.timeZone) applyTimeZonePreference(preferences.timeZone);
    }).catch(() => undefined);

    return () => {
      systemTheme.removeEventListener("change", syncSystemTheme);
      window.removeEventListener("bubsbookings-preferences", syncPreferences);
    };
  }, []);

  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>;
}

export function useUserTimeZone() {
  return useContext(TimeZoneContext);
}

export function formatInUserTimeZone(value: string | Date, options: Intl.DateTimeFormatOptions, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", { ...options, ...(timeZone ? { timeZone } : {}) }).format(new Date(value));
}
