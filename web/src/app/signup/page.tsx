'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ShieldCheck, Mail, Phone, Lock, User,
  ChevronRight, ChevronLeft, RefreshCw, ArrowLeft,
  KeyRound, Eye, EyeOff, Award, Briefcase, GraduationCap,
  Check, Trash2, PlusCircle, Volume2, ShieldAlert, AlertCircle,
  FileText, Upload, Brain, Edit3, CheckCircle2, ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast, Toaster } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { encryptApiKey } from '@/lib/crypto';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'credentials' | 'api-wallet' | 'resume' | 'fill-choice' | 'education' | 'experience' | 'skills' | 'consent';
type Provider = 'Gemini' | 'Groq' | 'OpenAI' | 'Claude' | 'NVIDIA NIM';

interface ApiKeyEntry { id: string; provider: Provider; key: string; status: 'Active' | 'Standby' }
interface EducationEntry { id: string; institution: string; degree: string; gradYear: string; gpa: string; achievements: string }
interface ExperienceEntry { id: string; title: string; company: string; location: string; dates: string; description: string }

// ─── Provider guides ──────────────────────────────────────────────────────────

const PROVIDER_GUIDES: Record<Provider, { steps: { text: string; link?: string; label?: string }[] }> = {
  Gemini: {
    steps: [
      { text: 'Go to', link: 'https://aistudio.google.com/apikey', label: 'aistudio.google.com/apikey' },
      { text: 'Sign in with your Google account' },
      { text: 'Click "Create API key" and select a project' },
      { text: 'Copy and paste the generated key' },
    ],
  },
  Groq: {
    steps: [
      { text: 'Go to', link: 'https://console.groq.com', label: 'console.groq.com' },
      { text: 'Sign up or log in to your account' },
      { text: 'Go to API Keys in the sidebar' },
      { text: 'Click "Create API Key" and copy it' },
    ],
  },
  OpenAI: {
    steps: [
      { text: 'Go to', link: 'https://platform.openai.com/api-keys', label: 'platform.openai.com/api-keys' },
      { text: 'Sign in to your OpenAI account' },
      { text: 'Click "Create new secret key"' },
      { text: 'Copy immediately — it won\'t be shown again' },
    ],
  },
  Claude: {
    steps: [
      { text: 'Go to', link: 'https://console.anthropic.com/settings/keys', label: 'console.anthropic.com' },
      { text: 'Sign in or create an Anthropic account' },
      { text: 'Go to Settings → API Keys' },
      { text: 'Click "Create Key" and copy it' },
    ],
  },
  'NVIDIA NIM': {
    steps: [
      { text: 'Go to', link: 'https://build.nvidia.com', label: 'build.nvidia.com' },
      { text: 'Sign in or create a free NVIDIA account' },
      { text: 'Open any model (e.g. Llama 3.1) and click "Get API Key"' },
      { text: 'Copy the key starting with nvapi-…' },
    ],
  },
};

// ─── API base (uses env var, not hardcoded localhost) ─────────────────────────

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

// ─── Step progress widths ─────────────────────────────────────────────────────

function progressWidth(step: WizardStep, isRecruiter: boolean) {
  if (isRecruiter) {
    return { credentials: '33%', 'api-wallet': '66%', consent: '100%' }[step] ?? '66%';
  }
  return {
    credentials: '12%', 'api-wallet': '25%', resume: '37%',
    'fill-choice': '37%', education: '54%', experience: '67%',
    skills: '82%', consent: '100%',
  }[step] ?? '12%';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SignupWizard() {
  const router = useRouter();
  const { login } = useAuth();
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<WizardStep>('credentials');

  // Step 1 — credentials
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', confirmPassword: '', phone: '' });

  // Step 2 — API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('Gemini');
  const [inputApiKey, setInputApiKey] = useState('');
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [expandedGuide, setExpandedGuide] = useState<Provider | null>('Gemini');

  // Step 3 — Resume
  const fileRef = useRef<HTMLInputElement>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, any> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Steps 4-6 — manual profile
  const [educations, setEducations] = useState<EducationEntry[]>([]);
  const [eduForm, setEduForm] = useState({ institution: '', degree: '', gradYear: '', gpa: '', achievements: '' });
  const [experiences, setExperiences] = useState<ExperienceEntry[]>([]);
  const [expForm, setExpForm] = useState({ title: '', company: '', location: '', dates: '', description: '' });
  const [skills, setSkills] = useState<string[]>([]);
  const [inputSkill, setInputSkill] = useState('');
  const [bio, setBio] = useState('');

  const popularSkills = ['React', 'Next.js', 'TypeScript', 'Node.js', 'Python', 'Machine Learning', 'Product Management', 'SQL', 'Figma', 'System Design'];

  // ── password strength ──
  const pwStrength = (() => {
    const pw = formData.password;
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  })();
  const pwLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwStrength];
  const pwColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'][pwStrength];

  // ── API key handlers ──
  const handleAddApiKey = async () => {
    setVerificationError(null);
    const keyVal = inputApiKey.trim();
    if (!keyVal) { toast.error('Please enter a valid API key.'); return; }
    setIsVerifyingKey(true);
    const toastId = toast.loading(`Verifying ${selectedProvider} key...`);
    try {
      const res = await fetch(`${API}/vault/verify-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, key: keyVal }),
      });
      const result = await res.json();
      if (result.valid) {
        const entry: ApiKeyEntry = { id: Math.random().toString(36).slice(2, 9), provider: selectedProvider, key: keyVal, status: apiKeys.length === 0 ? 'Active' : 'Standby' };
        setApiKeys(prev => [...prev, entry]);
        setInputApiKey('');
        toast.success(`${selectedProvider} key verified and added!`, { id: toastId });
      } else {
        setVerificationError(result.error || `Invalid key for ${selectedProvider}.`);
        toast.error('Key verification failed.', { id: toastId });
      }
    } catch {
      toast.dismiss(toastId);
      const entry: ApiKeyEntry = { id: Math.random().toString(36).slice(2, 9), provider: selectedProvider, key: keyVal, status: apiKeys.length === 0 ? 'Active' : 'Standby' };
      setApiKeys(prev => [...prev, entry]);
      setInputApiKey('');
      toast.info('Could not verify — key added as unverified.');
    } finally { setIsVerifyingKey(false); }
  };

  const removeApiKey = (id: string) => {
    setApiKeys(prev => {
      const next = prev.filter(k => k.id !== id);
      if (next.length > 0 && !next.some(k => k.status === 'Active')) next[0].status = 'Active';
      return next;
    });
  };

  // ── resume parse ──
  const parseResume = async () => {
    if (!resumeFile) { setStep('education'); return; }
    setParsing(true);
    setParseError(null);
    const fd = new FormData();
    fd.append('file', resumeFile);
    try {
      const headers: Record<string, string> = { Authorization: 'Bearer mock_token_for_signup' };
      // Send the full key wallet so the backend uses the user's own keys (BYOK)
      if (apiKeys.length > 0) {
        headers['X-API-Wallet'] = JSON.stringify(
          apiKeys.map(k => ({ id: k.id, provider: k.provider, key: k.key, status: k.status }))
        );
      }
      // Legacy Gemini header for backwards compat with older backend hook
      const geminiKey = apiKeys.find(k => k.provider === 'Gemini')?.key?.trim() ?? '';
      if (geminiKey) headers['X-Gemini-API-Key'] = geminiKey;
      const res = await fetch(`${API}/parse-resume`, { method: 'POST', headers, body: fd });
      const data = await res.json();
      if (res.ok && !data.error) {
        setParsedData(data.parsedData ?? data);
        if (data.aiEnhanced === false && data.aiSkippedReason === 'no_api_keys') {
          toast.info('Resume parsed with basic extraction. Add an API key above for AI-enhanced parsing.');
        }
        setStep('fill-choice');
      } else {
        setParseError(data.error || 'Could not parse resume.');
        setStep('education');
      }
    } catch (e: any) {
      setParseError(e.message || 'Network error during parsing.');
      setStep('education');
    } finally { setParsing(false); }
  };

  // ── auto-fill from parsed resume ──
  const applyAutoFill = () => {
    if (!parsedData) return;
    const p = parsedData.personal ?? {};
    if (p.name && !formData.fullName) setFormData(prev => ({ ...prev, fullName: p.name }));
    if (p.phone && !formData.phone) setFormData(prev => ({ ...prev, phone: p.phone }));
    if (parsedData.summary) setBio(parsedData.summary);
    if (Array.isArray(parsedData.education)) {
      setEducations(parsedData.education.map((e: any, i: number) => ({
        id: `edu-${i}`, institution: e.institution || '', degree: e.degree || '',
        gradYear: e.graduationYear || '', gpa: e.gpa || '', achievements: e.achievements || '',
      })));
    }
    if (Array.isArray(parsedData.experience)) {
      setExperiences(parsedData.experience.map((e: any, i: number) => ({
        id: `exp-${i}`, title: e.jobTitle || e.title || '', company: e.company || '',
        location: e.location || '', dates: e.dates || '', description: e.description || '',
      })));
    }
    if (Array.isArray(parsedData.skills)) {
      const allSkills = parsedData.skills.flatMap((s: any) =>
        typeof s === 'string' ? [s] : (s.skills_list ?? '').split(',').map((x: string) => x.trim())
      ).filter(Boolean);
      setSkills(allSkills.slice(0, 20));
    }
    toast.success('Profile auto-filled from your resume!');
    setStep('consent');
  };

  // ── education ──
  const addEducation = () => {
    if (!eduForm.institution.trim() || !eduForm.degree.trim()) { toast.error('Institution and degree are required.'); return; }
    setEducations(prev => [...prev, { id: Math.random().toString(36).slice(2, 9), ...eduForm }]);
    setEduForm({ institution: '', degree: '', gradYear: '', gpa: '', achievements: '' });
  };

  // ── experience ──
  const addExperience = () => {
    if (!expForm.title.trim() || !expForm.company.trim()) { toast.error('Title and company are required.'); return; }
    setExperiences(prev => [...prev, { id: Math.random().toString(36).slice(2, 9), ...expForm }]);
    setExpForm({ title: '', company: '', location: '', dates: '', description: '' });
  };

  // ── step navigation ──
  const nextStep = () => {
    if (step === 'credentials') {
      if (!formData.fullName.trim() || !formData.email.trim() || !formData.password) { toast.error('Name, email and password are required.'); return; }
      if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match.'); return; }
      if (formData.password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
      setStep('api-wallet');
    } else if (step === 'api-wallet') {
      setStep(isRecruiter ? 'consent' : 'resume');
    } else if (step === 'resume') {
      parseResume();
    } else if (step === 'fill-choice') {
      setStep('education');
    } else if (step === 'education') {
      setStep('experience');
    } else if (step === 'experience') {
      setStep('skills');
    } else if (step === 'skills') {
      setStep('consent');
    }
  };

  const prevStep = () => {
    if (step === 'api-wallet') setStep('credentials');
    else if (step === 'resume') setStep('api-wallet');
    else if (step === 'fill-choice') setStep('resume');
    else if (step === 'education') setStep(parsedData ? 'fill-choice' : 'resume');
    else if (step === 'experience') setStep('education');
    else if (step === 'skills') setStep('experience');
    else if (step === 'consent') setStep(isRecruiter ? 'api-wallet' : 'skills');
  };

  // ── finalize ──
  const handleCompleteSignup = async () => {
    setIsLoading(true);
    const isMockFirebase = !auth.app.options.apiKey || auth.app.options.apiKey.startsWith('mock');
    try {
      let uid = 'mock_uid_' + Math.floor(Math.random() * 900000 + 100000);
      if (!isMockFirebase) {
        const cred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        uid = cred.user.uid;
      }

      const resumeProfile = isRecruiter ? null : {
        personal: { name: formData.fullName, email: formData.email, phone: formData.phone, location: experiences[0]?.location || '' },
        summary: bio,
        education: educations.map(e => ({ id: e.id, degree: e.degree, institution: e.institution, graduationYear: e.gradYear, gpa: e.gpa, achievements: e.achievements })),
        experience: experiences.map(e => ({ id: e.id, jobTitle: e.title, company: e.company, dates: e.dates, description: e.description })),
        skills: [{ id: 'skills-primary', category: 'Core Competencies', skills_list: skills.join(', ') }],
      };

      // Send to backend vault (encrypts keys server-side)
      await fetch(`${API}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer mock_token_for_${uid}` },
        body: JSON.stringify({
          uid, fullName: formData.fullName, email: formData.email, phone: formData.phone,
          role: isRecruiter ? 'recruiter' : 'candidate',
          apiKeysWallet: apiKeys.map(k => ({ id: k.id, provider: k.provider, key: k.key, status: k.status })),
          resumeProfile,
        }),
      });

      // Save onboarding complete to Firestore
      if (!isMockFirebase) {
        await setDoc(doc(db, 'users', uid), {
          uid, fullName: formData.fullName, email: formData.email, phone: formData.phone,
          role: isRecruiter ? 'recruiter' : 'candidate',
          onboardingCompleted: false, hasApiKeys: apiKeys.length > 0,
          createdAt: new Date().toISOString(),
        }, { merge: true });
      }

      // Store encrypted Gemini key for frontend use
      const geminiKey = apiKeys.find(k => k.provider === 'Gemini')?.key;
      if (geminiKey && uid) {
        try {
          const encrypted = await encryptApiKey(geminiKey, uid);
          localStorage.setItem('user_gemini_api_key', encrypted);
        } catch { /* non-fatal */ }
      }
      if (apiKeys.length > 0) {
        localStorage.setItem('user_api_keys_wallet', JSON.stringify(apiKeys.map(k => ({ ...k, key: '***' }))));
      }

      login({ id: uid, email: formData.email, name: formData.fullName, role: isRecruiter ? 'recruiter' : 'candidate', avatar: '' });
      toast.success('Account created! Setting up your dashboard…');
      router.push('/onboarding');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed.');
    } finally { setIsLoading(false); }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="min-h-screen bg-black text-white relative overflow-hidden flex flex-col justify-center items-center py-12 px-4">
      <Toaster position="top-right" richColors />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#6366F1]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#06B6D4]/10 rounded-full blur-[120px] pointer-events-none" />

      <Link href="/" className="absolute top-6 left-6 text-zinc-400 hover:text-white flex items-center gap-1.5 text-sm transition">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="mb-8 text-center space-y-2">
          <div className="inline-flex p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Create Your Account
          </h1>
          <p className="text-xs text-zinc-500">Connect your AI tools and build your career profile</p>

          {/* Progress bar */}
          <div className="max-w-md mx-auto pt-4">
            <div className="h-1.5 w-full bg-zinc-900 border border-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500"
                animate={{ width: progressWidth(step, isRecruiter) }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-zinc-600 pt-1.5 px-0.5">
              <span>Basics</span>
              <span>AI Keys</span>
              {!isRecruiter && <><span>Resume</span><span>Education</span><span>Experience</span><span>Skills</span></>}
              <span>Done</span>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#0B0F19]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: CREDENTIALS ─────────────────────────────────────── */}
            {step === 'credentials' && (
              <StepSlide key="credentials">
                <StepTitle icon={<User className="w-5 h-5 text-indigo-400" />} title="Account Details" sub="Create your login credentials." />

                {/* Role toggle */}
                <div className="grid grid-cols-2 p-1.5 bg-black/60 border border-white/5 rounded-2xl max-w-sm mx-auto relative">
                  {(['Candidate', 'Recruiter'] as const).map((role, i) => (
                    <button key={role} onClick={() => setIsRecruiter(i === 1)}
                      className={`py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 relative z-10 ${isRecruiter === (i === 1) ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      {i === 0 ? <User className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />} {role}
                    </button>
                  ))}
                  <motion.div layoutId="roleSignup"
                    className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-indigo-600 rounded-xl -z-0"
                    animate={{ x: isRecruiter ? '100%' : '0%' }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200 }} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldWrap label="Full Name *" className="md:col-span-2">
                    <FieldIcon icon={<User className="w-4 h-4 text-zinc-500" />}>
                      <input type="text" name="fullName" value={formData.fullName} onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))} placeholder="Jane Doe" className={FI} required />
                    </FieldIcon>
                  </FieldWrap>
                  <FieldWrap label="Email Address *">
                    <FieldIcon icon={<Mail className="w-4 h-4 text-zinc-500" />}>
                      <input type="email" name="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" className={FI} required />
                    </FieldIcon>
                  </FieldWrap>
                  <FieldWrap label="Phone (optional)">
                    <FieldIcon icon={<Phone className="w-4 h-4 text-zinc-500" />}>
                      <input type="tel" name="phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" className={FI} />
                    </FieldIcon>
                  </FieldWrap>
                  <FieldWrap label="Password *">
                    <FieldIcon icon={<Lock className="w-4 h-4 text-zinc-500" />} right={
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="text-zinc-500 hover:text-white">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }>
                      <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className={FI} required />
                    </FieldIcon>
                    {formData.password && (
                      <div className="mt-2 space-y-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= pwStrength ? pwColor : 'bg-zinc-800'}`} />
                          ))}
                        </div>
                        <p className="text-[10px] text-zinc-500">{pwLabel} password</p>
                      </div>
                    )}
                  </FieldWrap>
                  <FieldWrap label="Confirm Password *">
                    <FieldIcon icon={<Lock className="w-4 h-4 text-zinc-500" />}>
                      <input type={showPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={e => setFormData(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="••••••••" className={FI} required />
                    </FieldIcon>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-[10px] text-red-400 mt-1">Passwords don't match</p>
                    )}
                  </FieldWrap>
                </div>
              </StepSlide>
            )}

            {/* ── STEP 2: API KEYS ────────────────────────────────────────── */}
            {step === 'api-wallet' && (
              <StepSlide key="api-wallet">
                <StepTitle icon={<KeyRound className="w-5 h-5 text-indigo-400" />} title="Connect Your AI Providers" sub="Add API keys to power resume parsing, job matching, and AI interviews. Encrypted on our servers." />

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-xs text-amber-300">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span><strong>Zero-risk encryption:</strong> Keys are AES-GCM encrypted server-side before storage. We never see your plain keys.</span>
                </div>

                {/* Provider selector + key input */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold font-mono text-zinc-400 uppercase">Provider</label>
                    <select value={selectedProvider} onChange={e => { setSelectedProvider(e.target.value as Provider); setExpandedGuide(e.target.value as Provider); }}
                      className="w-full py-3 px-3 bg-black border border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-zinc-200">
                      <option value="Gemini">Gemini (Recommended)</option>
                      <option value="Groq">Groq — Fast &amp; Free</option>
                      <option value="NVIDIA NIM">NVIDIA NIM — Llama 3.x</option>
                      <option value="OpenAI">OpenAI GPT-4</option>
                      <option value="Claude">Anthropic Claude</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold font-mono text-zinc-400 uppercase">Enter {selectedProvider} Key</label>
                    <div className="flex gap-2">
                      <input type="text" value={inputApiKey} onChange={e => setInputApiKey(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddApiKey()}
                        placeholder={`Paste ${selectedProvider} API key…`}
                        className="flex-1 py-3 px-4 bg-black/40 border border-white/10 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white font-mono placeholder-zinc-700"
                        disabled={isVerifyingKey} />
                      <button onClick={handleAddApiKey} disabled={isVerifyingKey || !inputApiKey.trim()} type="button"
                        className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition">
                        {isVerifyingKey ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                        {isVerifyingKey ? 'Checking…' : 'Add Key'}
                      </button>
                    </div>
                    {verificationError && (
                      <div className="flex items-center gap-1.5 text-[10px] text-rose-400 pt-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {verificationError}
                      </div>
                    )}
                  </div>
                </div>

                {/* How-to guide */}
                <div className="border border-white/8 rounded-2xl overflow-hidden">
                  <button onClick={() => setExpandedGuide(v => v === selectedProvider ? null : selectedProvider)}
                    className="w-full flex items-center justify-between px-4 py-3 text-xs text-zinc-400 hover:text-zinc-200 transition">
                    <span className="flex items-center gap-2"><ExternalLink className="w-3.5 h-3.5" /> How to get a {selectedProvider} key</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedGuide === selectedProvider ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {expandedGuide === selectedProvider && (
                      <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden px-4 pb-4 space-y-2">
                        {PROVIDER_GUIDES[selectedProvider].steps.map((s, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-xs">
                            <span className="w-4 h-4 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-zinc-400">
                              {s.text}{' '}
                              {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5">{s.label} <ExternalLink className="w-2.5 h-2.5" /></a>}
                            </span>
                          </li>
                        ))}
                      </motion.ol>
                    )}
                  </AnimatePresence>
                </div>

                {/* Added keys */}
                {apiKeys.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-wider">Added Keys ({apiKeys.length})</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                      {apiKeys.map(item => (
                        <div key={item.id} className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold font-mono text-indigo-400">{item.provider}</span>
                              <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${item.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>{item.status}</span>
                            </div>
                            <p className="font-mono text-[9px] text-zinc-600">••••••••{item.key.slice(-4)}</p>
                          </div>
                          <button onClick={() => removeApiKey(item.id)} className="text-zinc-600 hover:text-red-400 p-1.5 rounded hover:bg-white/5 transition">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {apiKeys.length === 0 && (
                  <p className="text-center text-xs text-zinc-600">You can skip this step and add keys later in Settings.</p>
                )}
              </StepSlide>
            )}

            {/* ── STEP 3: RESUME UPLOAD ───────────────────────────────────── */}
            {step === 'resume' && (
              <StepSlide key="resume">
                <StepTitle icon={<Upload className="w-5 h-5 text-indigo-400" />} title="Upload Your Resume" sub="Our parser extracts your profile instantly. AI keys enhance the results — but they're optional." />

                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setResumeFile(f); setParseError(null); } }}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                    dragOver ? 'border-indigo-500 bg-indigo-500/10' : resumeFile ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-white/10 hover:border-indigo-500/40 hover:bg-white/3'
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
                      <span className="inline-block text-xs font-semibold text-indigo-400 border border-indigo-500/40 rounded-lg px-4 py-1.5">Choose File</span>
                    </div>
                  )}
                </div>

                {parseError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {parseError} — you can fill in manually.
                  </div>
                )}

                {apiKeys.length === 0 && (
                  <p className="text-center text-xs text-amber-400/80">
                    Tip: add an API key in the previous step for AI-enhanced parsing. Rule-based parsing works without one.
                  </p>
                )}
              </StepSlide>
            )}

            {/* ── STEP 4: FILL CHOICE ─────────────────────────────────────── */}
            {step === 'fill-choice' && (
              <StepSlide key="fill-choice">
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">Resume parsed successfully!</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {parsedData?.personal?.name || parsedData?.name ? `Found: ${parsedData.personal?.name || parsedData.name}` : 'Profile data extracted'}
                      {parsedData?.experience?.length ? ` · ${parsedData.experience.length} role(s)` : ''}
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
                    <p className="text-xs text-zinc-400 mt-1">Instantly populate education, experience, and skills from your resume. You can edit everything before saving.</p>
                  </div>
                </button>

                <button onClick={() => setStep('education')}
                  className="w-full p-5 rounded-2xl border border-white/10 bg-white/3 hover:bg-white/5 transition text-left flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition">
                    <Edit3 className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Enter Manually</p>
                    <p className="text-xs text-zinc-400 mt-1">Fill in your education, experience, and skills yourself.</p>
                  </div>
                </button>
              </StepSlide>
            )}

            {/* ── STEP 5: EDUCATION ───────────────────────────────────────── */}
            {step === 'education' && (
              <StepSlide key="education">
                <StepTitle icon={<GraduationCap className="w-5 h-5 text-indigo-400" />} title="Education" sub="Add your academic background." />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-zinc-950/40 p-4 border border-white/5 rounded-2xl">
                  <SmallInput label="Institution *" value={eduForm.institution} onChange={v => setEduForm(p => ({ ...p, institution: v }))} placeholder="Stanford University" />
                  <SmallInput label="Degree / Major *" value={eduForm.degree} onChange={v => setEduForm(p => ({ ...p, degree: v }))} placeholder="B.S. Computer Science" />
                  <div className="grid grid-cols-2 gap-2">
                    <SmallInput label="Grad Year" value={eduForm.gradYear} onChange={v => setEduForm(p => ({ ...p, gradYear: v }))} placeholder="2025" />
                    <SmallInput label="GPA" value={eduForm.gpa} onChange={v => setEduForm(p => ({ ...p, gpa: v }))} placeholder="3.8" />
                  </div>
                  <div className="md:col-span-3 flex gap-2 items-end">
                    <SmallInput label="Achievements" value={eduForm.achievements} onChange={v => setEduForm(p => ({ ...p, achievements: v }))} placeholder="Dean's List, Cum Laude…" className="flex-1" />
                    <button onClick={addEducation} className="py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition shrink-0">+ Add</button>
                  </div>
                </div>
                <EntryList items={educations} onRemove={id => setEducations(p => p.filter(e => e.id !== id))}
                  render={e => <><p className="font-bold text-zinc-200 text-xs">{e.institution}</p><p className="text-[10px] text-zinc-500">{e.degree}{e.gradYear ? ` · ${e.gradYear}` : ''}{e.gpa ? ` · GPA ${e.gpa}` : ''}</p></>} />
              </StepSlide>
            )}

            {/* ── STEP 6: EXPERIENCE ──────────────────────────────────────── */}
            {step === 'experience' && (
              <StepSlide key="experience">
                <StepTitle icon={<Briefcase className="w-5 h-5 text-indigo-400" />} title="Work Experience" sub="Add your professional roles." />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-zinc-950/40 p-4 border border-white/5 rounded-2xl">
                  <SmallInput label="Job Title *" value={expForm.title} onChange={v => setExpForm(p => ({ ...p, title: v }))} placeholder="Software Engineer II" />
                  <SmallInput label="Company *" value={expForm.company} onChange={v => setExpForm(p => ({ ...p, company: v }))} placeholder="Google LLC" />
                  <SmallInput label="Dates" value={expForm.dates} onChange={v => setExpForm(p => ({ ...p, dates: v }))} placeholder="June 2023 – Present" />
                  <SmallInput label="Location" value={expForm.location} onChange={v => setExpForm(p => ({ ...p, location: v }))} placeholder="Mountain View, CA" />
                  <div className="md:col-span-2 flex gap-2 items-end">
                    <SmallInput label="Key Achievements" value={expForm.description} onChange={v => setExpForm(p => ({ ...p, description: v }))} placeholder="Led team of 5, shipped features used by 2M users…" className="flex-1" />
                    <button onClick={addExperience} className="py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition shrink-0">+ Add</button>
                  </div>
                </div>
                <EntryList items={experiences} onRemove={id => setExperiences(p => p.filter(e => e.id !== id))}
                  render={e => <><p className="font-bold text-zinc-200 text-xs">{e.title} at <span className="text-indigo-400">{e.company}</span></p><p className="text-[10px] text-zinc-500">{e.dates}{e.location ? ` · ${e.location}` : ''}</p></>} />
              </StepSlide>
            )}

            {/* ── STEP 7: SKILLS ──────────────────────────────────────────── */}
            {step === 'skills' && (
              <StepSlide key="skills">
                <StepTitle icon={<Award className="w-5 h-5 text-indigo-400" />} title="Skills & Bio" sub="Tag your core skills and write a brief professional summary." />
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input type="text" value={inputSkill} onChange={e => setInputSkill(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (inputSkill.trim() && !skills.includes(inputSkill.trim())) { setSkills(p => [...p, inputSkill.trim()]); setInputSkill(''); } } }}
                      placeholder="Type a skill and press Enter"
                      className="flex-1 p-3 bg-black border border-white/10 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 text-white placeholder-zinc-700" />
                    <button onClick={() => { if (inputSkill.trim() && !skills.includes(inputSkill.trim())) { setSkills(p => [...p, inputSkill.trim()]); setInputSkill(''); } }}
                      className="py-3 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-xl transition">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[36px] bg-black/30 p-2.5 rounded-xl border border-white/5">
                    {skills.length === 0
                      ? <span className="text-[10px] text-zinc-600 self-center">No skills added yet</span>
                      : skills.map(s => (
                        <span key={s} className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[9px] font-mono px-2 py-0.5 rounded-lg flex items-center gap-1">
                          {s} <button onClick={() => setSkills(p => p.filter(x => x !== s))} className="text-indigo-400 hover:text-white font-black text-[9px]">×</button>
                        </span>
                      ))
                    }
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {popularSkills.filter(s => !skills.includes(s)).map(s => (
                      <button key={s} onClick={() => setSkills(p => [...p, s])}
                        className="bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white text-[9px] font-mono py-0.5 px-2 rounded-lg transition hover:bg-zinc-800">+ {s}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold font-mono text-zinc-400 uppercase">Professional Summary</label>
                  <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)}
                    placeholder="Briefly describe your background, strengths, and goals…"
                    className="w-full p-3 bg-black border border-white/10 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 text-white placeholder-zinc-700 resize-none" />
                </div>
              </StepSlide>
            )}

            {/* ── STEP 8: CONSENT ─────────────────────────────────────────── */}
            {step === 'consent' && (
              <StepSlide key="consent">
                <div className="text-center space-y-4 py-2">
                  <Volume2 className="w-12 h-12 text-indigo-400 mx-auto animate-bounce" />
                  <h2 className="text-xl font-black text-white">AI Proctoring Consent</h2>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">Required for secure, proctored interview sessions.</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-xs space-y-2 text-zinc-400 leading-relaxed">
                  <p>By creating an account, you acknowledge CareerCraft may use:</p>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Face biometric matching against government ID during interviews</li>
                    <li>Tab focus & fullscreen monitoring for anti-cheat enforcement</li>
                    <li>Audio routing detection to prevent AI voice assistance</li>
                  </ul>
                  <p className="text-[10px] text-zinc-600 border-t border-white/5 pt-3">All data is stored under your UID and purged automatically after each assessment.</p>
                </div>

                {/* Animated waveform */}
                <div className="flex justify-center items-center gap-0.5 h-8">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div key={i}
                      animate={{ height: [4, Math.random() * 24 + 4, 4] }}
                      transition={{ repeat: Infinity, duration: 0.3 + Math.random() * 0.4, ease: 'easeInOut' }}
                      className="w-[3px] bg-indigo-500 rounded-full" />
                  ))}
                </div>
              </StepSlide>
            )}

          </AnimatePresence>

          {/* Footer nav */}
          <div className="flex justify-between mt-8 pt-4 border-t border-white/5">
            {step !== 'credentials' && step !== 'fill-choice'
              ? <button onClick={prevStep} className="py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold rounded-xl flex items-center gap-1 transition">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              : <span />
            }

            {step !== 'consent'
              ? <button onClick={nextStep} disabled={step === 'resume' && parsing} type="button"
                  className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold rounded-xl flex items-center gap-1 transition">
                  {step === 'resume' && parsing
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Parsing…</>
                    : step === 'resume'
                      ? <>{resumeFile ? 'Parse & Continue' : 'Skip'} <ChevronRight className="w-4 h-4" /></>
                      : <>Next <ChevronRight className="w-4 h-4" /></>
                  }
                </button>
              : <button onClick={handleCompleteSignup} disabled={isLoading} type="button"
                  className="py-3 px-6 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-90 disabled:opacity-50 text-xs font-black text-white rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-1.5 transition">
                  {isLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating account…</> : <>Consent & Create Account <Check className="w-4 h-4" /></>}
                </button>
            }
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          Already have an account?{' '}
          <Link href="/" className="text-indigo-400 hover:underline font-semibold">Sign in</Link>
        </p>
      </div>
    </section>
  );
}

// ─── Micro components ─────────────────────────────────────────────────────────

const FI = 'flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-600 focus:outline-none';

function StepSlide({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.18 }} className="space-y-5">
      {children}
    </motion.div>
  );
}

function StepTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="border-b border-white/5 pb-3">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">{icon} {title}</h2>
      <p className="text-xs text-zinc-400 mt-1">{sub}</p>
    </div>
  );
}

function FieldWrap({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <label className="text-[10px] font-bold font-mono text-zinc-400 uppercase">{label}</label>
      {children}
    </div>
  );
}

function FieldIcon({ icon, children, right }: { icon: React.ReactNode; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="relative flex items-center bg-black/40 border border-white/10 rounded-xl px-4 gap-3 focus-within:ring-1 focus-within:ring-indigo-500">
      {icon}
      {children}
      {right && <div className="absolute right-4">{right}</div>}
    </div>
  );
}

function SmallInput({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <label className="text-zinc-500 font-mono text-[9px] uppercase font-bold">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full p-2.5 bg-black border border-white/10 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 text-white placeholder-zinc-700 focus:outline-none" />
    </div>
  );
}

function EntryList<T extends { id: string }>({ items, onRemove, render }: { items: T[]; onRemove: (id: string) => void; render: (item: T) => React.ReactNode }) {
  if (items.length === 0) return (
    <div className="text-center py-4 border border-dashed border-white/5 rounded-xl text-zinc-600 text-xs">No entries yet — fill the form above and click Add.</div>
  );
  return (
    <div className="space-y-2 max-h-36 overflow-y-auto">
      {items.map(item => (
        <div key={item.id} className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl flex justify-between items-start">
          <div>{render(item)}</div>
          <button onClick={() => onRemove(item.id)} className="text-zinc-600 hover:text-red-400 p-1.5 rounded hover:bg-white/5 transition shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
