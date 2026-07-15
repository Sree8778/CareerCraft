'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { toast } from 'sonner';
import { encryptApiKey } from '@/lib/crypto';
import { API_BASE, jsonHeaders } from '@/lib/api';
import {
  User, Phone, Mail, MapPin, FileText, Briefcase, Shield, KeyRound,
  Bell, ChevronRight, CheckCircle, Trash2, ExternalLink, PlusCircle,
  RefreshCw, ShieldAlert, ShieldCheck, QrCode, Lock, DollarSign,
  Globe, Save, Eye, EyeOff, Puzzle, Copy, RotateCcw
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Section = 'profile' | 'account' | 'api-keys' | 'security' | 'preferences' | 'plugin';
type Provider = 'Gemini' | 'OpenAI' | 'Claude' | 'Groq' | 'NVIDIA NIM' | 'Apify' | 'Firecrawl';

const AI_PROVIDERS: Provider[]      = ['Gemini', 'OpenAI', 'Claude', 'Groq', 'NVIDIA NIM'];
const SCRAPER_PROVIDERS: Provider[] = ['Apify', 'Firecrawl'];

interface WalletKey { id: string; provider: Provider; status: 'Active' | 'Standby' | 'Invalid' | 'Exhausted'; encryptedKey?: string }

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',     label: 'Profile',      icon: <User className="w-4 h-4" /> },
  { id: 'account',     label: 'Account',      icon: <Mail className="w-4 h-4" /> },
  { id: 'api-keys',    label: 'API Keys',     icon: <KeyRound className="w-4 h-4" /> },
  { id: 'security',    label: 'Security',     icon: <Shield className="w-4 h-4" /> },
  { id: 'preferences', label: 'Preferences',  icon: <Briefcase className="w-4 h-4" /> },
  { id: 'plugin',      label: 'Browser Plugin', icon: <Puzzle className="w-4 h-4" /> },
];

const FIELD = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed';
const LABEL = 'block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5';

function CandidateSettingsInner() {
  const { user, isAuthenticated, getToken, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const validSections: Section[] = ['profile', 'account', 'api-keys', 'security', 'preferences', 'plugin'];
  const initialSection = searchParams.get('section') as Section | null;
  const [active, setActive] = useState<Section>(
    initialSection && validSections.includes(initialSection) ? initialSection : 'profile'
  );

  // Profile
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileHeadline, setProfileHeadline] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Account
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Job Preferences
  const [jobType, setJobType] = useState('');
  const [locationPref, setLocationPref] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [workAuth, setWorkAuth] = useState('');
  const [availability, setAvailability] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);

  // API Keys wallet
  const [wallet, setWallet] = useState<WalletKey[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('Gemini');
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Scraping keys (separate section)
  const [scraperProvider, setScraperProvider] = useState<Provider>('Apify');
  const [scraperInputKey, setScraperInputKey] = useState('');
  const [scraperShowKey, setScraperShowKey] = useState(false);
  const [scraperVerifying, setScraperVerifying] = useState(false);
  const [scraperVerifyError, setScraperVerifyError] = useState<string | null>(null);

  // Browser Plugin token
  const [pluginToken, setPluginToken] = useState<string | null>(null);
  const [pluginTokenLoading, setPluginTokenLoading] = useState(false);
  const [pluginTokenCopied, setPluginTokenCopied] = useState(false);

  // Security / 2FA
  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [tfaStep, setTfaStep] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [tfaSecret, setTfaSecret] = useState('');
  const [tfaUri, setTfaUri] = useState('');
  const [tfaOtp, setTfaOtp] = useState('');
  const [tfaLoading, setTfaLoading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || user?.role !== 'candidate') router.push('/');
  }, [isAuthenticated, user, router, loading]);

  // Load profile data from Firestore
  useEffect(() => {
    if (!user?.id) return;
    setProfileName(user.name || '');

    (async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', user.id));
        if (userSnap.exists()) {
          const d = userSnap.data();
          setPhone(d.phone || '');
          setProfileName(d.fullName || d.name || user.name || '');
          const wallet: WalletKey[] = (d.apiKeysWallet || []).map((k: any) => ({
            id: k.id || Math.random().toString(36).slice(2),
            provider: k.provider || 'Gemini',
            status: k.status || 'Standby',
            encryptedKey: k.encryptedKey || '',
          }));
          setWallet(wallet);
          localStorage.setItem('user_api_keys_wallet', JSON.stringify(wallet));
        }

        const resumeSnap = await getDoc(doc(db, 'resumes', user.id));
        if (resumeSnap.exists()) {
          const rd = resumeSnap.data().resumeData || {};
          setProfileBio(rd.summary || '');
          setProfileHeadline(rd.personal?.headline || '');
          setPhone(rd.personal?.phone || phone);
          setLocation(rd.personal?.location || '');
          setAddress(rd.personal?.address || '');
          const prefs = rd.preferences || {};
          setJobType(prefs.jobType || '');
          setLocationPref(prefs.locationPref || '');
          setSalaryMin(prefs.salaryMin || '');
          setSalaryMax(prefs.salaryMax || '');
          setWorkAuth(prefs.workAuth || '');
          setAvailability(prefs.availability || '');
        }
        // Load plugin token
        const ptSnap = await getDoc(doc(db, 'users', user.id));
        if (ptSnap.exists()) setPluginToken(ptSnap.data().pluginToken || null);
      } catch (e) {
        console.error('Settings load error:', e);
      }
    })();
  }, [user]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await fetch(`${API_BASE}/users/${user?.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ fullName: profileName, bio: profileBio, headline: profileHeadline }),
      });
      toast.success('Profile saved.');
    } catch { toast.error('Failed to save profile.'); }
    finally { setSavingProfile(false); }
  };

  const saveAccount = async () => {
    setSavingAccount(true);
    try {
      await fetch(`${API_BASE}/users/${user?.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ phone, location, address }),
      });
      toast.success('Account details saved.');
    } catch { toast.error('Failed to save account.'); }
    finally { setSavingAccount(false); }
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      await fetch(`${API_BASE}/users/${user?.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ preferences: { jobType, locationPref, salaryMin, salaryMax, workAuth, availability } }),
      });
      toast.success('Job preferences saved.');
    } catch { toast.error('Failed to save preferences.'); }
    finally { setSavingPrefs(false); }
  };

  const persistWallet = (w: WalletKey[]) => localStorage.setItem('user_api_keys_wallet', JSON.stringify(w));

  const addKey = async (
    provider: Provider,
    keyVal: string,
    setVerifying: (v: boolean) => void,
    setError: (e: string | null) => void,
    clearInput: () => void,
  ) => {
    setError(null);
    if (!keyVal) { toast.error('Please enter an API key.'); return; }
    setVerifying(true);
    const toastId = toast.loading(`Verifying ${provider} key…`);
    try {
      const res = await fetch(`${API_BASE}/vault/verify-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ provider, key: keyVal }),
      });
      const result = await res.json();
      if (!result.valid) {
        setError(result.error || 'Invalid key. Please check and try again.');
        toast.error('Verification failed.', { id: toastId }); return;
      }
      const stackRes = await fetch(`${API_BASE}/vault/wallet/stack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ uid: user?.id, provider, key: keyVal }),
      });
      const stackResult = await stackRes.json();
      const newEntry: WalletKey = stackResult.entry ?? { id: Math.random().toString(36).slice(2, 9), provider, status: wallet.filter(k => AI_PROVIDERS.includes(k.provider as Provider)).length === 0 ? 'Active' : 'Standby' };
      const updated = [...wallet, newEntry];
      setWallet(updated); persistWallet(updated);
      if (provider === 'Gemini' && user?.id) {
        localStorage.setItem('user_gemini_api_key', await encryptApiKey(keyVal, user.id));
      }
      clearInput();
      toast.success(`${provider} key verified and saved!`, { id: toastId });
    } catch {
      toast.error('Could not reach backend. Key stacked locally.', { id: toastId });
      const newEntry: WalletKey = { id: Math.random().toString(36).slice(2, 9), provider, status: 'Active' };
      const updated = [...wallet, newEntry];
      setWallet(updated); persistWallet(updated);
      if (provider === 'Gemini' && user?.id) localStorage.setItem('user_gemini_api_key', await encryptApiKey(keyVal, user.id));
      clearInput();
    } finally { setVerifying(false); }
  };

  const handleStackKey = () =>
    addKey(selectedProvider, inputKey.trim(), setIsVerifying, setVerifyError, () => setInputKey(''));

  const handleStackScraperKey = () =>
    addKey(scraperProvider, scraperInputKey.trim(), setScraperVerifying, setScraperVerifyError, () => setScraperInputKey(''));

  const handleRemoveKey = async (id: string) => {
    try {
      await fetch(`${API_BASE}/vault/wallet/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ uid: user?.id, keyId: id }),
      });
    } catch {}
    const filtered = wallet.filter(k => k.id !== id);
    if (filtered.length > 0 && !filtered.some(k => k.status === 'Active')) filtered[0].status = 'Active';
    setWallet(filtered); persistWallet(filtered);
    toast.info('Key removed.');
  };

  const handleSetup2FA = async () => {
    setTfaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/setup`, { method: 'POST', headers: await jsonHeaders(getToken) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTfaSecret(data.secret); setTfaUri(data.uri); setTfaStep('setup');
    } catch (e: any) { toast.error(e.message || '2FA setup failed'); }
    finally { setTfaLoading(false); }
  };

  const handleVerify2FA = async () => {
    if (tfaOtp.length < 6) { toast.error('Enter the 6-digit code'); return; }
    setTfaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/verify`, { method: 'POST', headers: await jsonHeaders(getToken), body: JSON.stringify({ otp: tfaOtp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTfaEnabled(true); setTfaStep('idle'); setTfaOtp('');
      toast.success('2FA enabled!');
    } catch (e: any) { toast.error(e.message || 'Invalid code'); }
    finally { setTfaLoading(false); }
  };

  const handleDisable2FA = async () => {
    if (tfaOtp.length < 6) { toast.error('Enter authenticator code'); return; }
    setTfaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/disable`, { method: 'POST', headers: await jsonHeaders(getToken), body: JSON.stringify({ otp: tfaOtp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTfaEnabled(false); setTfaStep('idle'); setTfaOtp('');
      toast.success('2FA disabled.');
    } catch (e: any) { toast.error(e.message || 'Invalid code'); }
    finally { setTfaLoading(false); }
  };

  const generatePluginToken = async () => {
    setPluginTokenLoading(true);
    try {
      const res = await fetch(`${API_BASE}/plugin/token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      const data = await res.json();
      if (data.token) { setPluginToken(data.token); toast.success('Plugin token generated.'); }
      else throw new Error(data.error);
    } catch { toast.error('Failed to generate token.'); }
    finally { setPluginTokenLoading(false); }
  };

  const copyPluginToken = async () => {
    if (!pluginToken) return;
    await navigator.clipboard.writeText(pluginToken);
    setPluginTokenCopied(true);
    setTimeout(() => setPluginTokenCopied(false), 2000);
  };

  if (!isAuthenticated || user?.role !== 'candidate') return null;

  return (
    <CandidateLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-black text-white mb-6">Settings</h1>

        <div className="flex gap-6 items-start">

          {/* ── Left panel ── */}
          <aside className="w-48 shrink-0 bg-zinc-900 border border-white/10 rounded-2xl p-2 sticky top-6">
            <nav className="space-y-0.5">
              {NAV.map(n => (
                <button key={n.id} onClick={() => setActive(n.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                    active === n.id
                      ? 'bg-indigo-500/15 border border-indigo-500/25 text-indigo-300'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}>
                  <span className={active === n.id ? 'text-indigo-400' : 'text-zinc-500'}>{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Right content ── */}
          <div className="flex-1 min-w-0">

            {/* PROFILE */}
            {active === 'profile' && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2"><User className="w-4 h-4 text-indigo-400" /> Profile</h2>

                {/* Avatar row */}
                <div className="flex items-center gap-4 pb-4 border-b border-white/8">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shrink-0">
                    {user?.avatar
                      ? <img src={user.avatar} alt={profileName} className="w-full h-full rounded-full object-cover" />
                      : profileName.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{profileName}</p>
                    <p className="text-xs text-zinc-500">{user?.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={LABEL}>Full Name</label>
                    <input value={profileName} onChange={e => setProfileName(e.target.value)} className={FIELD} placeholder="Your full name" />
                  </div>
                  <div>
                    <label className={LABEL}>Headline</label>
                    <input value={profileHeadline} onChange={e => setProfileHeadline(e.target.value)} className={FIELD} placeholder="e.g. Senior Software Engineer at Acme" />
                  </div>
                  <div>
                    <label className={LABEL}>Bio / Summary</label>
                    <textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} rows={4} className={FIELD + ' resize-none'} placeholder="Write a brief professional summary…" />
                  </div>

                  <button onClick={saveProfile} disabled={savingProfile}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition">
                    {savingProfile ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Profile
                  </button>
                </div>
              </div>
            )}

            {/* ACCOUNT */}
            {active === 'account' && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-400" /> Account</h2>

                <div className="space-y-4">
                  <div>
                    <label className={LABEL}>Email</label>
                    <input value={user?.email || ''} disabled className={FIELD} />
                    <p className="text-[11px] text-zinc-500 mt-1">Email is managed through Firebase Authentication and cannot be changed here.</p>
                  </div>
                  <div>
                    <label className={LABEL}>Phone Number</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} className={FIELD} placeholder="+1 (555) 123-4567" type="tel" />
                  </div>
                  <div>
                    <label className={LABEL}>Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      <input value={location} onChange={e => setLocation(e.target.value)} className={FIELD + ' pl-9'} placeholder="City, State, Country" />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL}>Address</label>
                    <input value={address} onChange={e => setAddress(e.target.value)} className={FIELD} placeholder="Street address" />
                  </div>

                  <button onClick={saveAccount} disabled={savingAccount}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition">
                    {savingAccount ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Account
                  </button>
                </div>
              </div>
            )}

            {/* API KEYS */}
            {active === 'api-keys' && (
              <div className="space-y-5">

                {/* ── Security banner ── */}
                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5 flex gap-3 text-xs text-amber-300">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <p>All keys are encrypted server-side with Fernet AES before storage. Nobody can read your keys — not even us.</p>
                </div>

                {/* ── Section 1: AI Model Keys ── */}
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <KeyRound className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h2 className="text-base font-bold text-white">AI Model Keys</h2>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Power resume analysis, cover letter generation, AI screening, and interview practice.</p>
                    </div>
                    {wallet.filter(k => AI_PROVIDERS.includes(k.provider as Provider)).length > 0 && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        {wallet.filter(k => AI_PROVIDERS.includes(k.provider as Provider)).length} configured
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className={LABEL}>Add AI Key</label>
                    <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value as Provider)}
                      className={FIELD + ' cursor-pointer'}>
                      <option value="Gemini" className="bg-zinc-900">Gemini AI (Recommended — free tier available)</option>
                      <option value="OpenAI" className="bg-zinc-900">OpenAI GPT-4</option>
                      <option value="Claude" className="bg-zinc-900">Claude (Anthropic)</option>
                      <option value="Groq" className="bg-zinc-900">Groq High-Speed</option>
                      <option value="NVIDIA NIM" className="bg-zinc-900">NVIDIA NIM — Llama 3.x</option>
                    </select>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={inputKey}
                          onChange={e => setInputKey(e.target.value)}
                          placeholder={`Paste your ${selectedProvider} key…`}
                          disabled={isVerifying}
                          className={FIELD + ' pr-10'}
                        />
                        <button type="button" onClick={() => setShowKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition">
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button onClick={handleStackKey} disabled={isVerifying || !inputKey.trim()}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition whitespace-nowrap">
                        {isVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                        {isVerifying ? 'Verifying…' : 'Add Key'}
                      </button>
                    </div>
                    {verifyError && <p className="text-[11px] text-rose-400 font-mono">{verifyError}</p>}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
                      className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1">
                      Get a free Gemini key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* AI keys wallet */}
                  {(() => {
                    const aiKeys = wallet.filter(k => AI_PROVIDERS.includes(k.provider as Provider));
                    return aiKeys.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-white/8 rounded-xl text-zinc-500 text-xs">
                        No AI keys yet. Add your first key above.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Saved AI Keys ({aiKeys.length})</p>
                        {aiKeys.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                <KeyRound className="w-4 h-4 text-indigo-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white">{item.provider}</p>
                                <p className="text-[10px] font-mono text-zinc-500">••••••••••••••••••••</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                item.status === 'Active'    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                                item.status === 'Invalid'   ? 'bg-red-500/15 border-red-500/30 text-red-400' :
                                item.status === 'Exhausted' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                                'bg-zinc-800/60 border-white/10 text-zinc-400'
                              }`}>{item.status}</span>
                              <button onClick={() => handleRemoveKey(item.id)}
                                className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* ── Section 2: Web Scraping Keys ── */}
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-orange-400" />
                    <div>
                      <h2 className="text-base font-bold text-white">Web Scraping Keys</h2>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Used exclusively for live job scraping from Indeed, LinkedIn, and company career pages.</p>
                    </div>
                    {wallet.filter(k => SCRAPER_PROVIDERS.includes(k.provider as Provider)).length > 0 && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        {wallet.filter(k => SCRAPER_PROVIDERS.includes(k.provider as Provider)).length} configured
                      </span>
                    )}
                  </div>

                  {/* Info banner */}
                  <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl p-3.5 flex gap-3 text-xs text-orange-200">
                    <Globe className="w-4 h-4 shrink-0 text-orange-400 mt-0.5" />
                    <div className="space-y-1">
                      <p><span className="font-bold text-orange-300">Apify</span> — scrapes Indeed, LinkedIn, and other job boards in real-time. Required for the Jobs search page to fetch fresh listings.</p>
                      <p><span className="font-bold text-orange-300">Firecrawl</span> — crawls company career pages and unlisted job postings directly from the source.</p>
                      <p className="text-orange-400/70">These keys are separate from AI keys and are only used when you trigger a job search.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className={LABEL}>Add Scraping Key</label>
                    <select value={scraperProvider} onChange={e => setScraperProvider(e.target.value as Provider)}
                      className={FIELD + ' cursor-pointer'}>
                      <option value="Apify" className="bg-zinc-900">Apify — Job boards (Indeed, LinkedIn, Glassdoor)</option>
                      <option value="Firecrawl" className="bg-zinc-900">Firecrawl — Company career pages</option>
                    </select>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={scraperShowKey ? 'text' : 'password'}
                          value={scraperInputKey}
                          onChange={e => setScraperInputKey(e.target.value)}
                          placeholder={scraperProvider === 'Apify' ? 'Paste your Apify API token…' : 'Paste your Firecrawl API key…'}
                          disabled={scraperVerifying}
                          className={FIELD + ' pr-10'}
                        />
                        <button type="button" onClick={() => setScraperShowKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition">
                          {scraperShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button onClick={handleStackScraperKey} disabled={scraperVerifying || !scraperInputKey.trim()}
                        className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition whitespace-nowrap">
                        {scraperVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                        {scraperVerifying ? 'Verifying…' : 'Add Key'}
                      </button>
                    </div>
                    {scraperVerifyError && <p className="text-[11px] text-rose-400 font-mono">{scraperVerifyError}</p>}
                    <a href="https://console.apify.com/account/integrations" target="_blank" rel="noreferrer"
                      className="text-[11px] text-orange-400 hover:underline flex items-center gap-1">
                      Get your Apify API token <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Scraping keys wallet */}
                  {(() => {
                    const scraperKeys = wallet.filter(k => SCRAPER_PROVIDERS.includes(k.provider as Provider));
                    return scraperKeys.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-white/8 rounded-xl text-zinc-500 text-xs">
                        No scraping keys yet. Add your Apify token above to enable live job search.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Saved Scraping Keys ({scraperKeys.length})</p>
                        {scraperKeys.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-white/3 border border-white/8 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                                <Globe className="w-4 h-4 text-orange-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white">{item.provider}</p>
                                <p className="text-[10px] font-mono text-zinc-500">••••••••••••••••••••</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                item.status === 'Active'    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                                item.status === 'Invalid'   ? 'bg-red-500/15 border-red-500/30 text-red-400' :
                                item.status === 'Exhausted' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                                'bg-zinc-800/60 border-white/10 text-zinc-400'
                              }`}>{item.status}</span>
                              <button onClick={() => handleRemoveKey(item.id)}
                                className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

              </div>
            )}

            {/* SECURITY */}
            {active === 'security' && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2"><Shield className="w-4 h-4 text-indigo-400" /> Security</h2>

                {/* Password section */}
                <div className="border border-white/8 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">Password</p>
                      <p className="text-xs text-zinc-500">Managed by Firebase Authentication</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 bg-white/5 border border-white/10 px-3 py-1 rounded-full">Secure</span>
                  </div>
                </div>

                {/* 2FA */}
                <div className="border border-white/8 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-400" /> Two-Factor Authentication
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">Add a TOTP authenticator for extra login security.</p>
                    </div>
                    <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${tfaEnabled ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-zinc-500'}`}>
                      {tfaEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  {tfaStep === 'idle' && (
                    <button onClick={tfaEnabled ? () => setTfaStep('disable') : handleSetup2FA} disabled={tfaLoading}
                      className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border transition disabled:opacity-50 ${tfaEnabled
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                        : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30'}`}>
                      <Lock className="w-3.5 h-3.5" />
                      {tfaLoading ? 'Loading…' : tfaEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                    </button>
                  )}

                  {tfaStep === 'setup' && (
                    <div className="space-y-4 bg-black/30 border border-white/8 rounded-xl p-4">
                      <p className="text-xs text-zinc-400">Scan with your authenticator app or enter the setup key:</p>
                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                        <QrCode className="w-4 h-4 text-indigo-400 shrink-0" />
                        <code className="text-xs text-indigo-300 font-mono break-all">{tfaSecret}</code>
                      </div>
                      <a href={tfaUri} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-cyan-400 underline flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Open in authenticator app
                      </a>
                      <div className="flex gap-2">
                        <input type="text" maxLength={6} placeholder="6-digit code" value={tfaOtp}
                          onChange={e => setTfaOtp(e.target.value.replace(/\D/g, ''))}
                          className={FIELD + ' font-mono tracking-widest'} />
                        <button onClick={handleVerify2FA} disabled={tfaLoading}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 rounded-xl transition">
                          {tfaLoading ? '…' : 'Verify'}
                        </button>
                        <button onClick={() => { setTfaStep('idle'); setTfaOtp(''); }}
                          className="text-zinc-400 hover:text-white text-xs px-3 rounded-xl border border-white/10 transition">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {tfaStep === 'disable' && (
                    <div className="space-y-3 bg-black/30 border border-rose-500/20 rounded-xl p-4">
                      <p className="text-xs text-zinc-400">Enter your current authenticator code to disable 2FA.</p>
                      <div className="flex gap-2">
                        <input type="text" maxLength={6} placeholder="6-digit code" value={tfaOtp}
                          onChange={e => setTfaOtp(e.target.value.replace(/\D/g, ''))}
                          className={FIELD + ' font-mono tracking-widest'} />
                        <button onClick={handleDisable2FA} disabled={tfaLoading}
                          className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold px-4 rounded-xl transition">
                          {tfaLoading ? '…' : 'Disable'}
                        </button>
                        <button onClick={() => { setTfaStep('idle'); setTfaOtp(''); }}
                          className="text-zinc-400 hover:text-white text-xs px-3 rounded-xl border border-white/10 transition">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* JOB PREFERENCES */}
            {active === 'preferences' && (
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2"><Briefcase className="w-4 h-4 text-indigo-400" /> Job Preferences</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Preferred Job Type</label>
                    <select value={jobType} onChange={e => setJobType(e.target.value)} className={FIELD + ' cursor-pointer'}>
                      <option value="" className="bg-zinc-900">Any</option>
                      {['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'].map(t => (
                        <option key={t} value={t} className="bg-zinc-900">{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={LABEL}>Work Location Preference</label>
                    <select value={locationPref} onChange={e => setLocationPref(e.target.value)} className={FIELD + ' cursor-pointer'}>
                      <option value="" className="bg-zinc-900">Any</option>
                      {['Remote', 'On-site', 'Hybrid'].map(t => (
                        <option key={t} value={t} className="bg-zinc-900">{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={LABEL}>Salary Min ($/yr)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      <input value={salaryMin} onChange={e => setSalaryMin(e.target.value)} type="number" className={FIELD + ' pl-9'} placeholder="e.g. 60000" />
                    </div>
                  </div>

                  <div>
                    <label className={LABEL}>Salary Max ($/yr)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      <input value={salaryMax} onChange={e => setSalaryMax(e.target.value)} type="number" className={FIELD + ' pl-9'} placeholder="e.g. 120000" />
                    </div>
                  </div>

                  <div>
                    <label className={LABEL}>Work Authorization</label>
                    <select value={workAuth} onChange={e => setWorkAuth(e.target.value)} className={FIELD + ' cursor-pointer'}>
                      <option value="" className="bg-zinc-900">Select…</option>
                      {['US Citizen', 'Green Card', 'H1-B', 'OPT/CPT', 'TN Visa', 'Other'].map(t => (
                        <option key={t} value={t} className="bg-zinc-900">{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={LABEL}>Availability</label>
                    <select value={availability} onChange={e => setAvailability(e.target.value)} className={FIELD + ' cursor-pointer'}>
                      <option value="" className="bg-zinc-900">Select…</option>
                      {['Immediately', '2 weeks notice', '1 month notice', 'Not actively looking'].map(t => (
                        <option key={t} value={t} className="bg-zinc-900">{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button onClick={savePreferences} disabled={savingPrefs}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition">
                  {savingPrefs ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Preferences
                </button>
              </div>
            )}

            {/* BROWSER PLUGIN */}
            {active === 'plugin' && (
              <div className="space-y-5">
                <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <Puzzle className="w-5 h-5 text-violet-400" />
                    <div>
                      <h2 className="text-base font-bold text-white">Browser Extension</h2>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Auto-fill job applications on Greenhouse, Lever, Ashby, Workday, and more.</p>
                    </div>
                  </div>

                  {/* Install instructions */}
                  <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-4 space-y-3 text-xs text-violet-200">
                    <p className="font-bold text-violet-300 flex items-center gap-2"><Puzzle className="w-3.5 h-3.5" /> Installation</p>
                    <ol className="space-y-1.5 list-decimal list-inside text-zinc-300">
                      <li>Download the extension from the <span className="text-violet-300 font-bold">web/browser-extension</span> folder in the project</li>
                      <li>Open Chrome → <span className="font-mono bg-white/10 px-1 rounded">chrome://extensions</span></li>
                      <li>Enable <span className="font-bold">Developer mode</span> (top right toggle)</li>
                      <li>Click <span className="font-bold">Load unpacked</span> → select the <span className="font-mono bg-white/10 px-1 rounded">browser-extension</span> folder</li>
                      <li>Click the extension icon → paste your Plugin Token below</li>
                    </ol>
                  </div>

                  {/* Token card */}
                  <div className="border border-white/8 rounded-xl p-5 space-y-4">
                    <div>
                      <p className="text-sm font-bold text-white mb-0.5">Plugin Token</p>
                      <p className="text-[11px] text-zinc-500">This token authenticates the browser extension with your account. Treat it like a password.</p>
                    </div>

                    {pluginToken ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-4 py-3">
                          <code className="flex-1 text-[11px] font-mono text-violet-300 break-all">{pluginToken}</code>
                          <button onClick={copyPluginToken}
                            className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition">
                            {pluginTokenCopied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {pluginTokenCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <button onClick={generatePluginToken} disabled={pluginTokenLoading}
                          className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/8 transition disabled:opacity-50">
                          {pluginTokenLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          Regenerate Token
                        </button>
                        <p className="text-[10px] text-zinc-600">Regenerating invalidates the current token — you will need to paste the new one into the extension.</p>
                      </div>
                    ) : (
                      <button onClick={generatePluginToken} disabled={pluginTokenLoading}
                        className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition">
                        {pluginTokenLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Puzzle className="w-3.5 h-3.5" />}
                        {pluginTokenLoading ? 'Generating…' : 'Generate Plugin Token'}
                      </button>
                    )}
                  </div>

                  {/* Supported ATS */}
                  <div className="border border-white/8 rounded-xl p-4 space-y-3">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Supported Job Boards & ATS</p>
                    <div className="flex flex-wrap gap-2">
                      {['Greenhouse', 'Lever', 'Ashby', 'Workable', 'SmartRecruiters', 'Workday', 'Indeed', 'LinkedIn'].map(ats => (
                        <span key={ats} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300">{ats}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </CandidateLayout>
  );
}

// useSearchParams requires a Suspense boundary for static prerendering (Next 15).
export default function CandidateSettingsPage() {
  return (
    <Suspense fallback={null}>
      <CandidateSettingsInner />
    </Suspense>
  );
}
