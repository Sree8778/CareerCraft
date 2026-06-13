'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { API_BASE, jsonHeaders } from '@/lib/api';
import {
  Sparkles, User, Briefcase, Upload, Check,
  ChevronRight, ChevronLeft, MapPin, Phone, FileText,
} from 'lucide-react';

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1 — basic profile
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');

  // Step 2 — preferences (candidates) / org info (recruiters)
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('');
  const [jobTypes, setJobTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/');
    if (user) setFullName(user.name || '');
  }, [loading, isAuthenticated, user, router]);

  const toggleJobType = (t: string) =>
    setJobTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, string> = { fullName, phone, location, bio };
      if (user.role === 'recruiter') {
        payload.organizationName = orgName;
        payload.industry = industry;
      }
      await fetch(`${API_BASE}/users/${user.id}/profile`, {
        method: 'PATCH',
        headers: jsonHeaders(user.id),
        body: JSON.stringify(payload),
      });
    } catch { /* non-fatal */ }
    finally { setSaving(false); }
  };

  const finish = async () => {
    setSaving(true);
    await saveProfile();
    try {
      // Mark onboarding complete in Firestore
      await setDoc(doc(db, 'users', user!.id), { onboardingCompleted: true }, { merge: true });
    } catch { /* firebase may be mock */ }
    localStorage.setItem(`onboarding_done_${user!.id}`, '1');
    toast.success('Profile set up! Welcome to CareerCraft.');
    router.push(user?.role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard');
    setSaving(false);
  };

  if (loading || !user) return null;

  const steps = [
    { label: 'Welcome', icon: <Sparkles className="w-4 h-4" /> },
    { label: 'Your Profile', icon: <User className="w-4 h-4" /> },
    { label: user.role === 'recruiter' ? 'Your Company' : 'Preferences', icon: <Briefcase className="w-4 h-4" /> },
    { label: 'Get Started', icon: <Check className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#080b14] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Progress stepper */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                i === step ? 'bg-indigo-600 text-white' : i < step ? 'bg-emerald-600/30 text-emerald-400' : 'bg-white/5 text-zinc-500'
              }`}>
                {i < step ? <Check className="w-3 h-3" /> : s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < TOTAL_STEPS - 1 && <div className={`w-6 h-px ${i < step ? 'bg-emerald-500' : 'bg-zinc-800'}`} />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 0 — Welcome */}
          {step === 0 && (
            <motion.div key="step0"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="bg-[#111827] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-white">Welcome to CareerCraft, {user.name}!</h1>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
                  {user.role === 'recruiter'
                    ? "Let's set up your company profile so candidates can find and trust you."
                    : "Let's build your profile so recruiters can discover you and AI can personalize your experience."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['2 minutes', 'AI-powered', 'Private & secure'].map(tag => (
                  <div key={tag} className="bg-white/5 border border-white/5 rounded-xl py-2 text-[11px] text-zinc-400 font-medium">{tag}</div>
                ))}
              </div>
              <button onClick={() => setStep(1)}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition">
                Let's go <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* STEP 1 — Basic profile */}
          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="bg-[#111827] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl"
            >
              <div className="space-y-1">
                <h2 className="text-xl font-black text-white">Your Profile</h2>
                <p className="text-zinc-400 text-sm">Fill in the basics — you can always update these later.</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Full Name</label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 gap-3 focus-within:border-indigo-500/50">
                    <User className="w-4 h-4 text-zinc-500 shrink-0" />
                    <input value={fullName} onChange={e => setFullName(e.target.value)}
                      className="flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-500 focus:outline-none"
                      placeholder="Jane Doe" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Phone</label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 gap-3 focus-within:border-indigo-500/50">
                    <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                    <input value={phone} onChange={e => setPhone(e.target.value)}
                      className="flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-500 focus:outline-none"
                      placeholder="+1 555 000 0000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Location</label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 gap-3 focus-within:border-indigo-500/50">
                    <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
                    <input value={location} onChange={e => setLocation(e.target.value)}
                      className="flex-1 bg-transparent py-3 text-sm text-white placeholder-zinc-500 focus:outline-none"
                      placeholder="Miami, FL" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Bio</label>
                  <div className="flex items-start bg-white/5 border border-white/10 rounded-xl px-4 py-3 gap-3 focus-within:border-indigo-500/50">
                    <FileText className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                      className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none resize-none"
                      placeholder="Brief intro about yourself..." />
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(0)}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-4 py-3 rounded-xl border border-white/5 transition">
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button onClick={async () => { await saveProfile(); setStep(2); }}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition">
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 — Preferences / Company */}
          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="bg-[#111827] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl"
            >
              {user.role === 'recruiter' ? (
                <>
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-white">Your Company</h2>
                    <p className="text-zinc-400 text-sm">Tell candidates about your organization.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Organization Name</label>
                      <input value={orgName} onChange={e => setOrgName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                        placeholder="Acme Corp" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Industry</label>
                      <input value={industry} onChange={e => setIndustry(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                        placeholder="Software / SaaS" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <h2 className="text-xl font-black text-white">Job Preferences</h2>
                    <p className="text-zinc-400 text-sm">What kinds of roles are you looking for?</p>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Employment Type</label>
                    <div className="grid grid-cols-2 gap-3">
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
                </>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-4 py-3 rounded-xl border border-white/5 transition">
                  <ChevronLeft className="w-3.5 h-3.5" /> Back
                </button>
                <button onClick={() => setStep(3)}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition">
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 — Final / Launch */}
          {step === 3 && (
            <motion.div key="step3"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              className="bg-[#111827] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-600 to-cyan-500 flex items-center justify-center">
                <Check className="w-8 h-8 text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white">You're all set!</h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">
                  {user.role === 'recruiter'
                    ? 'Head to your dashboard to post your first job requisition and start sourcing talent.'
                    : 'Head to your dashboard to browse jobs, build your resume, and schedule interviews.'}
                </p>
              </div>
              <div className="space-y-3">
                {user.role === 'candidate' && (
                  <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 text-left space-y-2">
                    <p className="text-xs font-bold text-indigo-300 flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5" /> Next step: Upload your resume
                    </p>
                    <p className="text-xs text-zinc-400">Our AI will parse it and score your ATS match for every job you apply to.</p>
                  </div>
                )}
                {user.role === 'recruiter' && (
                  <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-4 text-left space-y-2">
                    <p className="text-xs font-bold text-purple-300 flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5" /> Next step: Post your first job
                    </p>
                    <p className="text-xs text-zinc-400">AI copilot will surface the best-matching candidates automatically.</p>
                  </div>
                )}
              </div>
              <button onClick={finish} disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition">
                {saving ? 'Saving…' : 'Launch Dashboard'} <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
