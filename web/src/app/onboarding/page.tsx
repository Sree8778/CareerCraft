'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { API_BASE } from '@/lib/api';
import {
  Sparkles, Key, Upload, Check, ChevronRight, ChevronLeft,
  Eye, EyeOff, Loader2, User, Phone, MapPin, FileText,
  Brain, Edit3, ExternalLink, ChevronDown, CheckCircle2,
  Briefcase, X, AlertCircle,
} from 'lucide-react';

const INPUT = 'flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-500 focus:outline-none';

// ─── Provider config ──────────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id: 'gemini',
    provider: 'Gemini',
    name: 'Gemini',
    badge: 'Free • Recommended',
    badgeColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    accent: '#4285F4',
    description: 'Used for resume parsing and AI-powered features. Free tier available with generous limits.',
    placeholder: 'AIza...',
    steps: [
      { text: 'Go to', link: 'https://aistudio.google.com/apikey', label: 'aistudio.google.com/apikey' },
      { text: 'Sign in with your Google account' },
      { text: 'Click "Create API key" and select a project' },
      { text: 'Copy the generated key and paste it here' },
    ],
  },
  {
    id: 'groq',
    provider: 'Groq',
    name: 'Groq',
    badge: 'Free • Ultra-fast',
    badgeColor: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
    accent: '#F55036',
    description: 'Lightning-fast inference for real-time AI chat and screening features.',
    placeholder: 'gsk_...',
    steps: [
      { text: 'Go to', link: 'https://console.groq.com', label: 'console.groq.com' },
      { text: 'Sign up or log in to your Groq account' },
      { text: 'Navigate to "API Keys" in the left sidebar' },
      { text: 'Click "Create API Key", name it, and copy it here' },
    ],
  },
  {
    id: 'openai',
    provider: 'OpenAI',
    name: 'OpenAI',
    badge: 'Paid',
    badgeColor: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
    accent: '#10A37F',
    description: 'GPT-4o access for advanced reasoning, job matching, and cover letter generation.',
    placeholder: 'sk-...',
    steps: [
      { text: 'Go to', link: 'https://platform.openai.com/api-keys', label: 'platform.openai.com/api-keys' },
      { text: 'Sign in to your OpenAI account' },
      { text: 'Click "Create new secret key" and name it' },
      { text: 'Copy the key immediately (it won\'t be shown again)' },
    ],
  },
  {
    id: 'anthropic',
    provider: 'Anthropic',
    name: 'Anthropic',
    badge: 'Paid',
    badgeColor: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
    accent: '#CC785C',
    description: 'Claude models for nuanced resume writing, career coaching, and cover letters.',
    placeholder: 'sk-ant-...',
    steps: [
      { text: 'Go to', link: 'https://console.anthropic.com/settings/keys', label: 'console.anthropic.com' },
      { text: 'Sign in or create an Anthropic account' },
      { text: 'Go to Settings → API Keys' },
      { text: 'Click "Create Key", name it, and copy it here' },
    ],
  },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // Step — candidates: 0-5, recruiters: 0-3
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // API keys
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [keyStatus, setKeyStatus] = useState<Record<string, 'idle' | 'verifying' | 'valid' | 'invalid'>>({});
  const [expandedGuide, setExpandedGuide] = useState<string | null>('gemini');

  // Resume
  const fileRef = useRef<HTMLInputElement>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, any> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Profile
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [jobTypes, setJobTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/');
    if (user) setFullName(user.name || '');
  }, [loading, isAuthenticated, user, router]);

  const isCandidate = user?.role === 'candidate';

  // ── Steps display ──
  const candidateVisualSteps = ['Welcome', 'AI Keys', 'Resume', 'Profile', 'Launch'];
  const recruiterVisualSteps = ['Welcome', 'Profile', 'Company', 'Launch'];
  const visualSteps = isCandidate ? candidateVisualSteps : recruiterVisualSteps;

  // Map internal step index → visual step index for progress bar
  const visualStep = isCandidate
    ? (step === 3 ? 2 : step > 3 ? step - 1 : step)
    : step;

  // ── Key helpers ──
  const setKey = (id: string, val: string) => {
    setApiKeys(p => ({ ...p, [id]: val }));
    setKeyStatus(p => ({ ...p, [id]: 'idle' }));
  };

  const verifyKey = async (p: typeof PROVIDERS[0]) => {
    const key = (apiKeys[p.id] || '').trim();
    if (!key) { toast.error('Enter a key to verify'); return; }
    setKeyStatus(prev => ({ ...prev, [p.id]: 'verifying' }));
    try {
      const res = await fetch(`${API_BASE}/vault/verify-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p.provider, key }),
      });
      const data = await res.json();
      if (data.valid) {
        setKeyStatus(prev => ({ ...prev, [p.id]: 'valid' }));
        toast.success(data.message || `${p.name} key verified!`);
      } else {
        setKeyStatus(prev => ({ ...prev, [p.id]: 'invalid' }));
        toast.error(data.error || 'Invalid key');
      }
    } catch {
      setKeyStatus(prev => ({ ...prev, [p.id]: 'invalid' }));
      toast.error('Could not reach verification server');
    }
  };

  // ── Resume parse ──
  const parseResume = async (skip = false): Promise<boolean> => {
    if (skip || !resumeFile) {
      setStep(4);
      return false;
    }
    setParsing(true);
    setParseError(null);
    const geminiKey = (apiKeys['gemini'] || '').trim();
    const fd = new FormData();
    fd.append('file', resumeFile);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer mock_token_for_${user!.id}`,
      };
      if (geminiKey) headers['X-Gemini-API-Key'] = geminiKey;
      const res = await fetch(`${API_BASE}/parse-resume`, { method: 'POST', headers, body: fd });
      const data = await res.json();
      if (res.ok && !data.error) {
        setParsedData(data);
        setParsing(false);
        setStep(3); // fill choice
        return true;
      }
      setParseError(data.error || 'Parse failed');
      setParsing(false);
      setStep(4); // skip to manual
      return false;
    } catch (e: any) {
      setParseError(e.message || 'Network error');
      setParsing(false);
      setStep(4);
      return false;
    }
  };

  // ── Auto-fill profile from parsed resume ──
  const applyAutoFill = () => {
    if (!parsedData) return;
    const d = parsedData;
    const name = d.name || d.fullName || d.personal?.name || '';
    const ph = d.phone || d.personal?.phone || '';
    const loc = d.location || d.personal?.location || d.personal?.address || '';
    const summary = d.summary || d.personal?.summary || d.objective || '';
    if (name) setFullName(name);
    if (ph) setPhone(ph);
    if (loc) setLocation(loc);
    if (summary) setBio(summary);
    setStep(4);
    toast.success('Profile auto-filled from your resume!');
  };

  const toggleJobType = (t: string) =>
    setJobTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  // ── Final save ──
  const finish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Build wallet from entered keys
      const wallet = PROVIDERS
        .filter(p => apiKeys[p.id]?.trim())
        .map(p => ({ id: p.id, provider: p.provider, key: apiKeys[p.id].trim(), status: 'Active' }));

      // Call backend to encrypt keys + save profile
      await fetch(`${API_BASE}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.id,
          fullName: fullName || user.name,
          email: user.email,
          phone,
          role: user.role,
          apiKeysWallet: wallet,
          resumeProfile: parsedData || null,
          location,
          bio,
          jobPreferences: jobTypes,
          organizationName: orgName,
          industry,
        }),
      });

      // Mark onboarding complete
      await setDoc(doc(db, 'users', user.id), {
        fullName: fullName || user.name,
        phone, location, bio,
        organizationName: orgName,
        industry,
        jobPreferences: jobTypes,
        onboardingCompleted: true,
        hasApiKeys: wallet.length > 0,
      }, { merge: true });
    } catch { /* non-fatal */ }
    localStorage.setItem(`onboarding_done_${user.id}`, '1');
    toast.success('Profile ready! Welcome to CareerCraft.');
    router.push(user.role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard');
    setSaving(false);
  };

  if (loading || !user) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080b14] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {visualSteps.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                i === visualStep
                  ? 'bg-indigo-600 text-white'
                  : i < visualStep
                    ? 'bg-emerald-600/30 text-emerald-400'
                    : 'bg-white/5 text-zinc-500'
              }`}>
                {i < visualStep ? <Check className="w-3 h-3" /> : null}
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < visualSteps.length - 1 && (
                <div className={`w-6 h-px ${i < visualStep ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 0 — Welcome ─────────────────────────────────────────────── */}
          {step === 0 && (
            <Slide key="s0">
              <div className="text-center space-y-6">
                <GradIcon><Sparkles className="w-8 h-8 text-white" /></GradIcon>
                <div className="space-y-2">
                  <h1 className="text-2xl font-black text-white">Welcome to CareerCraft, {user.name}!</h1>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
                    {isCandidate
                      ? "Let's set up your profile and connect your AI tools so CareerCraft can personalize every feature for you."
                      : "Let's set up your company profile so candidates can find and trust you."}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(isCandidate
                    ? ['AI-powered', '~3 minutes', 'Private & secure']
                    : ['Company profile', '~2 minutes', 'Private & secure']
                  ).map(tag => (
                    <div key={tag} className="bg-white/5 border border-white/5 rounded-xl py-2 text-[11px] text-zinc-400 font-medium">{tag}</div>
                  ))}
                </div>
                <Btn onClick={() => setStep(1)}>Let's go <ChevronRight className="w-4 h-4" /></Btn>
              </div>
            </Slide>
          )}

          {/* ── STEP 1 — API Keys (candidates) / Profile (recruiters) ────────── */}
          {step === 1 && isCandidate && (
            <Slide key="s1-c">
              <StepHeader
                icon={<Key className="w-5 h-5 text-indigo-400" />}
                title="Connect Your AI Providers"
                sub="Your keys are encrypted on our servers. At least one is recommended for AI features."
              />
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                {PROVIDERS.map(p => (
                  <ProviderCard
                    key={p.id}
                    provider={p}
                    value={apiKeys[p.id] || ''}
                    onChange={v => setKey(p.id, v)}
                    show={showKey[p.id] || false}
                    onToggleShow={() => setShowKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    status={keyStatus[p.id] || 'idle'}
                    onVerify={() => verifyKey(p)}
                    expanded={expandedGuide === p.id}
                    onToggleGuide={() => setExpandedGuide(prev => prev === p.id ? null : p.id)}
                  />
                ))}
              </div>
              <NavRow
                onBack={() => setStep(0)}
                onNext={() => setStep(2)}
                nextLabel="Continue"
                nextSub="Skip"
                onSkip={() => setStep(2)}
              />
            </Slide>
          )}

          {step === 1 && !isCandidate && (
            <Slide key="s1-r">
              <StepHeader icon={<User className="w-5 h-5 text-indigo-400" />} title="Your Profile" sub="Fill in the basics — you can always update these later." />
              <ProfileFields fullName={fullName} setFullName={setFullName} phone={phone} setPhone={setPhone} location={location} setLocation={setLocation} bio={bio} setBio={setBio} />
              <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Continue" />
            </Slide>
          )}

          {/* ── STEP 2 — Resume Upload (candidates) / Company (recruiters) ──── */}
          {step === 2 && isCandidate && (
            <Slide key="s2-c">
              <StepHeader
                icon={<Upload className="w-5 h-5 text-indigo-400" />}
                title="Upload Your Resume"
                sub="We'll use your AI key to parse it and auto-fill your profile in seconds."
              />
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) { setResumeFile(f); setParseError(null); }
                }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : resumeFile
                      ? 'border-emerald-500/60 bg-emerald-500/5'
                      : 'border-white/10 hover:border-indigo-500/40 hover:bg-white/3'
                }`}
              >
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setResumeFile(f); setParseError(null); } }} />
                {resumeFile ? (
                  <div className="space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                    <p className="text-white font-semibold text-sm">{resumeFile.name}</p>
                    <p className="text-zinc-500 text-xs">{(resumeFile.size / 1024).toFixed(0)} KB · Click to change</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
                    <div>
                      <p className="text-white font-semibold text-sm">Drop your resume here</p>
                      <p className="text-zinc-500 text-xs mt-1">PDF, DOC, DOCX — up to 10 MB</p>
                    </div>
                    <span className="inline-block text-xs font-semibold text-indigo-400 border border-indigo-500/40 rounded-lg px-4 py-1.5">
                      Choose File
                    </span>
                  </div>
                )}
              </div>

              {parseError && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {parseError} — switched to manual entry.
                </div>
              )}

              {!apiKeys['gemini']?.trim() && (
                <p className="text-xs text-amber-400/80 text-center">
                  Tip: add a Gemini key in the previous step to enable AI parsing.
                </p>
              )}

              <div className="flex gap-3">
                <BackBtn onClick={() => setStep(1)} />
                <button onClick={() => parseResume(true)}
                  className="px-4 py-3 text-xs text-zinc-400 border border-white/5 rounded-xl hover:text-white transition">
                  Skip
                </button>
                <button
                  onClick={() => parsing ? null : parseResume(false)}
                  disabled={!resumeFile || parsing}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition"
                >
                  {parsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</> : <>Parse & Continue <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
            </Slide>
          )}

          {step === 2 && !isCandidate && (
            <Slide key="s2-r">
              <StepHeader icon={<Briefcase className="w-5 h-5 text-indigo-400" />} title="Your Company" sub="Tell candidates about your organization." />
              <div className="space-y-4">
                <Field icon={<Briefcase className="w-4 h-4 text-zinc-500" />}>
                  <input value={orgName} onChange={e => setOrgName(e.target.value)} className={INPUT} placeholder="Acme Corp" />
                </Field>
                <Field icon={<FileText className="w-4 h-4 text-zinc-500" />}>
                  <input value={industry} onChange={e => setIndustry(e.target.value)} className={INPUT} placeholder="Software / SaaS" />
                </Field>
              </div>
              <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Continue" />
            </Slide>
          )}

          {/* ── STEP 3 — Fill Choice (candidates only) ───────────────────────── */}
          {step === 3 && isCandidate && (
            <Slide key="s3">
              <div className="space-y-5">
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">Resume parsed!</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {parsedData?.name || parsedData?.personal?.name ? `Found: ${parsedData.name || parsedData.personal?.name}` : 'Profile data extracted'}
                      {parsedData?.experience?.length ? ` · ${parsedData.experience.length} job(s)` : ''}
                      {parsedData?.education?.length ? ` · ${parsedData.education.length} degree(s)` : ''}
                    </p>
                  </div>
                </div>

                <p className="text-center text-xs text-zinc-500 font-semibold uppercase tracking-widest">How would you like to fill your profile?</p>

                <button onClick={applyAutoFill}
                  className="w-full p-5 rounded-2xl border border-indigo-500/40 bg-indigo-600/10 hover:bg-indigo-600/20 transition text-left flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/30 flex items-center justify-center shrink-0 group-hover:bg-indigo-600/50 transition">
                    <Brain className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Auto-fill from Resume</p>
                    <p className="text-xs text-zinc-400 mt-1">Instantly populate your profile with the data extracted from your resume. You can review and edit everything.</p>
                  </div>
                </button>

                <button onClick={() => setStep(4)}
                  className="w-full p-5 rounded-2xl border border-white/10 bg-white/3 hover:bg-white/5 transition text-left flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition">
                    <Edit3 className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Enter Manually</p>
                    <p className="text-xs text-zinc-400 mt-1">Fill in your profile details yourself — takes about 2 minutes.</p>
                  </div>
                </button>
              </div>
            </Slide>
          )}

          {/* ── STEP 4 — Profile fill (candidates) ───────────────────────────── */}
          {step === 4 && isCandidate && (
            <Slide key="s4">
              <StepHeader icon={<User className="w-5 h-5 text-indigo-400" />} title="Your Profile" sub="Review and complete your details." />
              <ProfileFields
                fullName={fullName} setFullName={setFullName}
                phone={phone} setPhone={setPhone}
                location={location} setLocation={setLocation}
                bio={bio} setBio={setBio}
              />
              <div className="space-y-3 pt-1">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Job Preferences</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {['Full-time', 'Part-time', 'Contract', 'Remote', 'Hybrid', 'Internship'].map(t => (
                    <button key={t} type="button" onClick={() => toggleJobType(t)}
                      className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition ${
                        jobTypes.includes(t)
                          ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-300'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/20'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <NavRow onBack={() => setStep(parsedData ? 3 : 2)} onNext={() => setStep(5)} nextLabel="Continue" />
            </Slide>
          )}

          {/* ── STEP 3 (recruiter) — Launch ───────────────────────────────────── */}
          {step === 3 && !isCandidate && (
            <Slide key="s3-r">
              <LaunchStep role="recruiter" saving={saving} onFinish={finish} />
            </Slide>
          )}

          {/* ── STEP 5 (candidate) — Launch ───────────────────────────────────── */}
          {step === 5 && isCandidate && (
            <Slide key="s5">
              <LaunchStep role="candidate" saving={saving} onFinish={finish} />
            </Slide>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.2 }}
      className="bg-[#111827] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl"
    >
      {children}
    </motion.div>
  );
}

function GradIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center">
      {children}
    </div>
  );
}

function StepHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xl font-black text-white">{title}</h2>
      </div>
      <p className="text-zinc-400 text-sm">{sub}</p>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 gap-3 focus-within:border-indigo-500/50 transition">
      {icon}
      {children}
    </div>
  );
}

function ProfileFields({ fullName, setFullName, phone, setPhone, location, setLocation, bio, setBio }: {
  fullName: string; setFullName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  location: string; setLocation: (v: string) => void;
  bio: string; setBio: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Field icon={<User className="w-4 h-4 text-zinc-500 shrink-0" />}>
        <input value={fullName} onChange={e => setFullName(e.target.value)} className={INPUT} placeholder="Jane Doe" />
      </Field>
      <Field icon={<Phone className="w-4 h-4 text-zinc-500 shrink-0" />}>
        <input value={phone} onChange={e => setPhone(e.target.value)} className={INPUT} placeholder="+1 555 000 0000" />
      </Field>
      <Field icon={<MapPin className="w-4 h-4 text-zinc-500 shrink-0" />}>
        <input value={location} onChange={e => setLocation(e.target.value)} className={INPUT} placeholder="Miami, FL" />
      </Field>
      <div className="flex items-start bg-white/5 border border-white/10 rounded-xl px-4 py-3 gap-3 focus-within:border-indigo-500/50 transition">
        <FileText className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
        <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
          className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none resize-none"
          placeholder="Brief intro about yourself..." />
      </div>
    </div>
  );
}

function Btn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition">
      {children}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-4 py-3 rounded-xl border border-white/5 transition">
      <ChevronLeft className="w-3.5 h-3.5" /> Back
    </button>
  );
}

function NavRow({
  onBack, onNext, nextLabel, onSkip, nextSub, disabled,
}: {
  onBack: () => void; onNext: () => void; nextLabel: string;
  onSkip?: () => void; nextSub?: string; disabled?: boolean;
}) {
  return (
    <div className="flex gap-3 pt-1">
      <BackBtn onClick={onBack} />
      {onSkip && (
        <button onClick={onSkip} className="px-4 py-3 text-xs text-zinc-400 border border-white/5 rounded-xl hover:text-white transition">
          {nextSub || 'Skip'}
        </button>
      )}
      <button onClick={onNext} disabled={disabled}
        className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition">
        {nextLabel} <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function LaunchStep({ role, saving, onFinish }: { role: string; saving: boolean; onFinish: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-600 to-cyan-500 flex items-center justify-center">
        <Check className="w-8 h-8 text-white" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-white">You're all set!</h2>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
          {role === 'recruiter'
            ? 'Head to your dashboard to post your first job and start sourcing talent.'
            : 'Head to your dashboard to browse jobs, match your resume to roles, and schedule AI interviews.'}
        </p>
      </div>
      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 text-left space-y-1">
        <p className="text-xs font-bold text-indigo-300">
          {role === 'recruiter' ? '→ Next: Post your first job' : '→ Next: Browse matched jobs'}
        </p>
        <p className="text-xs text-zinc-500">
          {role === 'recruiter'
            ? 'AI will surface the best-matching candidates automatically.'
            : 'Your AI keys power ATS scoring, interview prep, and resume tailoring.'}
        </p>
      </div>
      <button onClick={onFinish} disabled={saving}
        className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <>Launch Dashboard <ChevronRight className="w-4 h-4" /></>}
      </button>
    </div>
  );
}

// ─── Provider card ────────────────────────────────────────────────────────────

type ProviderCardProps = {
  provider: typeof PROVIDERS[0];
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  status: 'idle' | 'verifying' | 'valid' | 'invalid';
  onVerify: () => void;
  expanded: boolean;
  onToggleGuide: () => void;
};

function ProviderCard({ provider: p, value, onChange, show, onToggleShow, status, onVerify, expanded, onToggleGuide }: ProviderCardProps) {
  const statusIcon = {
    idle: null,
    verifying: <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />,
    valid: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    invalid: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  }[status];

  const borderColor = status === 'valid'
    ? 'border-emerald-500/40'
    : status === 'invalid'
      ? 'border-red-500/30'
      : 'border-white/8';

  return (
    <div className={`rounded-2xl border bg-white/3 transition ${borderColor}`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white"
              style={{ background: p.accent + '33', border: `1px solid ${p.accent}44` }}>
              {p.name[0]}
            </div>
            <span className="text-sm font-bold text-white">{p.name}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.badgeColor}`}>{p.badge}</span>
          </div>
          {statusIcon}
        </div>

        <p className="text-xs text-zinc-500">{p.description}</p>

        {/* Key input */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-black/30 border border-white/10 rounded-xl px-3 gap-2 focus-within:border-indigo-500/50 transition">
            <input
              type={show ? 'text' : 'password'}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={p.placeholder}
              className="flex-1 bg-transparent py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
            />
            <button onClick={onToggleShow} className="text-zinc-500 hover:text-zinc-300 transition shrink-0">
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={onVerify}
            disabled={status === 'verifying' || !value.trim()}
            className="px-3 py-2.5 text-xs font-semibold rounded-xl border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-40 transition whitespace-nowrap"
          >
            {status === 'verifying' ? 'Checking…' : 'Verify'}
          </button>
        </div>

        {/* How-to guide toggle */}
        <button
          onClick={onToggleGuide}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition w-full text-left"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          How to get this key
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ol className="space-y-2 pt-1">
                {p.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs">
                    <span className="w-4 h-4 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-zinc-400">
                      {s.text}{' '}
                      {s.link && (
                        <a href={s.link} target="_blank" rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5">
                          {s.label} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
