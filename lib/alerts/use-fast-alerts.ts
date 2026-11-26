'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALERT_CATEGORY_META,
  ALL_ALERT_CATEGORIES,
  DEFAULT_ALERT_FILTERS,
  DEFAULT_AUDIO_CATEGORIES,
  alertPriority,
  alertCountsByCategory,
  normalizeNwsCollection,
  sortAlerts,
  type AlertCategory,
  type AlertCategoryFilters,
  type WeatherAlert,
} from './model';
import { alertTypeForEvent } from './categories';
import { isAlertAudioSupported, playAlertAudio, unlockAlertAudio } from './audio';
import type { AlertSettings } from './settings';

const POLL_MS = 30_000;
const FILTERS_STORAGE_KEY = 'mesovortex_alert_category_filters_v2';
const AUDIO_CATEGORIES_STORAGE_KEY = 'mesovortex_alert_audio_categories_v2';
const AUDIO_ENABLED_STORAGE_KEY = 'mesovortex_alert_audio_enabled_v1';

export type FastAlertsOptions = {
  /** Canonical alert settings. Audio always reads this, never a second legacy schema. */
  settings: AlertSettings;
  /** True when the active display mode can show the alert banner. */
  bannerVisible: boolean;
};

function readStoredFilters(key: string, fallback: AlertCategoryFilters): AlertCategoryFilters {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AlertCategoryFilters>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const next = { ...fallback };
    ALL_ALERT_CATEGORIES.forEach((category) => {
      if (typeof parsed[category] === 'boolean') next[category] = parsed[category] as boolean;
    });
    return next;
  } catch {
    return fallback;
  }
}

export type FastAlertsState = {
  alerts: WeatherAlert[];
  filtered: WeatherAlert[];
  counts: Record<AlertCategory, number>;
  filters: AlertCategoryFilters;
  toggleFilter: (category: AlertCategory) => void;
  setAllFilters: (value: boolean) => void;
  audioEnabled: boolean;
  audioCategories: AlertCategoryFilters;
  enableAudio: () => void;
  disableAudio: () => void;
  toggleAudioCategory: (category: AlertCategory) => void;
  testTone: (category: AlertCategory) => void;
  banner: WeatherAlert | null;
  dismissBanner: () => void;
  lastUpdated: string | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
};

export function useFastAlerts({ settings, bannerVisible }: FastAlertsOptions): FastAlertsState {
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [filters, setFilters] = useState<AlertCategoryFilters>(DEFAULT_ALERT_FILTERS);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioCategories, setAudioCategories] = useState<AlertCategoryFilters>(DEFAULT_AUDIO_CATEGORIES);
  const [banner, setBanner] = useState<WeatherAlert | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const audioEnabledRef = useRef(false);
  const audioUnlockRequiredRef = useRef(false);
  const audioCategoriesRef = useRef(audioCategories);
  const settingsRef = useRef(settings);
  const bannerVisibleRef = useRef(bannerVisible);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    bannerVisibleRef.current = bannerVisible;
  }, [bannerVisible]);

  useEffect(() => {
    setFilters(readStoredFilters(FILTERS_STORAGE_KEY, DEFAULT_ALERT_FILTERS));
    setAudioCategories(readStoredFilters(AUDIO_CATEGORIES_STORAGE_KEY, DEFAULT_AUDIO_CATEGORIES));
    try {
      const storedAudioEnabled = window.localStorage.getItem(AUDIO_ENABLED_STORAGE_KEY) === '1';
      setAudioEnabled(storedAudioEnabled);
      // A restored arming preference still needs a fresh gesture before the
      // browser will allow Web Audio or custom Audio.play() after reload.
      audioUnlockRequiredRef.current = storedAudioEnabled;
    } catch {
      // Storage disabled; audio remains off.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // Storage disabled; filters remain in memory.
    }
  }, [filters]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_CATEGORIES_STORAGE_KEY, JSON.stringify(audioCategories));
    } catch {
      // Storage disabled; audio preferences remain in memory.
    }
    audioCategoriesRef.current = audioCategories;
  }, [audioCategories]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    try {
      window.localStorage.setItem(AUDIO_ENABLED_STORAGE_KEY, audioEnabled ? '1' : '0');
    } catch {
      // Storage disabled; audio state remains in memory.
    }
  }, [audioEnabled]);

  useEffect(() => {
    if (!audioEnabled || !audioUnlockRequiredRef.current) return;
    const unlockStoredAudio = () => {
      unlockAlertAudio();
      audioUnlockRequiredRef.current = false;
      window.removeEventListener('pointerdown', unlockStoredAudio);
      window.removeEventListener('keydown', unlockStoredAudio);
    };
    window.addEventListener('pointerdown', unlockStoredAudio);
    window.addEventListener('keydown', unlockStoredAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockStoredAudio);
      window.removeEventListener('keydown', unlockStoredAudio);
    };
  }, [audioEnabled]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const response = await fetch('/api/alerts', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Alert feed returned HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        if (data?._meta?.ok === false) {
          throw new Error(data?._meta?.error || 'Alert feed unavailable');
        }

        const next = normalizeNwsCollection(data);

        if (!initializedRef.current) {
          // First successful load: remember what already existed. Never sound
          // an alarm for the backlog.
          next.forEach((alert) => seenIdsRef.current.add(alert.id));
          initializedRef.current = true;
        } else {
          const fresh = next.filter((alert) => !seenIdsRef.current.has(alert.id));
          next.forEach((alert) => seenIdsRef.current.add(alert.id));

          if (seenIdsRef.current.size > 6000) {
            seenIdsRef.current = new Set(next.map((alert) => alert.id));
          }

          if (fresh.length > 0) {
            const top = sortAlerts(fresh)[0];
            const type = alertTypeForEvent(top.event);
            const pref = type ? settingsRef.current.categoryPrefs?.[type.id] : null;
            if (!pref || pref.notify) setBanner(top);
            // One dispatcher owns all policy: arming, category, visible surface,
            // sound profile, custom sounds and silent mode.
            if (
              audioEnabledRef.current &&
              audioCategoriesRef.current[top.category] &&
              bannerVisibleRef.current
            ) {
              playAlertAudio(top.event, top.category, settingsRef.current);
            }
          }
        }

        setAlerts(next);
        setLastUpdated(new Date().toISOString());
        setError(null);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(String(err?.message || err));
        setLoading(false);
      }
    };

    setLoading(true);
    load();
    timer = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [reloadToken]);

  // New alerts slide in briefly, then automatically minimize to the sidebar.
  // The timer is one-shot per alert: no flashing and no repeated reappearance.
  useEffect(() => {
    if (!banner || !settings.notificationAutoMinimize) return;
    const timer = setTimeout(() => setBanner(null), settings.notificationDurationMs);
    return () => clearTimeout(timer);
  }, [banner, settings.notificationDurationMs, settings.notificationAutoMinimize]);

  const toggleFilter = useCallback((category: AlertCategory) => {
    setFilters((previous) => ({ ...previous, [category]: !previous[category] }));
  }, []);

  const setAllFilters = useCallback((value: boolean) => {
    setFilters({
      warning: value,
      watch: value,
      advisory: value,
      statement: value,
      other: value,
    });
  }, []);

  const enableAudio = useCallback(() => {
    if (!isAlertAudioSupported()) {
      setError('Audio alerts are not supported in this browser.');
      return;
    }
    unlockAlertAudio();
    audioUnlockRequiredRef.current = false;
    playAlertAudio('Alert tone armed', 'advisory', settingsRef.current);
    setAudioEnabled(true);
    setError(null);
  }, []);

  const disableAudio = useCallback(() => {
    setAudioEnabled(false);
  }, []);

  const toggleAudioCategory = useCallback((category: AlertCategory) => {
    setAudioCategories((previous) => ({ ...previous, [category]: !previous[category] }));
  }, []);

  const testTone = useCallback((category: AlertCategory) => {
    playAlertAudio('Alert tone test', category, settingsRef.current);
  }, []);

  const dismissBanner = useCallback(() => setBanner(null), []);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);

  const filtered = useMemo(
    () => alerts.filter((alert) => filters[alert.category]),
    [alerts, filters]
  );

  const counts = useMemo(() => alertCountsByCategory(alerts), [alerts]);

  return {
    alerts,
    filtered,
    counts,
    filters,
    toggleFilter,
    setAllFilters,
    audioEnabled,
    audioCategories,
    enableAudio,
    disableAudio,
    toggleAudioCategory,
    testTone,
    banner,
    dismissBanner,
    lastUpdated,
    error,
    loading,
    refresh,
  };
}

export { ALERT_CATEGORY_META, alertPriority };
