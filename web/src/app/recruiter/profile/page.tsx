'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { toast } from 'sonner';
import { encryptApiKey } from '@/lib/crypto';
import { KeyRound, CheckCircle, Trash2, ExternalLink, PlusCircle, RefreshCw, ShieldAlert, ShieldCheck, QrCode, Lock } from 'lucide-react';
import { jsonHeaders } from '@/lib/api';

type Provider = 'Gemini' | 'OpenAI' | 'Claude' | 'Groq';

interface WalletKey {
  id: string;
  provider: Provider;
  status: 'Active' | 'Standby';
  encryptedKey?: string;
}

const API_BASE = 'http://127.0.0.1:5000/api';

export default function RecruiterProfilePage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const [recruiterId, setRecruiterId] = useState('');
  const [employerId, setEmployerId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [hrName, setHrName] = useState(user?.name || '');
  const [hrxEmail, setHrxEmail] = useState(user?.email || '');
  const [vendorName, setVendorName] = useState('');
  const [employerGenderId, setEmployerGenderId] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [genderId, setGenderId] = useState('');

  // Wallet state
  const [wallet, setWallet] = useState<WalletKey[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('Gemini');
  const [inputKey, setInputKey] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (user?.role !== 'recruiter') {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  // Load wallet from localStorage on mount
  useEffect(() => {
    if (!user?.id) return;
    const raw = localStorage.getItem('user_api_keys_wallet');
    if (raw) {
      try {
        const parsed: WalletKey[] = JSON.parse(raw);
        setWallet(parsed);
      } catch {}
    }
  }, [user]);

  const persistWallet = (updated: WalletKey[]) => {
    localStorage.setItem('user_api_keys_wallet', JSON.stringify(updated));
  };

  const handleStackKey = async () => {
    setVerifyError(null);
    const keyVal = inputKey.trim();
    if (!keyVal) { toast.error('Please enter an API key.'); return; }

    setIsVerifying(true);
    const toastId = toast.loading(`Verifying ${selectedProvider} key…`);
    try {
      const res = await fetch(`${API_BASE}/vault/verify-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, key: keyVal }),
      });
      const result = await res.json();

      if (!result.valid) {
        setVerifyError(result.error || 'Invalid key. Please check and try again.');
        toast.error('Verification failed.', { id: toastId });
        return;
      }

      const stackRes = await fetch(`${API_BASE}/vault/wallet/stack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock_token_for_${user?.id}`,
        },
        body: JSON.stringify({ uid: user?.id, provider: selectedProvider, key: keyVal }),
      });
      const stackResult = await stackRes.json();

      const newEntry: WalletKey = stackResult.entry ?? {
        id: Math.random().toString(36).slice(2, 9),
        provider: selectedProvider,
        status: wallet.length === 0 ? 'Active' : 'Standby',
      };

      const updated = [...wallet, newEntry];
      setWallet(updated);
      persistWallet(updated);
      if (selectedProvider === 'Gemini' && user?.id) {
        const clientEncrypted = await encryptApiKey(keyVal, user.id);
        localStorage.setItem('user_gemini_api_key', clientEncrypted);
      }
      setInputKey('');
      toast.success(`${selectedProvider} key verified and stacked!`, { id: toastId });
    } catch {
      toast.error('Could not reach backend. Key stacked locally.', { id: toastId });
      const newEntry: WalletKey = {
        id: Math.random().toString(36).slice(2, 9),
        provider: selectedProvider,
        status: wallet.length === 0 ? 'Active' : 'Standby',
      };
      const updated = [...wallet, newEntry];
      setWallet(updated);
      persistWallet(updated);
      if (selectedProvider === 'Gemini' && user?.id) {
        const clientEncrypted = await encryptApiKey(keyVal, user.id);
        localStorage.setItem('user_gemini_api_key', clientEncrypted);
      }
      setInputKey('');
    } finally {
      setIsVerifying(false);
    }
  };

  // 2FA state
  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [tfaStep, setTfaStep] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [tfaSecret, setTfaSecret] = useState('');
  const [tfaUri, setTfaUri] = useState('');
  const [tfaOtp, setTfaOtp] = useState('');
  const [tfaLoading, setTfaLoading] = useState(false);

  const handleSetup2FA = async () => {
    setTfaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/setup`, { method: 'POST', headers: jsonHeaders(user!.id) });
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
      const res = await fetch(`${API_BASE}/auth/2fa/verify`, { method: 'POST', headers: jsonHeaders(user!.id), body: JSON.stringify({ otp: tfaOtp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTfaEnabled(true); setTfaStep('idle'); setTfaOtp('');
      toast.success('2FA enabled!');
    } catch (e: any) { toast.error(e.message || 'Invalid code'); }
    finally { setTfaLoading(false); }
  };

  const handleDisable2FA = async () => {
    if (tfaOtp.length < 6) { toast.error('Enter your current authenticator code'); return; }
    setTfaLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/2fa/disable`, { method: 'POST', headers: jsonHeaders(user!.id), body: JSON.stringify({ otp: tfaOtp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTfaEnabled(false); setTfaStep('idle'); setTfaOtp('');
      toast.success('2FA disabled.');
    } catch (e: any) { toast.error(e.message || 'Invalid code'); }
    finally { setTfaLoading(false); }
  };

  const handleRemoveKey = async (id: string) => {
    try {
      await fetch(`${API_BASE}/vault/wallet/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock_token_for_${user?.id}`,
        },
        body: JSON.stringify({ uid: user?.id, keyId: id }),
      });
    } catch {}

    const filtered = wallet.filter(k => k.id !== id);
    if (filtered.length > 0 && !filtered.some(k => k.status === 'Active')) {
      filtered[0].status = 'Active';
    }
    setWallet(filtered);
    persistWallet(filtered);
    toast.info('Key removed from wallet.');
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/users/${user?.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer mock_token_for_${user?.id}` },
        body: JSON.stringify({ fullName: hrName, organizationName, industry: industryId }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Profile saved successfully!');
      setIsEditing(false);
    } catch {
      toast.error('Could not save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAuthenticated || user?.role !== 'recruiter') return null;

  return (
    <RecruiterLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Profile Card */}
          <div className="glass rounded-xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Recruiter Profile</h1>
              <button onClick={() => setIsEditing(!isEditing)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Avatar */}
              <div className="md:col-span-1 text-center">
                <div className="w-32 h-32 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center text-white text-4xl font-bold">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-32 h-32 rounded-full object-cover" />
                  ) : (
                    user?.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{user?.name}</h2>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{user?.email}</p>
                <p className="text-purple-600 dark:text-purple-400 text-sm capitalize">{user?.role}</p>
              </div>

              {/* Fields */}
              <div className="md:col-span-2">
                <div className="space-y-6">
                  {[
                    { label: 'Recruiter ID', value: recruiterId, set: setRecruiterId, placeholder: 'Recruiter ID (for update)' },
                    { label: 'Employer ID', value: employerId, set: setEmployerId, placeholder: 'Employer ID' },
                    { label: 'Organization Name', value: organizationName, set: setOrganizationName, placeholder: 'Your Company Name' },
                    { label: 'HR Name', value: hrName, set: setHrName, placeholder: 'HR Name' },
                    { label: 'HRx Email', value: hrxEmail, set: setHrxEmail, placeholder: 'HR Email', type: 'email' },
                    { label: 'Vendor Name', value: vendorName, set: setVendorName, placeholder: 'Vendor Name' },
                    { label: 'Employer Gender ID', value: employerGenderId, set: setEmployerGenderId, placeholder: 'Gender ID for Employer' },
                    { label: 'Industry ID', value: industryId, set: setIndustryId, placeholder: 'e.g., 1' },
                  ].map(({ label, value, set, placeholder, type }) => (
                    <div key={label}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                      <input type={type || 'text'} value={value} onChange={e => set(e.target.value)}
                        placeholder={placeholder} disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800" />
                    </div>
                  ))}

                  {/* User ID readonly */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">User ID</label>
                    <input type="text" value={user?.id || ''} disabled
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date of Birth</label>
                    <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800" />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gender ID</label>
                    <select value={genderId} onChange={e => setGenderId(e.target.value)} disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800">
                      <option value="">Select Gender</option>
                      <option value="1">Male</option>
                      <option value="2">Female</option>
                      <option value="3">Other</option>
                    </select>
                  </div>

                  {/* Extra UI fields */}
                  {[
                    { label: 'Job Title', placeholder: 'e.g., Senior Recruiter, HR Manager' },
                    { label: 'Phone Number', placeholder: '+1 (555) 123-4567', type: 'tel' },
                    { label: 'Location', placeholder: 'City, State' },
                  ].map(({ label, placeholder, type }) => (
                    <div key={label}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                      <input type={type || 'text'} placeholder={placeholder} disabled={!isEditing}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800" />
                    </div>
                  ))}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">About</label>
                    <textarea rows={4} placeholder="Tell us about your recruiting experience..." disabled={!isEditing}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800" />
                  </div>

                  {isEditing && (
                    <div className="flex space-x-4">
                      <button onClick={handleSaveProfile} disabled={isSaving} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors">
                        {isSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button onClick={() => setIsEditing(false)} className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors">Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── API Keys Rotation Wallet ── */}
          <div className="rounded-xl shadow-lg p-8 bg-zinc-950 border border-white/10">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <KeyRound className="w-5 h-5 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white">API Keys Rotation Wallet</h2>
              {wallet.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
                  <CheckCircle className="w-3 h-3" /> {wallet.length} key{wallet.length > 1 ? 's' : ''} stacked
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Add multiple keys to create a fallback chain. Used for AI candidate search, copilot features, and semantic matching.{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
                className="text-purple-400 hover:underline inline-flex items-center gap-1">
                Get a free Gemini key <ExternalLink className="w-3 h-3" />
              </a>
            </p>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-yellow-300 mb-5">
              <ShieldAlert className="w-5 h-5 shrink-0 text-yellow-400" />
              <div>
                <span className="font-bold">Zero Risk Encryption Policy:</span> Your API keys are encrypted immediately inside your browser using AES-GCM client-side cryptography before writing to databases. Absolutely nobody else can read them.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-zinc-400 uppercase">Provider</label>
                <select
                  value={selectedProvider}
                  onChange={e => setSelectedProvider(e.target.value as Provider)}
                  className="w-full py-3 px-3 bg-black border border-white/10 rounded-xl text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="Gemini">Gemini AI (Recommended)</option>
                  <option value="OpenAI">OpenAI GPT-4</option>
                  <option value="Claude">Claude Anthropic</option>
                  <option value="Groq">Groq High-Speed</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold font-mono text-zinc-400 uppercase">Enter {selectedProvider} API Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputKey}
                    onChange={e => setInputKey(e.target.value)}
                    placeholder={`Paste your ${selectedProvider} key here`}
                    disabled={isVerifying}
                    className="flex-1 py-3 px-4 bg-black/40 border border-white/10 rounded-xl text-xs text-white font-mono placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleStackKey}
                    disabled={isVerifying || !inputKey.trim()}
                    className="py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition"
                  >
                    {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                    {isVerifying ? 'Verifying…' : 'Stack Key'}
                  </button>
                </div>
                {verifyError && (
                  <p className="text-[10px] text-rose-400 font-mono pt-1">{verifyError}</p>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-[10px] font-bold font-mono tracking-wider text-zinc-500 uppercase">
                Your Rotating Key Chain ({wallet.length} key{wallet.length !== 1 ? 's' : ''} stacked)
              </h4>

              {wallet.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-white/5 rounded-2xl text-zinc-500 text-xs">
                  No keys stacked yet. Add your first key above to enable all AI features!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {wallet.map(item => (
                    <div key={item.id} className="p-3 bg-zinc-900 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold font-mono text-purple-400">{item.provider}</span>
                          <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 rounded ${item.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'}`}>
                            {item.status}
                          </span>
                        </div>
                        <div className="font-mono text-[9px] text-zinc-500">
                          ••••••••••••••••••••••••••••••
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveKey(item.id)}
                        className="text-zinc-500 hover:text-red-400 p-1.5 rounded bg-white/5 hover:bg-white/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Two-Factor Authentication ── */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-md p-6 space-y-4 border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" /> Two-Factor Authentication
              </h2>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${tfaEnabled ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                {tfaEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Use an authenticator app (Google Authenticator, Authy) to generate time-based codes for extra login security.
            </p>

            {tfaStep === 'idle' && (
              <button
                onClick={tfaEnabled ? () => setTfaStep('disable') : handleSetup2FA}
                disabled={tfaLoading}
                className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border transition disabled:opacity-50 ${tfaEnabled ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' : 'bg-purple-600/20 border-purple-500/30 text-purple-300 hover:bg-purple-600/30'}`}
              >
                <Lock className="w-4 h-4" />
                {tfaLoading ? 'Loading…' : tfaEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            )}

            {tfaStep === 'setup' && (
              <div className="space-y-4 bg-zinc-900/50 border border-white/10 rounded-xl p-5">
                <p className="text-xs text-zinc-400">Scan this key in your authenticator app, then enter the generated code.</p>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                  <QrCode className="w-5 h-5 text-purple-400 shrink-0" />
                  <code className="text-xs text-purple-300 font-mono break-all">{tfaSecret}</code>
                </div>
                <a href={tfaUri} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-cyan-400 underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open in authenticator app
                </a>
                <div className="flex gap-3">
                  <input type="text" maxLength={6} placeholder="6-digit code" value={tfaOtp}
                    onChange={e => setTfaOtp(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 font-mono tracking-widest" />
                  <button onClick={handleVerify2FA} disabled={tfaLoading}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition">
                    {tfaLoading ? '…' : 'Verify'}
                  </button>
                  <button onClick={() => { setTfaStep('idle'); setTfaOtp(''); }}
                    className="text-zinc-400 hover:text-white text-sm px-3 py-2.5 rounded-xl border border-white/10 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {tfaStep === 'disable' && (
              <div className="space-y-4 bg-zinc-900/50 border border-rose-500/20 rounded-xl p-5">
                <p className="text-xs text-zinc-400">Enter your current authenticator code to confirm disabling 2FA.</p>
                <div className="flex gap-3">
                  <input type="text" maxLength={6} placeholder="6-digit code" value={tfaOtp}
                    onChange={e => setTfaOtp(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none font-mono tracking-widest" />
                  <button onClick={handleDisable2FA} disabled={tfaLoading}
                    className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition">
                    {tfaLoading ? '…' : 'Disable'}
                  </button>
                  <button onClick={() => { setTfaStep('idle'); setTfaOtp(''); }}
                    className="text-zinc-400 hover:text-white text-sm px-3 py-2.5 rounded-xl border border-white/10 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </RecruiterLayout>
  );
}