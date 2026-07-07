'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc } from 'firebase/firestore';
import { PhoneAuthProvider, RecaptchaVerifier, updatePhoneNumber } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { toast } from 'sonner';
import { API_BASE } from '@/lib/api';
import {
  Sparkles, Key, Upload, Check, ChevronRight, ChevronLeft,
  Eye, EyeOff, Loader2, User, Phone, MapPin, FileText,
  Brain, Edit3, ExternalLink, ChevronDown, CheckCircle2,
  Briefcase, AlertCircle, Mail, Globe, Hash, ShieldCheck, Plus, X,
} from 'lucide-react';
import {
  PHONE_COUNTRIES, ADDRESS_COUNTRIES, STATE_LISTS,
  parsePhoneString, parseLocationString,
} from '@/lib/geography';

const INPUT = 'flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-500 focus:outline-none';
const FIELD_INPUT = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ExperienceItem { title: string; company: string; startDate: string; endDate: string; description: string; }
interface EducationItem  { degree: string; institution: string; year: string; }
interface ProjectItem    { name: string; description: string; technologies: string; link: string; }
interface CertItem       { name: string; issuer: string; date: string; }

// ─── Provider config ──────────────────────────────────────────────────────────
const PROVIDERS = [
  {
    id: 'gemini', provider: 'Gemini', name: 'Gemini',
    badge: 'Free • Recommended', badgeColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
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
    id: 'groq', provider: 'Groq', name: 'Groq',
    badge: 'Free • Ultra-fast', badgeColor: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
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
    id: 'openai', provider: 'OpenAI', name: 'OpenAI',
    badge: 'Paid', badgeColor: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
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
    id: 'anthropic', provider: 'Anthropic', name: 'Anthropic',
    badge: 'Paid', badgeColor: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
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
  const { user, isAuthenticated, loading, getToken } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // API keys
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [keyStatus, setKeyStatus] = useState<Record<string, 'idle' | 'verifying' | 'valid' | 'invalid'>>({});
  const [expandedGuide, setExpandedGuide] = useState<string | null>('gemini');

  // Resume file
  const fileRef = useRef<HTMLInputElement>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, any> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Basic profile
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');

  // Structured address
  const [addrCountry, setAddrCountry] = useState('');
  const [addrState, setAddrState]   = useState('');
  const [addrCity, setAddrCity]     = useState('');
  const [addrLine1, setAddrLine1]   = useState('');
  const [addrLine2, setAddrLine2]   = useState('');
  const [addrZip, setAddrZip]       = useState('');

  // Phone with country code
  const [phoneCountryCode, setPhoneCountryCode] = useState('US');
  const [phoneDialCode, setPhoneDialCode]       = useState('+1');
  const [phoneNumber, setPhoneNumber]           = useState('');
  const [phoneOtpSent, setPhoneOtpSent]         = useState(false);
  const [phoneOtpInput, setPhoneOtpInput]       = useState('');
  const [phoneOtpLoading, setPhoneOtpLoading]   = useState(false);
  const [phoneVerified, setPhoneVerified]       = useState(false);
  const [phoneVerifId, setPhoneVerifId]         = useState('');
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // Email OTP
  const [emailToVerify, setEmailToVerify]   = useState('');
  const [emailOtpSent, setEmailOtpSent]     = useState(false);
  const [emailOtpInput, setEmailOtpInput]   = useState('');
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);
  const [emailVerified, setEmailVerified]   = useState(false);

  // Resume details
  const [experience, setExperience]       = useState<ExperienceItem[]>([]);
  const [education, setEducation]         = useState<EducationItem[]>([]);
  const [skills, setSkills]               = useState<string[]>([]);
  const [projects, setProjects]           = useState<ProjectItem[]>([]);
  const [certifications, setCertifications] = useState<CertItem[]>([]);

  // Recruiter-specific
  const [orgName, setOrgName]     = useState('');
  const [industry, setIndustry]   = useState('');
  const [jobTypes, setJobTypes]   = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/');
    if (user) {
      setFullName(user.name || '');
      setEmailToVerify(user.email || '');
    }
  }, [loading, isAuthenticated, user, router]);

  const isCandidate = user?.role === 'candidate';

  // Steps
  // Candidate: 0=Welcome 1=Keys 2=Resume 3=FillChoice 4=Profile 5=ResumeDetails 6=Launch
  // Recruiter: 0=Welcome 1=Profile 2=Company 3=Launch
  const candidateVisualSteps = ['Welcome', 'AI Keys', 'Resume', 'Profile', 'Details', 'Launch'];
  const recruiterVisualSteps = ['Welcome', 'Profile', 'Company', 'Launch'];
  const visualSteps = isCandidate ? candidateVisualSteps : recruiterVisualSteps;

  const visualStep = isCandidate
    ? (step <= 2 ? step : step === 3 ? 2 : step - 1)
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
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
    if (skip || !resumeFile) { setStep(4); return false; }
    setParsing(true);
    setParseError(null);

    // Build plain-key wallet so the backend can use it before Firestore registration
    const walletForParse = PROVIDERS
      .filter(p => apiKeys[p.id]?.trim())
      .map(p => ({ id: p.id, provider: p.provider, key: apiKeys[p.id].trim(), status: 'Active' }));

    const fd = new FormData();
    fd.append('file', resumeFile);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${await getToken()}`,
      };
      if (walletForParse.length > 0) {
        headers['X-API-Wallet'] = JSON.stringify(walletForParse);
      }

      const res = await fetch(`${API_BASE}/parse-resume`, { method: 'POST', headers, body: fd });
      const data = await res.json();
      if (res.ok && !data.error) {
        // Backend returns { parsedData: {...}, aiEnhanced: bool, ... }
        const pd = data.parsedData ?? data;
        setParsedData(pd);
        setParsing(false);
        setStep(3); // fill choice
        return true;
      }
      setParseError(data.error || 'Parse failed');
      setParsing(false);
      setStep(4);
      return false;
    } catch (e: any) {
      setParseError(e.message || 'Network error');
      setParsing(false);
      setStep(4);
      return false;
    }
  };

  // ── Auto-fill from parsed resume ──
  const applyAutoFill = () => {
    if (!parsedData) return;
    const d = parsedData;

    // Personal
    const name    = d.personal?.name    || d.name    || '';
    const ph: string = d.personal?.phone   || d.phone   || '';
    const loc: string = d.personal?.location || d.location || d.personal?.address || '';
    const summary = d.personal?.summary  || d.summary || d.objective || '';

    if (name) setFullName(name);
    if (summary) setBio(summary);

    // Parse phone
    if (ph) {
      const { dialCode, countryCode, number } = parsePhoneString(ph);
      setPhoneDialCode(dialCode);
      setPhoneCountryCode(countryCode);
      setPhoneNumber(number);
    }

    // Parse location
    if (loc) {
      const { city, state, country } = parseLocationString(loc);
      if (city) setAddrCity(city);
      if (state) setAddrState(state);
      if (country) setAddrCountry(country);
    }

    // Experience
    if (Array.isArray(d.experience) && d.experience.length > 0) {
      setExperience(d.experience.map((e: any) => ({
        title: e.title || e.position || e.role || '',
        company: e.company || e.employer || e.organization || '',
        startDate: e.startDate || e.start_date || e.from || '',
        endDate: e.endDate || e.end_date || e.to || 'Present',
        description: e.description || e.responsibilities || e.summary || '',
      })));
    }

    // Education
    if (Array.isArray(d.education) && d.education.length > 0) {
      setEducation(d.education.map((e: any) => ({
        degree: e.degree || e.qualification || e.title || '',
        institution: e.institution || e.school || e.university || e.college || '',
        year: e.year || e.endDate || e.end_date || e.graduationYear || '',
      })));
    }

    // Skills
    if (Array.isArray(d.skills) && d.skills.length > 0) {
      setSkills(d.skills.map((s: any) =>
        typeof s === 'string' ? s : (s.name || s.skill || String(s))
      ).filter(Boolean));
    }

    // Projects
    if (Array.isArray(d.projects) && d.projects.length > 0) {
      setProjects(d.projects.map((p: any) => ({
        name: p.name || p.title || '',
        description: p.description || p.summary || '',
        technologies: Array.isArray(p.technologies)
          ? p.technologies.join(', ')
          : (p.technologies || p.tech || p.stack || ''),
        link: p.link || p.url || p.github || '',
      })));
    }

    // Certifications
    if (Array.isArray(d.certifications) && d.certifications.length > 0) {
      setCertifications(d.certifications.map((c: any) => ({
        name: c.name || c.title || c.certification || '',
        issuer: c.issuer || c.organization || c.authority || '',
        date: c.date || c.year || c.issued || '',
      })));
    }

    setStep(4);
    toast.success('Profile auto-filled from your resume!');
  };

  // ── Email OTP ──
  const sendEmailOtp = async () => {
    if (!emailToVerify) return;
    setEmailOtpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToVerify, name: fullName || 'User' }),
      });
      const data = await res.json();
      if (res.ok) { setEmailOtpSent(true); toast.success('Code sent to your email!'); }
      else toast.error(data.error || 'Failed to send code');
    } catch { toast.error('Failed to send code'); }
    finally { setEmailOtpLoading(false); }
  };

  const verifyEmailOtp = async () => {
    if (!emailOtpInput) return;
    setEmailOtpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToVerify, otp: emailOtpInput }),
      });
      const data = await res.json();
      if (res.ok && data.verified) { setEmailVerified(true); toast.success('Email verified!'); }
      else toast.error(data.error || 'Invalid code');
    } catch { toast.error('Verification failed'); }
    finally { setEmailOtpLoading(false); }
  };

  // ── Phone OTP (Firebase) ──
  const sendPhoneOtp = async () => {
    if (!phoneNumber.trim()) { toast.error('Enter your phone number first'); return; }
    if (!auth.currentUser) { toast.error('Not authenticated'); return; }
    const fullPhone = `${phoneDialCode}${phoneNumber.replace(/\D/g, '')}`;
    setPhoneOtpLoading(true);
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const provider = new PhoneAuthProvider(auth);
      const vid = await provider.verifyPhoneNumber(fullPhone, recaptchaRef.current);
      setPhoneVerifId(vid);
      setPhoneOtpSent(true);
      toast.success('Verification code sent to your phone!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send SMS');
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally { setPhoneOtpLoading(false); }
  };

  const verifyPhoneOtp = async () => {
    if (!phoneOtpInput || !phoneVerifId || !auth.currentUser) return;
    setPhoneOtpLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(phoneVerifId, phoneOtpInput);
      await updatePhoneNumber(auth.currentUser, credential);
      setPhoneVerified(true);
      toast.success('Phone number verified!');
    } catch (e: any) {
      toast.error(e.message || 'Invalid code');
    } finally { setPhoneOtpLoading(false); }
  };

  const toggleJobType = (t: string) =>
    setJobTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  // ── Final save ──
  const finish = async () => {
    if (!user) return;
    setSaving(true);
    const fullPhone = phoneNumber ? `${phoneDialCode}${phoneNumber.replace(/\D/g, '')}` : '';
    const locationStr = [addrCity, addrState, addrCountry].filter(Boolean).join(', ');
    const structuredAddress = { country: addrCountry, state: addrState, city: addrCity, addressLine1: addrLine1, addressLine2: addrLine2, zipCode: addrZip };

    try {
      const wallet = PROVIDERS
        .filter(p => apiKeys[p.id]?.trim())
        .map(p => ({ id: p.id, provider: p.provider, key: apiKeys[p.id].trim(), status: 'Active' }));

      await fetch(`${API_BASE}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.id, fullName: fullName || user.name, email: user.email,
          phone: fullPhone, role: user.role, apiKeysWallet: wallet,
          resumeProfile: parsedData || null,
          location: locationStr, address: structuredAddress, bio,
          jobPreferences: jobTypes, organizationName: orgName, industry,
          emailVerified, phoneVerified,
          resumeDetails: { experience, education, skills, projects, certifications },
        }),
      });

      await setDoc(doc(db, 'users', user.id), {
        fullName: fullName || user.name, phone: fullPhone,
        location: locationStr, address: structuredAddress, bio,
        organizationName: orgName, industry, jobPreferences: jobTypes,
        onboardingCompleted: true, hasApiKeys: wallet.length > 0,
        emailVerified, phoneVerified,
      }, { merge: true });

      if (parsedData || experience.length || education.length || skills.length) {
        await setDoc(doc(db, 'resumes', user.id), {
          personal: { name: fullName, phone: fullPhone, email: user.email, location: locationStr, summary: bio },
          experience, education, skills, projects, certifications,
        }, { merge: true });
      }
    } catch { /* non-fatal */ }

    localStorage.setItem(`onboarding_done_${user.id}`, '1');
    toast.success('Profile ready! Welcome to RecruitEdge.');
    router.push(user.role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard');
    setSaving(false);
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-[#080b14] flex items-center justify-center p-4">
      {/* Invisible reCAPTCHA anchor for Firebase Phone Auth */}
      <div id="recaptcha-container" />

      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
          {visualSteps.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                i === visualStep ? 'bg-indigo-600 text-white'
                  : i < visualStep ? 'bg-emerald-600/30 text-emerald-400'
                  : 'bg-white/5 text-zinc-500'
              }`}>
                {i < visualStep ? <Check className="w-3 h-3" /> : null}
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < visualSteps.length - 1 && (
                <div className={`w-5 h-px ${i < visualStep ? 'bg-emerald-500' : 'bg-zinc-800'}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* STEP 0 — Welcome */}
          {step === 0 && (
            <Slide key="s0">
              <div className="text-center space-y-6">
                <GradIcon><Sparkles className="w-8 h-8 text-white" /></GradIcon>
                <div className="space-y-2">
                  <h1 className="text-2xl font-black text-white">Welcome to RecruitEdge, {user.name}!</h1>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
                    {isCandidate
                      ? "Let's set up your profile, connect your AI tools, and build your professional story."
                      : "Let's set up your company profile so candidates can find and trust you."}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(isCandidate
                    ? ['AI-powered', '~5 minutes', 'Private & secure']
                    : ['Company profile', '~2 minutes', 'Private & secure']
                  ).map(tag => (
                    <div key={tag} className="bg-white/5 border border-white/5 rounded-xl py-2 text-[11px] text-zinc-400 font-medium">{tag}</div>
                  ))}
                </div>
                <Btn onClick={() => setStep(1)}>Let's go <ChevronRight className="w-4 h-4" /></Btn>
              </div>
            </Slide>
          )}

          {/* STEP 1 — API Keys (candidate) / Profile (recruiter) */}
          {step === 1 && isCandidate && (
            <Slide key="s1-c">
              <StepHeader icon={<Key className="w-5 h-5 text-indigo-400" />} title="Connect Your AI Providers"
                sub="Your keys are encrypted on our servers. At least one is recommended for AI features." />
              <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1 scrollbar-thin">
                {PROVIDERS.map(p => (
                  <ProviderCard key={p.id} provider={p}
                    value={apiKeys[p.id] || ''} onChange={v => setKey(p.id, v)}
                    show={showKey[p.id] || false}
                    onToggleShow={() => setShowKey(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    status={keyStatus[p.id] || 'idle'} onVerify={() => verifyKey(p)}
                    expanded={expandedGuide === p.id}
                    onToggleGuide={() => setExpandedGuide(prev => prev === p.id ? null : p.id)}
                  />
                ))}
              </div>
              <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Continue" onSkip={() => setStep(2)} nextSub="Skip" />
            </Slide>
          )}

          {step === 1 && !isCandidate && (
            <Slide key="s1-r">
              <StepHeader icon={<User className="w-5 h-5 text-indigo-400" />} title="Your Profile" sub="Fill in the basics — you can always update these later." />
              <ProfileSection
                fullName={fullName} setFullName={setFullName}
                hideContactVerification={true}
                addrCountry={addrCountry} setAddrCountry={c => { setAddrCountry(c); setAddrState(''); }}
                addrState={addrState} setAddrState={setAddrState}
                addrCity={addrCity} setAddrCity={setAddrCity}
                addrLine1={addrLine1} setAddrLine1={setAddrLine1}
                addrLine2={addrLine2} setAddrLine2={setAddrLine2}
                addrZip={addrZip} setAddrZip={setAddrZip}
                bio={bio} setBio={setBio}
              />
              <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Continue" />
            </Slide>
          )}

          {/* STEP 2 — Resume Upload (candidate) / Company (recruiter) */}
          {step === 2 && isCandidate && (
            <Slide key="s2-c">
              <StepHeader icon={<Upload className="w-5 h-5 text-indigo-400" />} title="Upload Your Resume"
                sub="We'll use your AI key to parse it and auto-fill your profile in seconds." />
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setResumeFile(f); setParseError(null); } }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-indigo-500 bg-indigo-500/10'
                    : resumeFile ? 'border-emerald-500/60 bg-emerald-500/5'
                    : 'border-white/10 hover:border-indigo-500/40 hover:bg-white/[0.03]'
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
                  <AlertCircle className="w-4 h-4 shrink-0" /> {parseError} — switched to manual entry.
                </div>
              )}
              {!apiKeys['gemini']?.trim() && (
                <p className="text-xs text-amber-400/80 text-center">Tip: add a Gemini key in the previous step to enable AI parsing.</p>
              )}
              <div className="flex gap-3">
                <BackBtn onClick={() => setStep(1)} />
                <button onClick={() => parseResume(true)} className="px-4 py-3 text-xs text-zinc-400 border border-white/5 rounded-xl hover:text-white transition">Skip</button>
                <button onClick={() => parsing ? null : parseResume(false)} disabled={!resumeFile || parsing}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition">
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

          {/* STEP 3 — Fill choice (candidate) */}
          {step === 3 && isCandidate && (
            <Slide key="s3">
              <div className="space-y-5">
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white">Resume parsed!</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {parsedData?.personal?.name ? `Found: ${parsedData.personal.name}` : 'Profile data extracted'}
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
                    <p className="text-xs text-zinc-400 mt-1">Instantly populate your profile, experience, education, skills, and more from the parsed data. You can review and edit everything.</p>
                  </div>
                </button>
                <button onClick={() => setStep(4)}
                  className="w-full p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/5 transition text-left flex items-start gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition">
                    <Edit3 className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Enter Manually</p>
                    <p className="text-xs text-zinc-400 mt-1">Fill in your profile details yourself — takes about 3 minutes.</p>
                  </div>
                </button>
              </div>
            </Slide>
          )}

          {/* STEP 4 — Profile (candidate) */}
          {step === 4 && isCandidate && (
            <Slide key="s4">
              <StepHeader icon={<User className="w-5 h-5 text-indigo-400" />} title="Your Profile" sub="Review and complete your contact details." />
              <ProfileSection
                fullName={fullName} setFullName={setFullName}
                emailToVerify={emailToVerify} setEmailToVerify={setEmailToVerify}
                emailOtpSent={emailOtpSent} emailOtpInput={emailOtpInput} setEmailOtpInput={setEmailOtpInput}
                emailOtpLoading={emailOtpLoading} emailVerified={emailVerified}
                onSendEmailOtp={sendEmailOtp} onVerifyEmailOtp={verifyEmailOtp}
                phoneCountryCode={phoneCountryCode} phoneDialCode={phoneDialCode} phoneNumber={phoneNumber}
                onPhoneCountryChange={(code, dc) => { setPhoneCountryCode(code); setPhoneDialCode(dc); }}
                setPhoneNumber={setPhoneNumber}
                phoneOtpSent={phoneOtpSent} phoneOtpInput={phoneOtpInput} setPhoneOtpInput={setPhoneOtpInput}
                phoneOtpLoading={phoneOtpLoading} phoneVerified={phoneVerified}
                onSendPhoneOtp={sendPhoneOtp} onVerifyPhoneOtp={verifyPhoneOtp}
                addrCountry={addrCountry} setAddrCountry={c => { setAddrCountry(c); setAddrState(''); }}
                addrState={addrState} setAddrState={setAddrState}
                addrCity={addrCity} setAddrCity={setAddrCity}
                addrLine1={addrLine1} setAddrLine1={setAddrLine1}
                addrLine2={addrLine2} setAddrLine2={setAddrLine2}
                addrZip={addrZip} setAddrZip={setAddrZip}
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

          {/* STEP 5 — Resume Details (candidate) */}
          {step === 5 && isCandidate && (
            <Slide key="s5">
              <StepHeader icon={<FileText className="w-5 h-5 text-indigo-400" />} title="Resume Details"
                sub="Add your experience, education, skills, projects, and certifications." />
              <ResumeDetailsSection
                experience={experience} setExperience={setExperience}
                education={education} setEducation={setEducation}
                skills={skills} setSkills={setSkills}
                projects={projects} setProjects={setProjects}
                certifications={certifications} setCertifications={setCertifications}
              />
              <NavRow onBack={() => setStep(4)} onNext={() => setStep(6)} nextLabel="Continue" />
            </Slide>
          )}

          {/* STEP 3 (recruiter) — Launch */}
          {step === 3 && !isCandidate && (
            <Slide key="s3-r">
              <LaunchStep role="recruiter" saving={saving} onFinish={finish} />
            </Slide>
          )}

          {/* STEP 6 (candidate) — Launch */}
          {step === 6 && isCandidate && (
            <Slide key="s6">
              <LaunchStep role="candidate" saving={saving} onFinish={finish} />
            </Slide>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Profile Section ──────────────────────────────────────────────────────────
function ProfileSection(props: {
  fullName: string; setFullName: (v: string) => void;
  hideContactVerification?: boolean;
  emailToVerify?: string; setEmailToVerify?: (v: string) => void;
  emailOtpSent?: boolean; emailOtpInput?: string; setEmailOtpInput?: (v: string) => void;
  emailOtpLoading?: boolean; emailVerified?: boolean;
  onSendEmailOtp?: () => void; onVerifyEmailOtp?: () => void;
  phoneCountryCode?: string; phoneDialCode?: string; phoneNumber?: string;
  onPhoneCountryChange?: (code: string, dc: string) => void;
  setPhoneNumber?: (v: string) => void;
  phoneOtpSent?: boolean; phoneOtpInput?: string; setPhoneOtpInput?: (v: string) => void;
  phoneOtpLoading?: boolean; phoneVerified?: boolean;
  onSendPhoneOtp?: () => void; onVerifyPhoneOtp?: () => void;
  addrCountry: string; setAddrCountry: (v: string) => void;
  addrState: string; setAddrState: (v: string) => void;
  addrCity: string; setAddrCity: (v: string) => void;
  addrLine1: string; setAddrLine1: (v: string) => void;
  addrLine2: string; setAddrLine2: (v: string) => void;
  addrZip: string; setAddrZip: (v: string) => void;
  bio: string; setBio: (v: string) => void;
}) {
  const FIELD_CLS = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 transition';
  const stateList = STATE_LISTS[props.addrCountry] ?? [];

  return (
    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1 scrollbar-thin">
      {/* Full name */}
      <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 gap-3 focus-within:border-indigo-500/50 transition">
        <User className="w-4 h-4 text-zinc-500 shrink-0" />
        <input value={props.fullName} onChange={e => props.setFullName(e.target.value)}
          className="flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-500 focus:outline-none"
          placeholder="Full Name" />
      </div>

      {/* Email + OTP — only shown when not hiding contact verification */}
      {!props.hideContactVerification && (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <div className="flex flex-1 items-center bg-white/5 border border-white/10 rounded-xl px-4 gap-3 focus-within:border-indigo-500/50 transition">
              <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
              <input value={props.emailToVerify ?? ''} onChange={e => props.setEmailToVerify?.(e.target.value)}
                className="flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-500 focus:outline-none"
                placeholder="Email address" type="email" />
            </div>
            {props.emailVerified ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold shrink-0">
                <ShieldCheck className="w-4 h-4" /> Verified
              </span>
            ) : (
              <button onClick={props.onSendEmailOtp} disabled={props.emailOtpLoading || !props.emailToVerify}
                className="shrink-0 px-3 py-2.5 text-xs font-semibold border border-indigo-500/40 text-indigo-400 rounded-xl hover:bg-indigo-500/10 disabled:opacity-40 transition">
                {props.emailOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : props.emailOtpSent ? 'Resend' : 'Send code'}
              </button>
            )}
          </div>
          {props.emailOtpSent && !props.emailVerified && (
            <div className="flex gap-2">
              <input value={props.emailOtpInput ?? ''} onChange={e => props.setEmailOtpInput?.(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 font-mono tracking-widest"
                placeholder="6-digit code" maxLength={6} />
              <button onClick={props.onVerifyEmailOtp} disabled={props.emailOtpLoading || (props.emailOtpInput ?? '').length < 6}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition">
                {props.emailOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Phone + country code + OTP — only shown when not hiding contact verification */}
      {!props.hideContactVerification && (
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <div className="flex flex-1 items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden focus-within:border-indigo-500/50 transition">
              <PhoneCountrySelector
                selectedCode={props.phoneCountryCode ?? 'US'}
                onChange={props.onPhoneCountryChange ?? (() => {})}
              />
              <input value={props.phoneNumber ?? ''} onChange={e => props.setPhoneNumber?.(e.target.value.replace(/\D/g, ''))}
                className="flex-1 bg-transparent py-3 px-3 text-sm text-white placeholder-zinc-500 focus:outline-none"
                placeholder="Phone number" type="tel" />
            </div>
            {props.phoneVerified ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold shrink-0">
                <ShieldCheck className="w-4 h-4" /> Verified
              </span>
            ) : (
              <button onClick={props.onSendPhoneOtp} disabled={props.phoneOtpLoading || !props.phoneNumber}
                className="shrink-0 px-3 py-2.5 text-xs font-semibold border border-indigo-500/40 text-indigo-400 rounded-xl hover:bg-indigo-500/10 disabled:opacity-40 transition">
                {props.phoneOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : props.phoneOtpSent ? 'Resend' : 'Send code'}
              </button>
            )}
          </div>
          {props.phoneOtpSent && !props.phoneVerified && (
            <div className="flex gap-2">
              <input value={props.phoneOtpInput ?? ''} onChange={e => props.setPhoneOtpInput?.(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 font-mono tracking-widest"
                placeholder="6-digit code" maxLength={6} />
              <button onClick={props.onVerifyPhoneOtp} disabled={props.phoneOtpLoading || (props.phoneOtpInput ?? '').length < 6}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition">
                {props.phoneOtpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Verify'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Address */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" /> Address
        </p>
        {/* Country */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 gap-3 focus-within:border-indigo-500/50 transition">
          <Globe className="w-4 h-4 text-zinc-500 shrink-0" />
          <select value={props.addrCountry} onChange={e => props.setAddrCountry(e.target.value)}
            className="flex-1 bg-transparent py-3 text-sm text-white focus:outline-none cursor-pointer">
            <option value="" className="bg-[#111827]">Country</option>
            {ADDRESS_COUNTRIES.map(c => <option key={c} value={c} className="bg-[#111827]">{c}</option>)}
          </select>
        </div>
        {/* State + City */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="relative">
            <input value={props.addrState} onChange={e => props.setAddrState(e.target.value)}
              list="state-list" className={FIELD_CLS} placeholder="State / Province" />
            <datalist id="state-list">
              {stateList.map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <input value={props.addrCity} onChange={e => props.setAddrCity(e.target.value)}
            className={FIELD_CLS} placeholder="City" />
        </div>
        {/* Address lines */}
        <input value={props.addrLine1} onChange={e => props.setAddrLine1(e.target.value)}
          className={FIELD_CLS} placeholder="Address Line 1" />
        <input value={props.addrLine2} onChange={e => props.setAddrLine2(e.target.value)}
          className={FIELD_CLS} placeholder="Address Line 2 (optional)" />
        {/* Zip */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 gap-3 focus-within:border-indigo-500/50 transition">
          <Hash className="w-4 h-4 text-zinc-500 shrink-0" />
          <input value={props.addrZip} onChange={e => props.setAddrZip(e.target.value)}
            className="flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-500 focus:outline-none"
            placeholder="ZIP / Postal Code" />
        </div>
      </div>

      {/* Bio */}
      <div className="flex items-start bg-white/5 border border-white/10 rounded-xl px-4 py-3 gap-3 focus-within:border-indigo-500/50 transition">
        <FileText className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
        <textarea value={props.bio} onChange={e => props.setBio(e.target.value)} rows={3}
          className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none resize-none"
          placeholder="Brief professional summary about yourself..." />
      </div>
    </div>
  );
}

// ─── Resume Details Section ───────────────────────────────────────────────────
function ResumeDetailsSection(props: {
  experience: ExperienceItem[]; setExperience: (v: ExperienceItem[]) => void;
  education: EducationItem[];   setEducation:  (v: EducationItem[])  => void;
  skills: string[];             setSkills:     (v: string[])         => void;
  projects: ProjectItem[];      setProjects:   (v: ProjectItem[])    => void;
  certifications: CertItem[];   setCertifications: (v: CertItem[])   => void;
}) {
  const [activeTab, setActiveTab] = useState<'exp' | 'edu' | 'skills' | 'proj' | 'cert'>('exp');

  const tabs = [
    { id: 'exp',    label: 'Experience',      count: props.experience.length },
    { id: 'edu',    label: 'Education',       count: props.education.length },
    { id: 'skills', label: 'Skills',          count: props.skills.length },
    { id: 'proj',   label: 'Projects',        count: props.projects.length },
    { id: 'cert',   label: 'Certifications',  count: props.certifications.length },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
              activeTab === t.id ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}>
            {t.label}{t.count > 0 ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      <div className="max-h-[48vh] overflow-y-auto pr-1 scrollbar-thin space-y-3">
        {activeTab === 'exp' && (
          <ExperienceTab items={props.experience} onChange={props.setExperience} />
        )}
        {activeTab === 'edu' && (
          <EducationTab items={props.education} onChange={props.setEducation} />
        )}
        {activeTab === 'skills' && (
          <SkillsTab skills={props.skills} onChange={props.setSkills} />
        )}
        {activeTab === 'proj' && (
          <ProjectsTab items={props.projects} onChange={props.setProjects} />
        )}
        {activeTab === 'cert' && (
          <CertsTab items={props.certifications} onChange={props.setCertifications} />
        )}
      </div>
    </div>
  );
}

// ── Experience tab ────────────────────────────────────────────────────────────
function ExperienceTab({ items, onChange }: { items: ExperienceItem[]; onChange: (v: ExperienceItem[]) => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(items.length > 0 ? 0 : null);
  const blank: ExperienceItem = { title: '', company: '', startDate: '', endDate: '', description: '' };

  const add    = () => { onChange([...items, { ...blank }]); setOpenIdx(items.length); };
  const remove = (i: number) => { onChange(items.filter((_, j) => j !== i)); if (openIdx === i) setOpenIdx(null); };
  const update = (i: number, k: keyof ExperienceItem, v: string) =>
    onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const FIELD = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50';

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition text-left">
            <div>
              <p className="text-sm font-semibold text-white">{item.title || 'Untitled Role'}</p>
              <p className="text-xs text-zinc-400">{item.company || 'Company'}{item.startDate ? ` · ${item.startDate} – ${item.endDate || 'Present'}` : ''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={e => { e.stopPropagation(); remove(i); }} className="text-zinc-500 hover:text-red-400 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {openIdx === i && (
            <div className="p-3 border-t border-white/5 space-y-2.5 bg-white/[0.02]">
              <input value={item.title} onChange={e => update(i, 'title', e.target.value)} className={FIELD} placeholder="Job Title" />
              <input value={item.company} onChange={e => update(i, 'company', e.target.value)} className={FIELD} placeholder="Company Name" />
              <div className="grid grid-cols-2 gap-2">
                <input value={item.startDate} onChange={e => update(i, 'startDate', e.target.value)} className={FIELD} placeholder="Start (e.g. Jan 2021)" />
                <input value={item.endDate}   onChange={e => update(i, 'endDate',   e.target.value)} className={FIELD} placeholder="End (or Present)" />
              </div>
              <textarea value={item.description} onChange={e => update(i, 'description', e.target.value)} rows={3}
                className={`${FIELD} resize-none`} placeholder="Describe your role and key achievements..." />
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-xl px-4 py-2.5 w-full justify-center transition">
        <Plus className="w-3.5 h-3.5" /> Add Experience
      </button>
    </div>
  );
}

// ── Education tab ─────────────────────────────────────────────────────────────
function EducationTab({ items, onChange }: { items: EducationItem[]; onChange: (v: EducationItem[]) => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(items.length > 0 ? 0 : null);
  const blank: EducationItem = { degree: '', institution: '', year: '' };

  const add    = () => { onChange([...items, { ...blank }]); setOpenIdx(items.length); };
  const remove = (i: number) => { onChange(items.filter((_, j) => j !== i)); if (openIdx === i) setOpenIdx(null); };
  const update = (i: number, k: keyof EducationItem, v: string) =>
    onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const FIELD = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50';

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition text-left">
            <div>
              <p className="text-sm font-semibold text-white">{item.degree || 'Degree'}</p>
              <p className="text-xs text-zinc-400">{item.institution || 'Institution'}{item.year ? ` · ${item.year}` : ''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={e => { e.stopPropagation(); remove(i); }} className="text-zinc-500 hover:text-red-400 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {openIdx === i && (
            <div className="p-3 border-t border-white/5 space-y-2.5 bg-white/[0.02]">
              <input value={item.degree}      onChange={e => update(i, 'degree',      e.target.value)} className={FIELD} placeholder="Degree / Qualification" />
              <input value={item.institution} onChange={e => update(i, 'institution', e.target.value)} className={FIELD} placeholder="University / School" />
              <input value={item.year}        onChange={e => update(i, 'year',        e.target.value)} className={FIELD} placeholder="Graduation Year" />
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-xl px-4 py-2.5 w-full justify-center transition">
        <Plus className="w-3.5 h-3.5" /> Add Education
      </button>
    </div>
  );
}

// ── Skills tab ────────────────────────────────────────────────────────────────
function SkillsTab({ skills, onChange }: { skills: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');

  const add = () => {
    const s = input.trim();
    if (s && !skills.includes(s)) onChange([...skills, s]);
    setInput('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {skills.map((skill, i) => (
          <span key={i} className="flex items-center gap-1 text-xs bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 rounded-full px-3 py-1">
            {skill}
            <button type="button" onClick={() => onChange(skills.filter((_, j) => j !== i))} className="hover:text-red-400 ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {skills.length === 0 && <p className="text-xs text-zinc-500">No skills added yet</p>}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
          placeholder="Type a skill and press Enter…" />
        <button type="button" onClick={add}
          className="px-4 py-2.5 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-xs text-indigo-300 hover:bg-indigo-600/50 transition">
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Git', 'Machine Learning'].map(s => (
          !skills.includes(s) && (
            <button key={s} type="button" onClick={() => onChange([...skills, s])}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 border border-white/5 hover:border-white/20 rounded-full px-2.5 py-1 transition">
              + {s}
            </button>
          )
        ))}
      </div>
    </div>
  );
}

// ── Projects tab ──────────────────────────────────────────────────────────────
function ProjectsTab({ items, onChange }: { items: ProjectItem[]; onChange: (v: ProjectItem[]) => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(items.length > 0 ? 0 : null);
  const blank: ProjectItem = { name: '', description: '', technologies: '', link: '' };

  const add    = () => { onChange([...items, { ...blank }]); setOpenIdx(items.length); };
  const remove = (i: number) => { onChange(items.filter((_, j) => j !== i)); if (openIdx === i) setOpenIdx(null); };
  const update = (i: number, k: keyof ProjectItem, v: string) =>
    onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const FIELD = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50';

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition text-left">
            <div>
              <p className="text-sm font-semibold text-white">{item.name || 'Untitled Project'}</p>
              <p className="text-xs text-zinc-400 truncate max-w-[240px]">{item.technologies || 'Add technologies'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={e => { e.stopPropagation(); remove(i); }} className="text-zinc-500 hover:text-red-400 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {openIdx === i && (
            <div className="p-3 border-t border-white/5 space-y-2.5 bg-white/[0.02]">
              <input value={item.name}         onChange={e => update(i, 'name',         e.target.value)} className={FIELD} placeholder="Project Name" />
              <textarea value={item.description} onChange={e => update(i, 'description', e.target.value)} rows={2}
                className={`${FIELD} resize-none`} placeholder="What did this project do? What did you build?" />
              <input value={item.technologies} onChange={e => update(i, 'technologies', e.target.value)} className={FIELD} placeholder="Technologies (e.g. React, Python, AWS)" />
              <input value={item.link}         onChange={e => update(i, 'link',         e.target.value)} className={FIELD} placeholder="GitHub / Live URL (optional)" />
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-xl px-4 py-2.5 w-full justify-center transition">
        <Plus className="w-3.5 h-3.5" /> Add Project
      </button>
    </div>
  );
}

// ── Certifications tab ────────────────────────────────────────────────────────
function CertsTab({ items, onChange }: { items: CertItem[]; onChange: (v: CertItem[]) => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(items.length > 0 ? 0 : null);
  const blank: CertItem = { name: '', issuer: '', date: '' };

  const add    = () => { onChange([...items, { ...blank }]); setOpenIdx(items.length); };
  const remove = (i: number) => { onChange(items.filter((_, j) => j !== i)); if (openIdx === i) setOpenIdx(null); };
  const update = (i: number, k: keyof CertItem, v: string) =>
    onChange(items.map((x, j) => j === i ? { ...x, [k]: v } : x));

  const FIELD = 'w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50';

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition text-left">
            <div>
              <p className="text-sm font-semibold text-white">{item.name || 'Certification'}</p>
              <p className="text-xs text-zinc-400">{item.issuer || 'Issuer'}{item.date ? ` · ${item.date}` : ''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={e => { e.stopPropagation(); remove(i); }} className="text-zinc-500 hover:text-red-400 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${openIdx === i ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {openIdx === i && (
            <div className="p-3 border-t border-white/5 space-y-2.5 bg-white/[0.02]">
              <input value={item.name}   onChange={e => update(i, 'name',   e.target.value)} className={FIELD} placeholder="Certification Name" />
              <input value={item.issuer} onChange={e => update(i, 'issuer', e.target.value)} className={FIELD} placeholder="Issuing Organization (e.g. AWS, Google)" />
              <input value={item.date}   onChange={e => update(i, 'date',   e.target.value)} className={FIELD} placeholder="Date (e.g. Dec 2023)" />
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 border border-dashed border-indigo-500/30 hover:border-indigo-500/60 rounded-xl px-4 py-2.5 w-full justify-center transition">
        <Plus className="w-3.5 h-3.5" /> Add Certification
      </button>
    </div>
  );
}

// ─── Phone country dropdown ───────────────────────────────────────────────────
function PhoneCountrySelector({ selectedCode, onChange }: {
  selectedCode: string;
  onChange: (code: string, dialCode: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = PHONE_COUNTRIES.find(c => c.code === selectedCode) ?? PHONE_COUNTRIES[0];
  const filtered = PHONE_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dialCode.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-3 hover:bg-white/5 transition border-r border-white/10">
        <span className="text-base leading-none">{selected.flag}</span>
        <span className="text-zinc-300 font-mono text-xs">{selected.dialCode}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.13 }}
            className="absolute left-0 top-full mt-1 w-64 bg-[#1a1f2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="p-2 border-b border-white/5">
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                placeholder="Search country…" />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.map(c => (
                <button key={c.code} type="button"
                  onClick={() => { onChange(c.code, c.dialCode); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-white/5 transition text-left ${
                    c.code === selectedCode ? 'bg-indigo-600/20 text-indigo-300' : 'text-zinc-300'
                  }`}>
                  <span className="w-5 text-base">{c.flag}</span>
                  <span className="flex-1">{c.name}</span>
                  <span className="text-zinc-500 font-mono">{c.dialCode}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="text-center text-zinc-500 text-xs py-4">No results</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function Slide({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.2 }}
      className="bg-[#111827] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
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
      <div className="flex items-center gap-2">{icon}<h2 className="text-xl font-black text-white">{title}</h2></div>
      <p className="text-zinc-400 text-sm">{sub}</p>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 gap-3 focus-within:border-indigo-500/50 transition">
      {icon}{children}
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

function NavRow({ onBack, onNext, nextLabel, onSkip, nextSub, disabled }: {
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
  provider: typeof PROVIDERS[0]; value: string; onChange: (v: string) => void;
  show: boolean; onToggleShow: () => void;
  status: 'idle' | 'verifying' | 'valid' | 'invalid'; onVerify: () => void;
  expanded: boolean; onToggleGuide: () => void;
};

function ProviderCard({ provider: p, value, onChange, show, onToggleShow, status, onVerify, expanded, onToggleGuide }: ProviderCardProps) {
  const statusIcon = {
    idle: null,
    verifying: <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />,
    valid: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    invalid: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  }[status];

  const borderColor = status === 'valid' ? 'border-emerald-500/40' : status === 'invalid' ? 'border-red-500/30' : 'border-white/[0.08]';

  return (
    <div className={`rounded-2xl border bg-white/[0.03] transition ${borderColor}`}>
      <div className="p-4 space-y-3">
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
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-black/30 border border-white/10 rounded-xl px-3 gap-2 focus-within:border-indigo-500/50 transition">
            <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
              placeholder={p.placeholder}
              className="flex-1 bg-transparent py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono" />
            <button onClick={onToggleShow} className="text-zinc-500 hover:text-zinc-300 transition shrink-0">
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button onClick={onVerify} disabled={status === 'verifying' || !value.trim()}
            className="px-3 py-2.5 text-xs font-semibold rounded-xl border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-40 transition whitespace-nowrap">
            {status === 'verifying' ? 'Checking…' : 'Verify'}
          </button>
        </div>
        <button onClick={onToggleGuide}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition w-full text-left">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          How to get this key
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <ol className="space-y-2 pt-1">
                {p.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs">
                    <span className="w-4 h-4 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-zinc-400">
                      {s.text}{' '}
                      {'link' in s && s.link && (
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
