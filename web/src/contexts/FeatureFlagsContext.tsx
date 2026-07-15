'use client';

// Platform feature flags + admin identity.
// Flags are controlled from the Super Admin panel; the UI hides disabled
// features and the backend enforces them (403) — hiding is UX, not security.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/lib/api';

export type FeatureFlags = {
  feed: boolean; smartApply: boolean; aiInterview: boolean; practiceMode: boolean;
  resumeBuilder: boolean; network: boolean; messages: boolean; sourcing: boolean;
  webhooks: boolean; companies: boolean; signups: boolean;
};

const DEFAULTS: FeatureFlags = {
  feed: true, smartApply: true, aiInterview: true, practiceMode: true,
  resumeBuilder: true, network: true, messages: true, sourcing: true,
  webhooks: true, companies: true, signups: true,
};

type Ctx = { flags: FeatureFlags; isAdmin: boolean; flagsLoaded: boolean; refreshFlags: () => void };
const FeatureFlagsContext = createContext<Ctx>({ flags: DEFAULTS, isAdmin: false, flagsLoaded: false, refreshFlags: () => {} });

export const FeatureFlagsProvider = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, getToken, loading } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULTS);
  const [isAdmin, setIsAdmin] = useState(false);
  const [flagsLoaded, setFlagsLoaded] = useState(false);

  const load = async () => {
    try {
      const headers = { Authorization: `Bearer ${await getToken()}` };
      const [cfgRes, meRes] = await Promise.all([
        fetch(`${API_BASE}/platform/config`, { headers }),
        fetch(`${API_BASE}/admin/me`, { headers }),
      ]);
      if (cfgRes.ok) {
        const d = await cfgRes.json();
        setFlags({ ...DEFAULTS, ...(d.features || {}) });
      }
      if (meRes.ok) {
        const d = await meRes.json();
        setIsAdmin(!!d.admin);
      }
    } catch { /* backend down — default to everything on */ }
    finally { setFlagsLoaded(true); }
  };

  useEffect(() => {
    if (!loading && isAuthenticated) load();
    if (!loading && !isAuthenticated) { setFlags(DEFAULTS); setIsAdmin(false); setFlagsLoaded(true); }
  }, [loading, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FeatureFlagsContext.Provider value={{ flags, isAdmin, flagsLoaded, refreshFlags: load }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = () => useContext(FeatureFlagsContext);
