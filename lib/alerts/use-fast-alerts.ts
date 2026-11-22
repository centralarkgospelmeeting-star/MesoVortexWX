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
import { isAlertAudioSupported, playAlertTone, unlockAlertAudio } from './audio';

const POLL_MS = 30_000;
const FILTERS_STORAGE_KEY = 'mesovortex_alert_category_filters';
const AUDIO_CATEGORIES_STORAGE_KEY = 'mesovortex_alert_audio_categories';

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

export function useFastAlerts(): FastAlertsState {
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
  const audioCategoriesRef = useRef(audioCategories);

  useEffect(() => {
    setFilters(readStoredFilters(FILTERS_STORAGE_KEY, DEFAULT_ALERT_FILTERS));
    setAudioCategories(readStoredFilters(AUDIO_CATEGORIES_STORAGE_KEY, DEFAULT_AUDIO_CATEGORIES));
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
            setBanner(top);
            if (audioEnabledRef.current && audioCategoriesRef.current[top.category]) {
              playAlertTone(top.category);
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

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 25_000);
    return () => clearTimeout(timer);
  }, [banner]);

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
    playAlertTone('advisory');
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
    playAlertTone(category);
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
