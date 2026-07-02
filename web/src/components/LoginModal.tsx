'use client';

import { useContext, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ModalContext } from '@/contexts/LoginModalContext';
import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, ShieldCheck, Mail, Phone, Lock, User,
  ChevronRight, RefreshCw, X, ArrowLeft, Eye, EyeOff,
} from 'lucide-react';
import SocialLoginButtons from './SocialLoginButtons';

type Step = 'form' | 'emailOtp' | 'phoneOtp' | 'consent';
type LoginMethod = 'email' | 'phone';

const INPUT =
  'w-full pl-11 pr-4 py-3 border border-white/10 rounded-xl bg-black/40 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
const INPUT_ICON = 'absolute left-4 top-3.5 w-4 h-4 text-zinc-500';

export default function LoginModal() {
  const { isOpen, closeModal } = useContext(ModalContext);
  const { login } = useAuth();
  const router = useRouter();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [isRecruiter, setIsRecruiter] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState<Step>('form');

  // ── Form data ────────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '',
    email: '', phone: '', password: '', confirmPassword: '', loginEmail: '',
  });
  const fullName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  // ── OTP state ────────────────────────────────────────────────────────────────
  const [emailOtp, setEmailOtp] = useState(['', '', '', '', '', '']);
  const [phoneOtp, setPhoneOtp] = useState(['', '', '', '', '', '']);
  const emailRefs = useRef<(HTMLInputElement | null)[]>([]);
  const phoneRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [confirmResult, setConfirmResult] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // ── Countdown ────────────────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Reset on close ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen]);

  function reset() {
    setStep('form'); setLoading(false); setShowPw(false);
    setLoginMethod('email');
    setEmailOtp(['', '', '', '', '', '']);
    setPhoneOtp(['', '', '', '', '', '']);
    setConfirmResult(null);
    setForm({ firstName: '', middleName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '', loginEmail: '' });
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  }

  // ── OTP helpers ──────────────────────────────────────────────────────────────
  function handleOtpInput(
    i: number, val: string,
    digits: string[], setDigits: (d: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = [...digits]; next[i] = clean; setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
  }
  function handleOtpKey(
    i: number, e: React.KeyboardEvent,
    digits: string[], setDigits: (d: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]; next[i - 1] = ''; setDigits(next);
      refs.current[i - 1]?.focus();
    }
  }

  // ── isMock check ─────────────────────────────────────────────────────────────
  const isMock = () => {
    const key = auth.app.options.apiKey;
    return !key || key.startsWith('mock') || key.startsWith('your_api_key');
  };

  // ── API helper ───────────────────────────────────────────────────────────────
  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

  // ── EMAIL LOGIN ──────────────────────────────────────────────────────────────
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (isMock()) {
        const u = { id: isRecruiter ? 'mock_recruiter' : 'mock_candidate', email: form.loginEmail || 'dev@mock.test', name: 'Dev User', role: (isRecruiter ? 'recruiter' : 'candidate') as 'recruiter' | 'candidate', avatar: '' };
        login(u); toast.success('Logged in (mock)!'); closeModal();
        router.push(isRecruiter ? '/recruiter/dashboard' : '/candidate/dashboard');
        return;
      }
      await signInWithEmailAndPassword(auth, form.loginEmail, form.password);
      toast.success('Logged in!');
      closeModal();
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
      };
      toast.error(msg[err.code] ?? err.message ?? 'Login failed.');
    } finally { setLoading(false); }
  }

  // ── PHONE LOGIN — send SMS ───────────────────────────────────────────────────
  async function handlePhoneLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const phone = form.phone.startsWith('+') ? form.phone : '+1' + form.phone.replace(/\D/g, '');
    if (phone.length < 8) { toast.error('Include country code, e.g. +1 for US.'); return; }
    setLoading(true);
    try {
      if (isMock()) {
        toast.info('Mock: use OTP 123456'); setStep('phoneOtp'); setCountdown(60); return;
      }
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      const result = await signInWithPhoneNumber(auth, phone, recaptchaRef.current);
      setConfirmResult(result);
      setStep('phoneOtp'); setCountdown(60);
      toast.success(`OTP sent to ${phone}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send OTP.');
      recaptchaRef.current?.clear(); recaptchaRef.current = null;
    } finally { setLoading(false); }
  }

  // ── PHONE OTP — verify ───────────────────────────────────────────────────────
  async function verifyPhoneOtp() {
    const code = phoneOtp.join('');
    if (code.length < 6) { toast.error('Enter all 6 digits.'); return; }
    setLoading(true);
    try {
      if (isMock()) {
        const u = { id: 'mock_phone', email: form.phone, name: form.phone, role: (isRecruiter ? 'recruiter' : 'candidate') as 'recruiter' | 'candidate', avatar: '' };
        login(u); toast.success('Phone verified (mock)!'); closeModal();
        router.push(isRecruiter ? '/recruiter/dashboard' : '/candidate/dashboard'); return;
      }
      if (!confirmResult) throw new Error('Session expired — resend OTP.');
      const result = await confirmResult.confirm(code);
      const fu = result.user;
      const ref = doc(db, 'users', fu.uid);
      if (!(await getDoc(ref)).exists()) {
        await setDoc(ref, { uid: fu.uid, fullName: '', phone: fu.phoneNumber ?? form.phone, role: isRecruiter ? 'recruiter' : 'candidate', onboardingCompleted: false, createdAt: new Date().toISOString() });
      }
      toast.success('Signed in!'); closeModal();
    } catch (err: any) { toast.error(err.message ?? 'Invalid OTP.'); }
    finally { setLoading(false); }
  }

  // ── SIGNUP — send email OTP ──────────────────────────────────────────────────
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match.'); return; }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (!form.firstName.trim() || !form.lastName.trim()) { toast.error('First and last name are required.'); return; }
    setLoading(true);
    try {
      if (isMock()) { setStep('consent'); setLoading(false); return; }
      const res = await fetch(`${api}/auth/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, name: fullName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not send verification email.');
      setStep('emailOtp'); setCountdown(60);
      toast.success(`Code sent to ${form.email}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Signup failed.');
    } finally { setLoading(false); }
  }

  // ── EMAIL OTP — verify ───────────────────────────────────────────────────────
  async function verifyEmailOtp() {
    const code = emailOtp.join('');
    if (code.length < 6) { toast.error('Enter all 6 digits.'); return; }
    setLoading(true);
    try {
      if (isMock()) { setStep('consent'); setLoading(false); return; }
      const res = await fetch(`${api}/auth/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Verification failed.');
      toast.success('Email verified!');
      setStep('consent');
    } catch (err: any) { toast.error(err.message ?? 'Verification failed.'); }
    finally { setLoading(false); }
  }

  async function resendEmailOtp() {
    setCountdown(60);
    try {
      await fetch(`${api}/auth/send-email-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, name: fullName }),
      });
      toast.info('New code sent!');
    } catch { toast.error('Could not resend.'); }
  }

  // ── FINALIZE SIGNUP ──────────────────────────────────────────────────────────
  async function finalizeSignup() {
    setLoading(true);
    try {
      if (isMock()) {
        const u = { id: isRecruiter ? 'mock_recruiter' : 'mock_candidate', email: form.email, name: fullName, role: (isRecruiter ? 'recruiter' : 'candidate') as 'recruiter' | 'candidate', avatar: '' };
        login(u); toast.success('Account created (mock)!'); closeModal();
        router.push(isRecruiter ? '/recruiter/dashboard' : '/candidate/dashboard'); return;
      }
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const u = cred.user;
      await setDoc(doc(db, 'users', u.uid), {
        uid: u.uid,
        firstName: form.firstName, middleName: form.middleName, lastName: form.lastName, fullName,
        email: form.email, phone: form.phone ?? '',
        role: isRecruiter ? 'recruiter' : 'candidate',
        onboardingCompleted: false,
        createdAt: new Date().toISOString(),
      });
      try { await sendEmailVerification(u); } catch { /* best-effort */ }
      toast.success('Account created! Please check your email to verify.');
      closeModal();
    } catch (err: any) {
      const msg: Record<string, string> = {
        'auth/email-already-in-use': 'An account already exists with this email.',
        'auth/weak-password': 'Password should be at least 6 characters.',
      };
      toast.error(msg[err.code] ?? err.message ?? 'Account creation failed.');
    } finally { setLoading(false); }
  }

  if (!isOpen) return null;

  // ── Shared sub-components ─────────────────────────────────────────────────────
  const OtpRow = ({
    digits, setDigits, refs, color = 'indigo',
  }: {
    digits: string[];
    setDigits: (d: string[]) => void;
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>;
    color?: string;
  }) => (
    <div className="flex justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i} type="text" inputMode="numeric"
          ref={el => { refs.current[i] = el; }}
          value={d}
          onChange={e => handleOtpInput(i, e.target.value, digits, setDigits, refs)}
          onKeyDown={e => handleOtpKey(i, e, digits, setDigits, refs)}
          className={`w-12 h-14 bg-black/40 border border-white/10 focus:border-${color}-500 rounded-xl text-center font-mono text-xl text-white font-bold focus:outline-none focus:ring-1 focus:ring-${color}-500 transition-colors`}
        />
      ))}
    </div>
  );

  const CountdownRow = ({ onResend }: { onResend: () => void }) => (
    <div className="text-xs text-center">
      {countdown > 0
        ? <span className="text-zinc-500 flex items-center justify-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" />Resend in <strong className="font-mono text-zinc-300">{countdown}s</strong></span>
        : <button onClick={onResend} className="text-indigo-400 font-bold hover:underline">Resend Code</button>
      }
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div id="recaptcha-container" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', damping: 26, stiffness: 160 }}
        className="relative w-full max-w-md bg-[#0b0c10]/95 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Glow accents */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        {/* Close */}
        <button onClick={closeModal} className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-white/5 text-zinc-400 hover:text-white transition z-10">
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">

          {/* ── FORM ── */}
          {step === 'form' && (
            <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-5">

              {/* Header */}
              <div className="text-center">
                <div className="inline-flex p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-3 text-indigo-400">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <h2 className="text-2xl font-black bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
                  {isLogin ? 'Welcome Back' : 'Get Started Free'}
                </h2>
                <p className="text-xs text-zinc-500 mt-1">RecruitEdge — AI-Powered Hiring Platform</p>
              </div>

              {/* Role toggle */}
              <div className="grid grid-cols-2 p-1.5 bg-zinc-950/80 border border-white/5 rounded-2xl relative">
                {(['candidate', 'recruiter'] as const).map(role => (
                  <button key={role} onClick={() => setIsRecruiter(role === 'recruiter')}
                    className={`py-2 text-xs font-bold rounded-xl transition relative z-10 flex items-center justify-center gap-1.5 ${(role === 'recruiter') === isRecruiter ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {role === 'candidate' ? <User className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </button>
                ))}
                <motion.div layoutId="roleSlider"
                  className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-indigo-600/90 rounded-xl -z-0"
                  animate={{ x: isRecruiter ? '100%' : '0%' }}
                  transition={{ type: 'spring', damping: 20, stiffness: 200 }} />
              </div>

              {/* Login method tabs */}
              {isLogin && (
                <div className="grid grid-cols-2 p-1 bg-zinc-950/60 border border-white/5 rounded-xl">
                  {(['email', 'phone'] as const).map(m => (
                    <button key={m} onClick={() => setLoginMethod(m)}
                      className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${loginMethod === m ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                      {m === 'email' ? <Mail className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Email login ── */}
              {isLogin && loginMethod === 'email' && (
                <form onSubmit={handleEmailLogin} className="space-y-3">
                  <div className="relative">
                    <Mail className={INPUT_ICON} />
                    <input type="email" placeholder="Email Address" className={INPUT} value={form.loginEmail} onChange={set('loginEmail')} required />
                  </div>
                  <div className="relative">
                    <Lock className={INPUT_ICON} />
                    <input type={showPw ? 'text' : 'password'} placeholder="Password" className={INPUT + ' pr-11'} value={form.password} onChange={set('password')} required />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-4 top-3.5 text-zinc-500 hover:text-white">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><span>Log In</span><ChevronRight className="w-4 h-4" /></>}
                  </button>
                </form>
              )}

              {/* ── Phone login ── */}
              {isLogin && loginMethod === 'phone' && (
                <form onSubmit={handlePhoneLogin} className="space-y-3">
                  <div>
                    <div className="relative">
                      <Phone className={INPUT_ICON} />
                      <input type="tel" placeholder="+1 (555) 000-0000" className={INPUT} value={form.phone} onChange={set('phone')} required />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1.5 pl-1">Include country code (e.g. +1 for US)</p>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><span>Send OTP</span><ChevronRight className="w-4 h-4" /></>}
                  </button>
                </form>
              )}

              {/* ── Signup form ── */}
              {!isLogin && (
                <form onSubmit={handleSignup} className="space-y-3">
                  {!isRecruiter && (
                    <label className="border border-dashed border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-2xl p-3 text-center cursor-pointer flex flex-col items-center gap-1 transition">
                      <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                      <span className="text-xs font-bold text-white">Autofill with Resume</span>
                      <span className="text-[10px] text-zinc-500">Upload PDF to extract your info</span>
                      <input type="file" accept=".pdf" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const fd = new FormData(); fd.append('file', file);
                        const toastId = toast.loading('Parsing resume...');
                        try {
                          const r = await fetch(`${api}/parse-resume`, { method: 'POST', headers: { Authorization: 'Bearer mock_token_for_guest_signup' }, body: fd });
                          const d = await r.json(); const p = d.personal ?? {};
                          const parts = (p.name ?? '').split(' ');
                          setForm(prev => ({ ...prev, firstName: parts[0] ?? prev.firstName, middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '', lastName: parts.length > 1 ? parts[parts.length - 1] : prev.lastName, email: p.email ?? prev.email, phone: p.phone ?? prev.phone }));
                          toast.success('Fields populated!', { id: toastId });
                        } catch { toast.error('Could not parse resume.', { id: toastId }); }
                      }} />
                    </label>
                  )}

                  {/* Name row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <User className={INPUT_ICON} />
                      <input type="text" placeholder="First Name" className={INPUT} value={form.firstName} onChange={set('firstName')} required />
                    </div>
                    <div className="relative">
                      <User className={INPUT_ICON} />
                      <input type="text" placeholder="Last Name" className={INPUT} value={form.lastName} onChange={set('lastName')} required />
                    </div>
                  </div>
                  <div className="relative">
                    <User className={INPUT_ICON} />
                    <input type="text" placeholder="Middle Name (optional)" className={INPUT} value={form.middleName} onChange={set('middleName')} />
                  </div>

                  <div className="relative">
                    <Mail className={INPUT_ICON} />
                    <input type="email" placeholder="Email Address" className={INPUT} value={form.email} onChange={set('email')} required />
                  </div>
                  <div className="relative">
                    <Phone className={INPUT_ICON} />
                    <input type="tel" placeholder="Phone (optional)" className={INPUT} value={form.phone} onChange={set('phone')} />
                  </div>
                  <div className="relative">
                    <Lock className={INPUT_ICON} />
                    <input type={showPw ? 'text' : 'password'} placeholder="Password" className={INPUT + ' pr-11'} value={form.password} onChange={set('password')} required />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-4 top-3.5 text-zinc-500 hover:text-white">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className={INPUT_ICON} />
                    <input type="password" placeholder="Confirm Password" className={INPUT} value={form.confirmPassword} onChange={set('confirmPassword')} required />
                  </div>

                  <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><span>Continue</span><ChevronRight className="w-4 h-4" /></>}
                  </button>
                </form>
              )}

              {/* Toggle */}
              <p className="text-center text-xs text-zinc-500 border-t border-white/5 pt-4">
                {isLogin
                  ? <>New here?{' '}<button onClick={() => setIsLogin(false)} className="text-indigo-400 font-bold hover:underline">Create free account</button></>
                  : <>Have an account?{' '}<button onClick={() => setIsLogin(true)} className="text-indigo-400 font-bold hover:underline">Log in</button></>
                }
              </p>

              {isLogin && <SocialLoginButtons isRecruiter={isRecruiter} />}
            </motion.div>
          )}

          {/* ── EMAIL OTP ── */}
          {step === 'emailOtp' && (
            <motion.div key="emailOtp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-center">
              <div>
                <div className="inline-flex p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl mb-3 text-purple-400">
                  <Mail className="w-6 h-6 animate-bounce" />
                </div>
                <h3 className="text-xl font-bold">Verify Your Email</h3>
                <p className="text-xs text-zinc-400 mt-2 max-w-xs mx-auto">
                  We sent a 6-digit code to <strong className="text-zinc-200">{form.email}</strong>
                </p>
              </div>
              <OtpRow digits={emailOtp} setDigits={setEmailOtp} refs={emailRefs} color="purple" />
              <CountdownRow onResend={resendEmailOtp} />
              <div className="flex gap-3">
                <button onClick={() => setStep('form')} className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button onClick={verifyEmailOtp} disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition disabled:opacity-50">
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Verify Email'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── PHONE OTP ── */}
          {step === 'phoneOtp' && (
            <motion.div key="phoneOtp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-center">
              <div>
                <div className="inline-flex p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl mb-3 text-cyan-400">
                  <Phone className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold">Verify Your Phone</h3>
                <p className="text-xs text-zinc-400 mt-2 max-w-xs mx-auto">
                  SMS sent to <strong className="text-zinc-200">{form.phone}</strong>
                </p>
              </div>
              <OtpRow digits={phoneOtp} setDigits={setPhoneOtp} refs={phoneRefs} color="cyan" />
              <CountdownRow onResend={() => { setCountdown(60); toast.info('Resend not yet implemented for phone.'); }} />
              <div className="flex gap-3">
                <button onClick={() => setStep('form')} className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button onClick={verifyPhoneOtp} disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 transition disabled:opacity-50">
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Verify & Sign In'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── CONSENT ── */}
          {step === 'consent' && (
            <motion.div key="consent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="text-center">
                <div className="inline-flex p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-3 text-emerald-400">
                  <ShieldCheck className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold">AI Biometric & Anti-Cheat Consent</h3>
                <p className="text-xs text-zinc-500 mt-1">Required for secure interview sessions</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs space-y-2 text-zinc-400 leading-relaxed">
                <p>To protect hiring integrity, RecruitEdge uses:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-300">
                  <li><strong>Biometric check</strong> — face matching against government ID</li>
                  <li><strong>Audio scanner</strong> — detects virtual audio routing</li>
                  <li><strong>OS proctoring</strong> — tab focus & fullscreen monitoring</li>
                </ul>
                <p className="text-[10px] text-zinc-500 border-t border-white/5 pt-2 italic">All data is stored securely under your UID and automatically purged after assessments.</p>
              </div>
              <div className="space-y-2">
                <button onClick={finalizeSignup} disabled={loading} className="w-full py-4 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-50">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm & Create Account'}
                </button>
                <button onClick={reset} className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition underline">Cancel</button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
