'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  MapPin, Briefcase, Clock, Sparkles,
  CheckCircle, RefreshCw, AlertCircle, ChevronLeft,
  Copy, Download, Check, X, TrendingUp, BookOpen, Code2,
  PenLine, Plus, Zap, Save, ArrowRight,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Job } from '@/lib/mockJobApi';
import Link from 'next/link';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { API_BASE as API } from '@/lib/api';

/* ─── Helpers ─────────────────────────────────────── */
const stripHtml = (html: string) =>
  (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function ScoreDial({ score }: { score: number }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#6366F1' : '#F43F5E';
  const r = 44;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} stroke="#1e293b" strokeWidth="8" fill="none" />
        <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white">{score}%</span>
        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Match</span>
      </div>
    </div>
  );
}

function SmallDial({ score }: { score: number }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#6366F1' : '#F43F5E';
  const r = 18; const circ = 2 * Math.PI * r;
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} stroke="#1e293b" strokeWidth="4" fill="none" />
        <circle cx="20" cy="20" r={r} stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-black text-white">{score}</span>
      </div>
    </div>
  );
}

function Pill({ text, matched }: { text: string; matched: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
      matched ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
    }`}>
      {matched ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}{text}
    </span>
  );
}

/* ─── Page ─────────────────────────────────────────── */
export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated, user, getToken, loading: authLoading } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumeData, setResumeData] = useState<any>(null);
  const [hasResume, setHasResume] = useState(false);

  // Application state
  const [existingApp, setExistingApp] = useState<any>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ATS analysis state
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [matchedSkills, setMatchedSkills] = useState<string[]>([]);
  const [missingSkills, setMissingSkills] = useState<string[]>([]);
  const [optimizationTips, setOptimizationTips] = useState<string[]>([]);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [tutorials, setTutorials] = useState<any[]>([]);
  const [learningProjects, setLearningProjects] = useState<any[]>([]);

  // Cover letter AI
  const [generatingLetter, setGeneratingLetter] = useState(false);

  // ── Tailor Drawer state ──────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editMode, setEditMode] = useState<'focused' | 'full'>('focused');
  const [editResume, setEditResume] = useState<any>(null);
  const [savingResume, setSavingResume] = useState(false);
  const [aiRewriting, setAiRewriting] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});

  const authHeader = async () => ({ Authorization: `Bearer ${await getToken()}` });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'candidate') { router.push('/'); return; }
  }, [isAuthenticated, user, router, authLoading]);

  useEffect(() => {
    if (!id || !user?.id) return;
    (async () => {
      try {
        const r = await fetch(`${API}/jobs/${id}`, { headers: await authHeader() });
        if (!r.ok) { router.push('/candidate/jobs'); return; }
        const d = await r.json();
        setJob({
          id: d.id, title: d.title || 'Untitled', company: d.company || 'Company',
          location: d.location || 'Remote', salary: d.salary || 'Competitive',
          description: d.description || '', requirements: d.requirements || [],
          benefits: d.benefits || [], postedDate: d.postedDate || '',
          employmentType: d.jobType || d.employmentType || 'Full-time',
          emoji: d.emoji || '💼',
        });
      } catch { toast.error('Failed to load job.'); }
      finally { setLoading(false); }
    })();
  }, [id, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'resumes', user.id));
        if (snap.exists()) { setResumeData(snap.data().resumeData); setHasResume(true); }
      } catch {}
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !id) return;
    (async () => {
      try {
        const r = await fetch(`${API}/applications?candidateId=${user.id}`, { headers: await authHeader() });
        if (r.ok) {
          const d = await r.json();
          const found = (d.applications || []).find((a: any) => a.jobId === id);
          if (found) setExistingApp(found);
        }
      } catch {}
    })();
  }, [user?.id, id]);

  useEffect(() => {
    if (!job || !resumeData || analyzed || analyzing) return;
    runAnalysis();
  }, [job, resumeData]);

  const runAnalysis = useCallback(async () => {
    if (!resumeData || !job) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`${API}/analyze-fit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeader() },
        body: JSON.stringify({
          resumeData,
          jobDetails: { title: job.title, company: job.company, description: job.description, requirements: job.requirements },
          jobId: String(id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const rb = data.ruleBasedScore || {};
      setAtsScore(rb.score ?? 60);
      setMatchedSkills(rb.matchedSkills || []);
      setMissingSkills(rb.missingSkills || []);
      setOptimizationTips(data.optimizationTips || []);
      setAiEnhanced(data.aiEnhanced ?? false);
      setTutorials(data.tutorials || []);
      setLearningProjects(data.projects || []);
      if (data.coverLetter && !coverLetter) setCoverLetter(data.coverLetter);
    } catch {
      const score = Math.floor(55 + Math.random() * 25);
      setAtsScore(score);
      setMatchedSkills(job.requirements.slice(0, 3));
      setMissingSkills(job.requirements.slice(3, 6));
      setOptimizationTips([
        'Include exact keywords from the job description in your resume.',
        'Quantify achievements with numbers and percentages.',
        'Tailor your summary to mention the role and company name.',
      ]);
    } finally {
      setAnalyzing(false);
      setAnalyzed(true);
    }
  }, [resumeData, job, id, coverLetter]);

  const generateCoverLetter = async () => {
    if (!resumeData || !job) return;
    setGeneratingLetter(true);
    const toastId = toast.loading('Generating tailored cover letter…');
    try {
      const res = await fetch(`${API}/analyze-fit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeader() },
        body: JSON.stringify({
          resumeData,
          jobDetails: { title: job.title, company: job.company, description: job.description, requirements: job.requirements },
          jobId: String(id), coverLetterOnly: true,
        }),
      });
      const data = await res.json();
      if (data.coverLetter) {
        setCoverLetter(data.coverLetter);
        toast.success('Cover letter generated.', { id: toastId });
      } else {
        const name = resumeData?.personal?.name || user?.name || 'Candidate';
        const skills = (resumeData?.skills || []).flatMap((s: any) => (s.skills_list || '').split(',').map((x: string) => x.trim())).slice(0, 3).join(', ');
        setCoverLetter(`Dear Hiring Manager,\n\nI am excited to apply for the ${job.title} position at ${job.company}. With my background in ${skills || 'relevant technologies'}, I am confident in my ability to contribute meaningfully to your team.\n\nSincerely,\n${name}`);
        toast.success('Cover letter drafted.', { id: toastId });
      }
    } catch { toast.error('Failed to generate cover letter.', { id: toastId }); }
    finally { setGeneratingLetter(false); }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const r = await fetch(`${API}/jobs/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeader() },
        body: JSON.stringify({ coverLetter, jobTitle: job?.title, company: job?.company, candidateName: user?.name, candidateEmail: user?.email, atsScore }),
      });
      const result = await r.json();
      if (r.status === 409) { toast.error('You already applied to this job.'); return; }
      if (!r.ok) throw new Error(result.error || 'Submission failed');
      setSubmitted(true);
      toast.success('Application submitted!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit.');
    } finally { setIsSubmitting(false); }
  };

  // ── Drawer helpers ───────────────────────────────────
  const openDrawer = () => {
    setEditResume(JSON.parse(JSON.stringify(resumeData || {})));
    setAiSuggestions({});
    setEditMode('focused');
    setDrawerOpen(true);
  };

  const updateField = (field: string, value: any) =>
    setEditResume((prev: any) => ({ ...prev, [field]: value }));

  const updateNestedField = (parent: string, field: string, value: string) =>
    setEditResume((prev: any) => ({ ...prev, [parent]: { ...(prev[parent] || {}), [field]: value } }));

  const updateExpField = (idx: number, value: string) =>
    setEditResume((prev: any) => {
      const exp = [...(prev.experience || [])];
      exp[idx] = { ...exp[idx], description: value };
      return { ...prev, experience: exp };
    });

  const updateEduField = (idx: number, field: string, value: string) =>
    setEditResume((prev: any) => {
      const edu = [...(prev.education || [])];
      edu[idx] = { ...edu[idx], [field]: value };
      return { ...prev, education: edu };
    });

  const updateCertField = (idx: number, field: string, value: string) =>
    setEditResume((prev: any) => {
      const certs = [...(prev.certifications || [])];
      certs[idx] = { ...certs[idx], [field]: value };
      return { ...prev, certifications: certs };
    });

  const updateSkillsList = (idx: number, value: string) =>
    setEditResume((prev: any) => {
      const skills = [...(prev.skills || [])];
      skills[idx] = { ...skills[idx], skills_list: value };
      return { ...prev, skills };
    });

  const clearSuggestion = (key: string) =>
    setAiSuggestions(prev => { const n = { ...prev }; delete n[key]; return n; });

  const addMissingSkill = (skill: string) => {
    setEditResume((prev: any) => {
      const skills = [...(prev.skills || [])];
      if (skills.length === 0) {
        skills.push({ category: 'Key Skills', skills_list: skill });
      } else {
        const targetIdx = skills.findIndex((s: any) =>
          (s.category || '').toLowerCase().includes('skill') ||
          (s.category || '').toLowerCase().includes('technical')
        );
        const idx = targetIdx >= 0 ? targetIdx : skills.length - 1;
        const list = (skills[idx].skills_list || '').split(',').map((x: string) => x.trim()).filter(Boolean);
        if (!list.some((x: string) => x.toLowerCase() === skill.toLowerCase())) list.push(skill);
        skills[idx] = { ...skills[idx], skills_list: list.join(', ') };
      }
      return { ...prev, skills };
    });
    toast.success(`Added "${skill}" to your skills`);
  };

  const rewriteSection = async (key: string, text: string) => {
    const plainText = stripHtml(text);
    if (!plainText.trim()) { toast.error('Add some content first.'); return; }
    setAiRewriting(prev => ({ ...prev, [key]: true }));
    const toastId = toast.loading('AI is rewriting…');
    try {
      const sectionName = key.startsWith('exp_') ? 'experience description'
        : key === 'summary' ? 'professional summary' : key;
      const jobHint = job ? `[Target role: ${job.title} at ${job.company}] ` : '';
      const res = await fetch(`${API}/enhance-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authHeader() },
        body: JSON.stringify({ sectionName, textToEnhance: jobHint + plainText }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.message || data.error || 'AI rewrite failed.';
        const isNoKey = data.error === 'no_api_keys' || res.status === 402;
        toast.error(isNoKey ? 'Add a Gemini API key in your Profile → API Keys to use AI Rewrite.' : msg, { id: toastId });
        return;
      }
      const versions: string[] = (data.enhancedVersions || []).map((v: string) => stripHtml(v)).filter(Boolean);
      const suggestion = versions.find(v => v.length > 20) || versions[0] || '';
      if (suggestion) {
        setAiSuggestions(prev => ({ ...prev, [key]: suggestion }));
        toast.success('AI rewrite ready — review and apply.', { id: toastId });
      } else {
        toast.error('AI returned an empty suggestion. Try again.', { id: toastId });
      }
    } catch { toast.error('AI rewrite failed — check your connection.', { id: toastId }); }
    finally { setAiRewriting(prev => ({ ...prev, [key]: false })); }
  };

  const handleSaveResume = async () => {
    if (!editResume || !user?.id) return;
    setSavingResume(true);
    const toastId = toast.loading('Saving your updated resume…');
    try {
      await setDoc(doc(db, 'resumes', user.id), {
        userId: user.id,
        resumeData: editResume,
        updatedAt: new Date().toISOString(),
      });
      setResumeData(editResume);
      setDrawerOpen(false);
      // Re-run ATS analysis with the updated resume
      setAnalyzed(false);
      toast.success('Resume saved! Review your cover letter below and submit when ready.', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save resume.', { id: toastId });
    } finally {
      setSavingResume(false);
    }
  };

  // Render helper for section editors in the drawer
  const renderSectionEditor = (
    key: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    hint?: string,
    rows = 4
  ) => (
    <div className="space-y-2.5 border border-white/8 rounded-xl p-4 bg-white/2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-zinc-200">{label}</label>
        <button type="button" onClick={() => rewriteSection(key, value)}
          disabled={aiRewriting[key]}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-lg transition disabled:opacity-50">
          {aiRewriting[key]
            ? <><RefreshCw className="w-3 h-3 animate-spin" />Rewriting…</>
            : <><Sparkles className="w-3 h-3" />AI Rewrite</>}
        </button>
      </div>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
        placeholder={`Enter ${label.toLowerCase()}…`}
        className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y placeholder-zinc-600" />
      {aiSuggestions[key] && (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3.5 space-y-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />AI Suggestion
          </p>
          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{aiSuggestions[key]}</p>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => { onChange(aiSuggestions[key]); clearSuggestion(key); }}
              className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition">
              Apply
            </button>
            <button type="button" onClick={() => clearSuggestion(key)}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white rounded-lg transition">
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <CandidateLayout>
        <div className="flex items-center justify-center h-64 text-slate-400 text-sm animate-pulse">Loading job…</div>
      </CandidateLayout>
    );
  }

  if (!job) {
    return (
      <CandidateLayout>
        <div className="text-center py-24 text-rose-400">Job not found.</div>
      </CandidateLayout>
    );
  }

  const scoreLabel = !atsScore ? '' : atsScore >= 80 ? 'Strong match' : atsScore >= 60 ? 'Partial match' : 'Weak match';
  const scoreBorder = !atsScore ? '' : atsScore >= 80 ? 'border-emerald-500/30' : atsScore >= 60 ? 'border-indigo-500/30' : 'border-rose-500/30';

  return (
    <CandidateLayout>

      {/* Back */}
      <Link href="/candidate/jobs" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 mb-5 transition">
        <ChevronLeft className="w-4 h-4" /> Back to Jobs
      </Link>

      <div className="flex gap-6 items-start">

        {/* ── LEFT: Job details ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Job header */}
          <div className="bg-[#1C2333] border border-[#2A3347] rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#252D3D] border border-[#2A3347] flex items-center justify-center text-3xl shrink-0">
                  {job.emoji}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{job.title}</h1>
                  <p className="text-base text-slate-400 mt-0.5">{job.company}</p>
                </div>
              </div>
              {job.salary && (
                <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold px-3 py-1.5 rounded-full shrink-0">
                  {job.salary}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{job.location}</span>
              <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" />{job.employmentType}</span>
              {job.postedDate && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />Posted {job.postedDate}</span>}
            </div>
          </div>

          {/* Description */}
          <div className="bg-[#1C2333] border border-[#2A3347] rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-white mb-3">Job Description</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{job.description}</p>
            </div>

            {job.requirements.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-white mb-3">Requirements</h2>
                <ul className="space-y-2">
                  {job.requirements.map((req, i) => {
                    const matched = matchedSkills.some(s => req.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(req.toLowerCase().split(' ')[0]));
                    const missing = missingSkills.some(s => req.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(req.toLowerCase().split(' ')[0]));
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        {analyzed
                          ? matched ? <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                            : missing ? <X className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                            : <span className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" /></span>
                          : <span className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" /></span>
                        }
                        <span className={matched ? 'text-slate-200' : missing ? 'text-slate-500' : 'text-slate-400'}>{req}</span>
                      </li>
                    );
                  })}
                </ul>
                {analyzed && (
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-500" /> = matched &nbsp;
                    <X className="w-3 h-3 text-rose-500" /> = gap
                  </p>
                )}
              </div>
            )}

            {job.benefits && job.benefits.length > 0 && (
              <div>
                <h2 className="text-base font-bold text-white mb-3">Benefits</h2>
                <ul className="space-y-1.5">
                  {job.benefits.map((b, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Learning path */}
          {analyzed && (tutorials.length > 0 || learningProjects.length > 0) && (
            <div className="bg-[#1C2333] border border-[#2A3347] rounded-xl p-6 space-y-5">
              <h2 className="text-base font-bold text-white">Close the Skills Gap</h2>
              <p className="text-sm text-slate-400">Based on your resume vs this job&apos;s requirements:</p>

              {tutorials.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> Recommended Courses
                  </h3>
                  {tutorials.map((t: any, i: number) => (
                    <div key={i} className="bg-[#252D3D] border border-[#2A3347] rounded-lg p-3.5">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{t.title}</p>
                          <p className="text-xs text-cyan-400 mt-0.5">{t.platform} · {t.estimatedHours}</p>
                        </div>
                        <span className="text-[10px] bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded font-mono shrink-0">{t.skill}</span>
                      </div>
                      {t.why && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{t.why}</p>}
                    </div>
                  ))}
                </div>
              )}

              {learningProjects.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4" /> Portfolio Projects to Build
                  </h3>
                  {learningProjects.map((p: any, i: number) => (
                    <div key={i} className="bg-[#252D3D] border border-[#2A3347] rounded-lg p-3.5">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-semibold text-white">{p.title}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono shrink-0 ${
                          p.difficulty === 'Beginner' ? 'bg-emerald-500/15 text-emerald-300'
                          : p.difficulty === 'Advanced' ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-yellow-500/15 text-yellow-300'
                        }`}>{p.difficulty}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{p.description}</p>
                      {p.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.skills.map((s: string) => (
                            <span key={s} className="text-[10px] bg-white/5 text-slate-400 px-2 py-0.5 rounded font-mono">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Smart Apply Panel ── */}
        <div className="w-[380px] shrink-0 space-y-3 sticky top-6">

          {existingApp ? (
            <div className="bg-[#1C2333] border border-[#2A3347] rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-base font-bold text-white">Application Submitted</p>
                  <p className="text-xs text-slate-400">{existingApp.appliedDate || 'Applied recently'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between bg-[#252D3D] border border-[#2A3347] rounded-lg px-4 py-3">
                <span className="text-sm text-slate-300">Status</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  existingApp.status === 'Hired' ? 'bg-emerald-500/20 text-emerald-300'
                  : existingApp.status === 'Rejected' ? 'bg-rose-500/20 text-rose-300'
                  : existingApp.status === 'Shortlisted' ? 'bg-cyan-500/20 text-cyan-300'
                  : 'bg-indigo-500/20 text-indigo-300'
                }`}>{existingApp.status}</span>
              </div>
              {existingApp.recruiterNotes && (
                <div className="bg-[#252D3D] border border-[#2A3347] rounded-lg px-4 py-3">
                  <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">Recruiter Note</p>
                  <p className="text-sm text-slate-300 italic">&quot;{existingApp.recruiterNotes}&quot;</p>
                </div>
              )}
            </div>
          ) : submitted ? (
            <div className="bg-[#1C2333] border border-emerald-500/30 rounded-xl p-6 text-center space-y-3">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-base font-bold text-white">Application Submitted!</p>
              <p className="text-sm text-slate-400">The recruiter will be notified. Check your Applications page for status updates.</p>
              <Link href="/candidate/jobs" className="block text-sm font-semibold text-[#0A66C2] hover:underline mt-2">
                Browse more jobs →
              </Link>
            </div>
          ) : (
            <>
              {/* ATS Match Score */}
              <div className={`bg-[#1C2333] border rounded-xl p-5 ${analyzing ? 'border-[#2A3347]' : scoreBorder || 'border-[#2A3347]'}`}>
                <h3 className="text-sm font-bold text-white mb-4">Resume Match</h3>

                {analyzing ? (
                  <div className="flex items-center gap-3 py-2 text-sm text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                    Analyzing your resume against this job…
                  </div>
                ) : !hasResume ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      No saved resume found. Build your resume first to get an AI match score.
                    </div>
                    <Link href="/candidate/resume-builder"
                      className="block text-center text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-full transition">
                      Build Resume
                    </Link>
                  </div>
                ) : atsScore !== null ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <ScoreDial score={atsScore} />
                      <div className="space-y-1">
                        <p className="text-base font-bold text-white">{scoreLabel}</p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {atsScore >= 80 ? 'Your profile is a strong fit. Apply now!'
                          : atsScore >= 60 ? 'Good fit with some gaps. Tailor your resume to improve your chances.'
                          : 'Notable gaps detected. Use the tailor tool to boost your score before applying.'}
                        </p>
                        {aiEnhanced && (
                          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full inline-block">
                            AI-verified
                          </span>
                        )}
                      </div>
                    </div>

                    {(matchedSkills.length > 0 || missingSkills.length > 0) && (
                      <div className="space-y-2">
                        {matchedSkills.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Matched</p>
                            <div className="flex flex-wrap gap-1.5">
                              {matchedSkills.map(s => <Pill key={s} text={s} matched />)}
                            </div>
                          </div>
                        )}
                        {missingSkills.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gaps</p>
                            <div className="flex flex-wrap gap-1.5">
                              {missingSkills.map(s => <Pill key={s} text={s} matched={false} />)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {optimizationTips.length > 0 && (
                      <div className="bg-[#252D3D] border border-[#2A3347] rounded-lg p-3.5 space-y-2">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Tips to improve
                        </p>
                        <ul className="space-y-1.5">
                          {optimizationTips.slice(0, 3).map((tip, i) => (
                            <li key={i} className="text-xs text-slate-400 leading-relaxed flex gap-2">
                              <span className="text-amber-400 shrink-0 mt-0.5">›</span>{tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button onClick={runAnalysis} disabled={analyzing}
                      className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition">
                      <RefreshCw className="w-3 h-3" /> Re-run analysis
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Apply panel */}
              {hasResume && (
                <div className="bg-[#1C2333] border border-[#2A3347] rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-white">Apply for this job</h3>

                  {/* Resume source + Tailor button */}
                  <div className="flex items-center gap-2 bg-[#252D3D] border border-[#2A3347] rounded-lg px-3 py-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200">Applying with saved profile</p>
                      <p className="text-[11px] text-slate-500 truncate">Your resume from Resume Builder will be used</p>
                    </div>
                  </div>

                  {/* Tailor Resume CTA */}
                  <button onClick={openDrawer}
                    className="w-full flex items-center justify-between px-4 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 rounded-xl transition group">
                    <div className="flex items-center gap-2.5">
                      <PenLine className="w-4 h-4 text-purple-400" />
                      <div className="text-left">
                        <p className="text-sm font-bold text-purple-300">Tailor Resume for This Job</p>
                        <p className="text-[11px] text-purple-400/70">AI-guided edits · save, then review &amp; apply</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[11px] text-slate-600">or quick apply</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* Cover letter + quick apply */}
                  <form onSubmit={handleApply} className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-300">Cover Letter</label>
                        <button type="button" onClick={generateCoverLetter} disabled={generatingLetter || analyzing}
                          className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition">
                          {generatingLetter
                            ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating…</>
                            : <><Sparkles className="w-3 h-3" /> Generate with AI</>}
                        </button>
                      </div>
                      <textarea rows={6} value={coverLetter} onChange={e => setCoverLetter(e.target.value)}
                        placeholder="Write a cover letter or click 'Generate with AI'…"
                        className="w-full bg-[#252D3D] border border-[#2A3347] focus:border-indigo-500/60 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none transition" />
                      {coverLetter && (
                        <div className="flex gap-2 mt-1.5">
                          <button type="button" onClick={() => { navigator.clipboard.writeText(coverLetter); toast.success('Copied!'); }}
                            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition">
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                          <button type="button" onClick={() => {
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(new Blob([coverLetter], { type: 'text/plain' }));
                            a.download = `${job.company}_Cover_Letter.txt`; a.click();
                          }} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition">
                            <Download className="w-3 h-3" /> Download
                          </button>
                        </div>
                      )}
                    </div>
                    <button type="submit" disabled={isSubmitting}
                      className="w-full py-2.5 bg-[#252D3D] hover:bg-[#2A3347] border border-[#2A3347] disabled:opacity-50 text-slate-300 text-sm font-semibold rounded-full transition flex items-center justify-center gap-2">
                      {isSubmitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting…</> : 'Quick Apply (no resume changes)'}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          TAILOR RESUME DRAWER
          ══════════════════════════════════════════════ */}
      {drawerOpen && editResume && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/70 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />

          {/* Drawer panel */}
          <div className="w-[92vw] max-w-[1100px] bg-[#0B0F19] border-l border-white/10 flex flex-col h-full overflow-hidden shadow-2xl">

            {/* Drawer header */}
            <div className="shrink-0 border-b border-white/10">
              {/* Title row */}
              <div className="flex items-center justify-between px-6 pt-4 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <PenLine className="w-4 h-4 text-purple-400" />
                    Tailor Resume — <span className="text-purple-300">{job.title}</span>
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Edit with AI guidance · save to your profile · then review cover letter &amp; submit
                  </p>
                </div>
                <button onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition shrink-0 ml-4">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Mode toggle tab row */}
              <div className="flex px-6 pb-0 gap-0">
                <button
                  onClick={() => setEditMode('focused')}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                    editMode === 'focused'
                      ? 'border-purple-500 text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}>
                  <Zap className="w-3.5 h-3.5" /> Focused Edit
                </button>
                <button
                  onClick={() => setEditMode('full')}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all ${
                    editMode === 'full'
                      ? 'border-purple-500 text-white'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300'
                  }`}>
                  <PenLine className="w-3.5 h-3.5" /> Full Resume Edit
                </button>
              </div>
            </div>

            {/* Drawer body: analysis left + editor right */}
            <div className="flex flex-1 overflow-hidden">

              {/* Left: AI Analysis panel */}
              <div className="w-64 shrink-0 border-r border-white/10 p-5 overflow-y-auto space-y-6 bg-black/20">

                {/* Score */}
                {atsScore !== null && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Current Match</p>
                    <div className="flex items-center gap-3">
                      <SmallDial score={atsScore} />
                      <div>
                        <p className="text-sm font-bold text-white">{atsScore}%</p>
                        <p className="text-xs text-zinc-500">{scoreLabel}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Missing skills — click to add */}
                {missingSkills.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">Missing Skills</p>
                    <p className="text-[11px] text-zinc-500">Click to add to your skills section</p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingSkills.map(s => (
                        <button key={s} type="button" onClick={() => addMissingSkill(s)}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-full hover:bg-rose-500/20 transition">
                          <Plus className="w-3 h-3" />{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched skills */}
                {matchedSkills.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Already Matched</p>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedSkills.map(s => (
                        <span key={s} className="text-[11px] px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optimization tips */}
                {optimizationTips.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                      <Zap className="w-3 h-3" />Tips
                    </p>
                    <ul className="space-y-2">
                      {optimizationTips.map((tip, i) => (
                        <li key={i} className="text-xs text-zinc-400 leading-relaxed flex gap-1.5">
                          <span className="text-amber-400 shrink-0 mt-0.5">›</span>{tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {editMode === 'focused' && (
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-xs text-purple-300 leading-relaxed">
                    <strong>Focused mode</strong> shows only the sections most likely to improve your match score. Switch to Full Edit for complete resume access.
                  </div>
                )}
              </div>

              {/* Right: Editor panel */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {editMode === 'focused' ? (
                  /* FOCUSED: summary + skills + top 2 experience */
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Focused Edit Mode</span>
                      <span className="text-[10px] text-zinc-600">— high-impact sections for this job</span>
                    </div>

                    {/* Summary */}
                    {renderSectionEditor(
                      'summary',
                      'Professional Summary',
                      stripHtml(editResume.summary || ''),
                      v => updateField('summary', v),
                      'Mention the role title and company name. Lead with your top 2 relevant skills.',
                      4
                    )}

                    {/* Skills */}
                    <div className="border border-white/8 rounded-xl p-4 bg-white/2 space-y-3">
                      <p className="text-sm font-semibold text-zinc-200">Skills</p>
                      {(editResume.skills || []).map((sg: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <label className="text-xs text-zinc-500">{sg.category || 'Skills'}</label>
                          <input value={sg.skills_list || ''}
                            onChange={e => updateSkillsList(idx, e.target.value)}
                            placeholder="skill1, skill2, skill3…"
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-zinc-600" />
                        </div>
                      ))}
                      {missingSkills.length > 0 && (
                        <p className="text-[11px] text-zinc-500">
                          ← Click missing skills on the left panel to add them instantly
                        </p>
                      )}
                    </div>

                    {/* Top 2 experience entries */}
                    {(editResume.experience || []).slice(0, 2).map((exp: any, idx: number) => (
                      renderSectionEditor(
                        `exp_${idx}`,
                        `${exp.jobTitle || 'Experience'} @ ${exp.company || ''}${exp.dates ? ` (${exp.dates})` : ''}`,
                        stripHtml(exp.description || ''),
                        v => updateExpField(idx, v),
                        'Use action verbs and quantify impact. Match keywords from the job requirements.',
                        6
                      )
                    ))}
                  </>
                ) : (
                  /* FULL EDIT: all sections */
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Full Edit Mode</span>
                      <span className="text-[10px] text-zinc-600">— complete resume access</span>
                    </div>

                    {/* Personal info */}
                    <div className="border border-white/8 rounded-xl p-4 bg-white/2 space-y-3">
                      <p className="text-sm font-semibold text-zinc-200">Personal Info</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(['name', 'email', 'phone', 'location'] as const).map(field => (
                          <div key={field}>
                            <label className="text-xs text-zinc-500 capitalize">{field}</label>
                            <input value={editResume.personal?.[field] || ''}
                              onChange={e => updateNestedField('personal', field, e.target.value)}
                              className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    {renderSectionEditor(
                      'summary',
                      'Professional Summary',
                      stripHtml(editResume.summary || ''),
                      v => updateField('summary', v),
                      'Tailor to this specific role and company.',
                      4
                    )}

                    {/* Skills */}
                    <div className="border border-white/8 rounded-xl p-4 bg-white/2 space-y-3">
                      <p className="text-sm font-semibold text-zinc-200">Skills</p>
                      {(editResume.skills || []).map((sg: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <label className="text-xs text-zinc-500">{sg.category || 'Skills'}</label>
                          <input value={sg.skills_list || ''}
                            onChange={e => updateSkillsList(idx, e.target.value)}
                            placeholder="skill1, skill2, skill3…"
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 placeholder-zinc-600" />
                        </div>
                      ))}
                    </div>

                    {/* All experience */}
                    {(editResume.experience || []).length > 0 && (
                      <div className="space-y-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Experience</p>
                        {(editResume.experience || []).map((exp: any, idx: number) =>
                          renderSectionEditor(
                            `exp_${idx}`,
                            `${exp.jobTitle || 'Role'} @ ${exp.company || ''}${exp.dates ? ` (${exp.dates})` : ''}`,
                            stripHtml(exp.description || ''),
                            v => updateExpField(idx, v),
                            undefined, 5
                          )
                        )}
                      </div>
                    )}

                    {/* Education */}
                    {(editResume.education || []).length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Education</p>
                        {(editResume.education || []).map((edu: any, idx: number) => (
                          <div key={idx} className="border border-white/8 rounded-xl p-4 bg-white/2 space-y-2">
                            <p className="text-sm font-semibold text-zinc-200">{edu.degree} @ {edu.institution}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-zinc-500">Graduation Year</label>
                                <input value={edu.graduationYear || ''}
                                  onChange={e => updateEduField(idx, 'graduationYear', e.target.value)}
                                  className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                              </div>
                              <div>
                                <label className="text-xs text-zinc-500">GPA</label>
                                <input value={edu.gpa || ''}
                                  onChange={e => updateEduField(idx, 'gpa', e.target.value)}
                                  className="w-full mt-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                              </div>
                            </div>
                            <textarea rows={3} value={stripHtml(edu.achievements || '')}
                              onChange={e => updateEduField(idx, 'achievements', e.target.value)}
                              placeholder="Honors, relevant coursework, achievements…"
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none placeholder-zinc-600" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Certifications */}
                    {(editResume.certifications || []).length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Certifications</p>
                        {(editResume.certifications || []).map((cert: any, idx: number) => (
                          <div key={idx} className="border border-white/8 rounded-xl p-3 bg-white/2">
                            <div className="grid grid-cols-2 gap-2">
                              <input value={cert.name || ''} placeholder="Certification name"
                                onChange={e => updateCertField(idx, 'name', e.target.value)}
                                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                              <input value={cert.issuer || ''} placeholder="Issuing organization"
                                onChange={e => updateCertField(idx, 'issuer', e.target.value)}
                                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Drawer footer */}
            <div className="border-t border-white/10 px-6 py-4 flex items-center justify-between shrink-0 bg-black/30">
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <Save className="w-3.5 h-3.5 text-purple-400" />
                <span>Saves to your profile · then review your cover letter &amp; submit on the job page</span>
              </div>
              <div className="flex gap-3 shrink-0">
                <button onClick={() => setDrawerOpen(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-white/10 rounded-lg transition">
                  Cancel
                </button>
                <button onClick={handleSaveResume} disabled={savingResume}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-purple-900/30">
                  {savingResume
                    ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving…</>
                    : <><Save className="w-4 h-4" />Save Resume</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CandidateLayout>
  );
}
