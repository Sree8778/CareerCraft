'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { toast, Toaster } from 'sonner';
import { encryptApiKey } from '@/lib/crypto';
import { jsonHeaders } from '@/lib/api';
import {
  User, Phone, Mail, MapPin, FileText, Briefcase, Shield, KeyRound,
  Bell, ChevronRight, CheckCircle, Trash2, ExternalLink, PlusCircle,
  RefreshCw, ShieldAlert, ShieldCheck, QrCode, Lock, DollarSign,
  Globe, Save, Eye, EyeOff
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Section = 'profile' | 'account' | 'api-keys' | 'security' | 'preferences';
type Provider = 'Gemini' | 'OpenAI' | 'Claude' | 'Groq' | 'NVIDIA NIM' | 'Apify' | 'Firecrawl';

interface WalletKey { id: string; provider: Provider; status: 'Active' | 'Standby' | 'Invalid' | 'Exhausted'; encryptedKey?: string }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',     label: 'Profile',      icon: <User className="w-4 h-4" /> },
  { id: 'account',     label: 'Account',      icon: <Mail className="w-4 h-4" /> },
  { id: 'api-keys',    label: 'API Keys',     icon: <KeyRound className="w-4 h-4" /> },
  { id: 'security',    label: 'Security',     icon: <Shield className="w-4 h-4" /> },
  { id: 'preferences', label: 'Preferences',  icon: <Briefcase className="w-4 h-4" /> },
];

const FIELD = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed';
const LABEL = 'block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5';

export default function CandidateSettingsPage() {
  const { user, isAuthenticated, getToken, loading } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<Section>('profile');

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

  const handleStackKey = async () => {
    setVerifyError(null);
    const keyVal = inputKey.trim();
    if (!keyVal) { toast.error('Please enter an API key.'); return; }
    setIsVerifying(true);
    const toastId = toast.loading(`Verifying ${selectedProvider} key…`);
    try {
      const res = await fetch(`${API_BASE}/vault/verify-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ provider: selectedProvider, key: keyVal }),
      });
      const result = await res.json();
      if (!result.valid) {
        setVerifyError(result.error || 'Invalid key. Please check and try again.');
        toast.error('Verification failed.', { id: toastId }); return;
      }
      const stackRes = await fetch(`${API_BASE}/vault/wallet/stack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ uid: user?.id, provider: selectedProvider, key: keyVal }),
      });
      const stackResult = await stackRes.json();
      const newEntry: WalletKey = stackResult.entry ?? { id: Math.random().toString(36).slice(2, 9), provider: selectedProvider, status: wallet.length === 0 ? 'Active' : 'Standby' };
      const updated = [...wallet, newEntry];
      setWallet(updated); persistWallet(updated);
      if (selectedProvider === 'Gemini' && user?.id) {
        localStorage.setItem('user_gemini_api_key', await encryptApiKey(keyVal, user.id));
      }
      setInputKey('');
      toast.success(`${selectedProvider} key verified and stacked!`, { id: toastId });
    } catch {
      toast.error('Could not reach backend. Key stacked locally.', { id: toastId });
      const newEntry: WalletKey = { id: Math.random().toString(36).slice(2, 9), provider: selectedProvider, status: wallet.length === 0 ? 'Active' : 'Standby' };
      const updated = [...wallet, newEntry];
      setWallet(updated); persistWallet(updated);
      if (selectedProvider === 'Gemini' && user?.id) localStorage.setItem('user_gemini_api_key', await encryptApiKey(keyVal, user.id));
      setInputKey('');
    } finally { setIsVerifying(false); }
  };

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

  if (!isAuthenticated || user?.role !== 'candidate') return null;

  return (
    <CandidateLayout>
      <Toaster position="top-right" richColors />
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
              <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-base font-bold text-white">API Keys Wallet</h2>
                  {wallet.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <CheckCircle className="w-3 h-3" /> {wallet.length} key{wallet.length > 1 ? 's' : ''} active
                    </span>
                  )}
                </div>

                <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5 flex gap-3 text-xs text-amber-300">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <p>Keys are encrypted server-side using Fernet AES before storage. Nobody can read your keys — not even us.</p>
                </div>

                {/* Add key */}
                <div className="space-y-3">
                  <label className={LABEL}>Add New Key</label>
                  <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value as Provider)}
                    className={FIELD + ' cursor-pointer'}>
                    <option value="Gemini" className="bg-zinc-900">Gemini AI (Recommended)</option>
                    <option value="OpenAI" className="bg-zinc-900">OpenAI GPT-4</option>
                    <option value="Claude" className="bg-zinc-900">Claude (Anthropic)</option>
                    <option value="Groq" className="bg-zinc-900">Groq High-Speed</option>
                    <option value="NVIDIA NIM" className="bg-zinc-900">NVIDIA NIM — Llama 3.x</option>
                    <option value="Apify" className="bg-zinc-900">Apify — Job Scraping (Indeed / LinkedIn)</option>
                    <option value="Firecrawl" className="bg-zinc-900">Firecrawl — Web Scraping &amp; Career Pages</option>
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

                {/* Wallet */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Your Keys ({wallet.length})</p>
                  {wallet.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-white/8 rounded-xl text-zinc-500 text-xs">
                      No keys yet. Add your first key above to enable AI features.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {wallet.map(item => (
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
                  )}
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

          </div>
        </div>
      </div>
    </CandidateLayout>
  );
}
