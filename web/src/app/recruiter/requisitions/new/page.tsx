'use client';

// Job posting pipeline — built around how a recruiter actually works:
// 1. Role intake (the brief from the hiring manager)
// 2. Description (AI-drafted, human-edited)
// 3. Screening questions (let unqualified applicants filter themselves)
// 4. Preview exactly what candidates see → Publish or Save as Draft
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, RefreshCw, Briefcase, Sparkles, Plus, X, Eye,
  DollarSign, MapPin, Clock, CheckCircle2, FileText, ListChecks, Rocket, Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE as API } from '@/lib/api';

type Step = 0 | 1 | 2 | 3;
const STEPS = [
  { label: 'Role',        icon: <Briefcase className="w-3.5 h-3.5" /> },
  { label: 'Description', icon: <FileText className="w-3.5 h-3.5" /> },
  { label: 'Screening',   icon: <ListChecks className="w-3.5 h-3.5" /> },
  { label: 'Preview',     icon: <Eye className="w-3.5 h-3.5" /> },
];

interface ScreeningQ {
  id: string;
  question: string;
  type: 'yesno' | 'number' | 'text';
  knockout: boolean;          // reject automatically on wrong answer
  idealAnswer?: 'yes' | 'no'; // for yes/no knockouts
  minValue?: string;          // for number knockouts (e.g. min years)
}

const Q_TEMPLATES: Omit<ScreeningQ, 'id'>[] = [
  { question: 'Are you legally authorized to work in this country?', type: 'yesno', knockout: true, idealAnswer: 'yes' },
  { question: 'Will you now or in the future require visa sponsorship?', type: 'yesno', knockout: false },
  { question: 'How many years of relevant experience do you have?', type: 'number', knockout: false },
  { question: 'What is your expected annual salary (USD)?', type: 'number', knockout: false },
  { question: 'What is your notice period?', type: 'text', knockout: false },
  { question: 'Are you willing to relocate for this role?', type: 'yesno', knockout: false },
];

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block mb-1.5 text-sm font-medium text-zinc-300">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm";
const chipOn  = "px-4 py-2 rounded-xl text-xs font-bold border transition bg-purple-600/30 border-purple-500/50 text-purple-200";
const chipOff = "px-4 py-2 rounded-xl text-xs font-bold border transition bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10";

function NewRequisitionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId  = searchParams.get('edit');
  const cloneId = searchParams.get('clone');
  const isEditing = !!editId;
  const { user, getToken } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [formData, setFormData] = useState({
    title: '', department: '', location: '', type: 'Full-time',
    description: '', company: '', skills: '',
    workMode: 'Remote', experienceLevel: 'Mid',
    salaryMin: '', salaryMax: '', salaryVisible: true,
    visaSponsorship: false,
  });
  const [requirements, setRequirements] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [questions, setQuestions] = useState<ScreeningQ[]>([]);
  const [newReq, setNewReq] = useState('');
  const [newBen, setNewBen] = useState('');
  const [customQ, setCustomQ] = useState('');
  const [saving, setSaving] = useState<'publish' | 'draft' | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(!!(editId || cloneId));
  const [generating, setGenerating] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string>('');

  const getAuthHeader = async () => ({ 'Authorization': `Bearer ${await getToken()}` });

  // Load for edit or clone
  useEffect(() => {
    const srcId = editId || cloneId;
    if (!srcId) return;
    (async () => {
      setLoadingExisting(true);
      try {
        const res = await fetch(`${API}/jobs/${srcId}`, { headers: await getAuthHeader() });
        if (!res.ok) { toast.error('Job not found.'); router.push('/recruiter/requisitions'); return; }
        const job = await res.json();
        setFormData({
          title: cloneId ? `${job.title || ''} (Copy)` : (job.title || ''),
          department: job.department || '',
          location: job.location || '', type: job.jobType || job.type || 'Full-time',
          description: job.description || '', company: job.company || '',
          skills: job.skills || '',
          workMode: job.workMode || 'Remote',
          experienceLevel: job.experienceLevel || 'Mid',
          salaryMin: job.salaryMin || '', salaryMax: job.salaryMax || '',
          salaryVisible: job.salaryVisible !== false,
          visaSponsorship: !!job.visaSponsorship,
        });
        setRequirements(job.requirements || []);
        setBenefits(job.benefits || []);
        setQuestions(job.screeningQuestions || []);
        setExistingStatus(job.status || 'Open');
      } catch { toast.error('Failed to load job.'); }
      finally { setLoadingExisting(false); }
    })();
  }, [editId, cloneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const generateWithAI = async () => {
    if (!formData.title.trim()) { toast.error('Enter a job title first.'); return; }
    setGenerating(true);
    const toastId = toast.loading('AI is writing your job description…');
    try {
      const res = await fetch(`${API}/jobs/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
        body: JSON.stringify({
          title: formData.title, department: formData.department,
          type: formData.type, company: formData.company, skills: formData.skills,
        }),
      });
      const data = await res.json();
      if (res.status === 402 || data.error === 'no_api_keys') {
        toast.error('AI generation needs your API key.', {
          id: toastId,
          description: 'Add a Gemini key in Settings → API Keys, then try again. You can also write the description manually.',
          action: { label: 'Open Settings', onClick: () => router.push('/recruiter/settings') },
          duration: 8000,
        });
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (data.description) setFormData(prev => ({ ...prev, description: data.description }));
      if (data.requirements?.length) setRequirements(data.requirements);
      if (data.benefits?.length) setBenefits(data.benefits);
      toast.success('Draft generated — review and edit before publishing.', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate.', { id: toastId });
    } finally { setGenerating(false); }
  };

  // ── validation per step ──
  const stepError = (s: Step): string | null => {
    if (s === 0) {
      if (!formData.title.trim()) return 'Job title is required.';
      if (!formData.location.trim() && formData.workMode !== 'Remote') return 'Location is required for onsite/hybrid roles.';
      if (formData.salaryMin && formData.salaryMax && Number(formData.salaryMin) > Number(formData.salaryMax)) return 'Salary minimum exceeds maximum.';
    }
    if (s === 1 && !formData.description.trim()) return 'A job description is required before publishing.';
    return null;
  };

  const goNext = () => {
    const err = stepError(step);
    if (err) { toast.error(err); return; }
    setStep(prev => Math.min(3, prev + 1) as Step);
  };

  const buildPayload = (status: 'Draft' | 'Open' | undefined) => ({
    title: formData.title.trim(),
    description: formData.description,
    jobType: formData.type,
    department: formData.department,
    location: formData.workMode === 'Remote' && !formData.location.trim() ? 'Remote' : formData.location,
    company: formData.company || 'Confidential Employer',
    skills: formData.skills,
    workMode: formData.workMode,
    experienceLevel: formData.experienceLevel,
    salaryMin: formData.salaryMin, salaryMax: formData.salaryMax,
    salaryVisible: formData.salaryVisible,
    visaSponsorship: formData.visaSponsorship,
    requirements, benefits,
    screeningQuestions: questions,
    ...(status ? { status } : {}),
  });

  const save = async (mode: 'publish' | 'draft') => {
    if (mode === 'publish') {
      for (const s of [0, 1] as Step[]) {
        const err = stepError(s);
        if (err) { toast.error(err); setStep(s); return; }
      }
    } else if (!formData.title.trim()) {
      toast.error('A draft needs at least a job title.'); setStep(0); return;
    }
    setSaving(mode);
    try {
      // When editing, keep the current status unless explicitly publishing a draft
      const status = mode === 'draft' ? 'Draft'
        : isEditing && existingStatus && existingStatus !== 'Draft' ? undefined
        : 'Open';
      const payload = buildPayload(status as any);
      const res = isEditing
        ? await fetch(`${API}/jobs/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...await getAuthHeader() }, body: JSON.stringify(payload) })
        : await fetch(`${API}/jobs/v1/post`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...await getAuthHeader() }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Failed to save job');
      toast.success(mode === 'draft' ? 'Saved as draft.' : isEditing ? 'Job updated!' : 'Job published — candidates can now apply.');
      router.push('/recruiter/requisitions');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally { setSaving(null); }
  };

  const addQuestion = (q: Omit<ScreeningQ, 'id'>) => {
    if (questions.some(x => x.question === q.question)) { toast.error('That question is already added.'); return; }
    setQuestions([...questions, { ...q, id: Math.random().toString(36).slice(2, 9) }]);
  };
  const updateQ = (id: string, patch: Partial<ScreeningQ>) =>
    setQuestions(questions.map(q => q.id === id ? { ...q, ...patch } : q));

  const salaryLabel = formData.salaryMin || formData.salaryMax
    ? `$${Number(formData.salaryMin || 0).toLocaleString()}${formData.salaryMax ? ` – $${Number(formData.salaryMax).toLocaleString()}` : '+'}`
    : 'Competitive';

  if (loadingExisting) return (
    <RecruiterLayout><div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="w-8 h-8 animate-spin text-purple-400" /></div></RecruiterLayout>
  );

  return (
    <RecruiterLayout>
      <div className="max-w-3xl mx-auto text-white space-y-6">
        <Link href="/recruiter/requisitions" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition">
          <ArrowLeft className="w-4 h-4" /> Back to Requisitions
        </Link>

        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Edit Requisition' : cloneId ? 'Clone Requisition' : 'Post a Job'}
          </h1>
          {existingStatus && isEditing && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-zinc-300 uppercase tracking-wider">{existingStatus}</span>
          )}
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <button key={s.label} onClick={() => { if (i < step || !stepError(step)) setStep(i as Step); else toast.error(stepError(step)!); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition ${
                i === step ? 'bg-purple-600/25 border-purple-500/50 text-purple-200'
                : i < step ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-white/3 border-white/8 text-zinc-500'
              }`}>
              {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* ── STEP 1: Role details ── */}
        {step === 0 && (
          <div className="glass rounded-xl p-6 border border-white/10 space-y-5">
            <Field label="Job Title *">
              <input type="text" name="title" value={formData.title} onChange={handleChange}
                placeholder="e.g. Senior Frontend Engineer" className={inputCls} />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Company Name" hint="Shown to candidates. Leave blank to post as Confidential Employer.">
                <input type="text" name="company" value={formData.company} onChange={handleChange}
                  placeholder="e.g. Acme Corp" className={inputCls} />
              </Field>
              <Field label="Department">
                <input type="text" name="department" value={formData.department} onChange={handleChange}
                  placeholder="e.g. Engineering" className={inputCls} />
              </Field>
            </div>

            <Field label="Work Mode">
              <div className="flex gap-2">
                {['Remote', 'Hybrid', 'Onsite'].map(m => (
                  <button key={m} type="button" onClick={() => setFormData(p => ({ ...p, workMode: m }))}
                    className={formData.workMode === m ? chipOn : chipOff}>{m}</button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={formData.workMode === 'Remote' ? 'Location (optional for remote)' : 'Location *'}>
                <input type="text" name="location" value={formData.location} onChange={handleChange}
                  placeholder={formData.workMode === 'Remote' ? 'e.g. US timezones' : 'e.g. New York, NY'} className={inputCls} />
              </Field>
              <Field label="Employment Type">
                <select name="type" value={formData.type} onChange={handleChange} className={inputCls}>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </Field>
            </div>

            <Field label="Experience Level">
              <div className="flex flex-wrap gap-2">
                {['Intern', 'Junior', 'Mid', 'Senior', 'Lead'].map(l => (
                  <button key={l} type="button" onClick={() => setFormData(p => ({ ...p, experienceLevel: l }))}
                    className={formData.experienceLevel === l ? chipOn : chipOff}>{l}</button>
                ))}
              </div>
            </Field>

            <Field label="Salary Range (USD / year)" hint="Postings with a visible salary range get significantly more applications.">
              <div className="flex items-center gap-3">
                <input type="number" name="salaryMin" value={formData.salaryMin} onChange={handleChange}
                  placeholder="Min e.g. 90000" className={inputCls} />
                <span className="text-zinc-500">–</span>
                <input type="number" name="salaryMax" value={formData.salaryMax} onChange={handleChange}
                  placeholder="Max e.g. 130000" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 mt-2 text-xs text-zinc-400 cursor-pointer">
                <input type="checkbox" checked={formData.salaryVisible}
                  onChange={e => setFormData(p => ({ ...p, salaryVisible: e.target.checked }))}
                  className="accent-purple-500" />
                Show salary range to candidates
              </label>
            </Field>

            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={formData.visaSponsorship}
                onChange={e => setFormData(p => ({ ...p, visaSponsorship: e.target.checked }))}
                className="accent-purple-500" />
              Visa sponsorship available for this role
            </label>

            <Field label="Key Skills / Technologies" hint="Used for AI matching and description generation.">
              <input type="text" name="skills" value={formData.skills} onChange={handleChange}
                placeholder="e.g. React, Node.js, PostgreSQL, AWS" className={inputCls} />
            </Field>
          </div>
        )}

        {/* ── STEP 2: Description ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="glass rounded-xl p-6 border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Job Description *</h2>
                <button type="button" onClick={generateWithAI} disabled={generating || !formData.title}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-lg text-xs font-semibold transition disabled:opacity-40">
                  {generating ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Sparkles className="w-3.5 h-3.5" /> Generate with AI</>}
                </button>
              </div>
              <textarea name="description" rows={9} value={formData.description} onChange={handleChange}
                placeholder="Describe the role, responsibilities, and what you're looking for — or let AI draft it from your role details…"
                className={`${inputCls} resize-none`} />
            </div>

            <div className="glass rounded-xl p-6 border border-white/10 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Requirements</h2>
              <ul className="space-y-2">
                {requirements.map((req, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-zinc-300 bg-white/3 border border-white/8 rounded-lg px-3 py-2">
                    <span className="flex-1">{req}</span>
                    <button type="button" onClick={() => setRequirements(requirements.filter((_, j) => j !== i))}
                      className="text-zinc-600 hover:text-red-400 transition shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input value={newReq} onChange={e => setNewReq(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newReq.trim()) { setRequirements([...requirements, newReq.trim()]); setNewReq(''); } } }}
                  placeholder="Add a requirement and press Enter…" className={`${inputCls} flex-1`} />
                <button type="button" onClick={() => { if (newReq.trim()) { setRequirements([...requirements, newReq.trim()]); setNewReq(''); } }}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition"><Plus className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="glass rounded-xl p-6 border border-white/10 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Benefits</h2>
              <ul className="space-y-2">
                {benefits.map((ben, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-zinc-300 bg-white/3 border border-white/8 rounded-lg px-3 py-2">
                    <span className="flex-1">{ben}</span>
                    <button type="button" onClick={() => setBenefits(benefits.filter((_, j) => j !== i))}
                      className="text-zinc-600 hover:text-red-400 transition shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input value={newBen} onChange={e => setNewBen(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newBen.trim()) { setBenefits([...benefits, newBen.trim()]); setNewBen(''); } } }}
                  placeholder="Add a benefit and press Enter…" className={`${inputCls} flex-1`} />
                <button type="button" onClick={() => { if (newBen.trim()) { setBenefits([...benefits, newBen.trim()]); setNewBen(''); } }}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Screening questions ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="glass rounded-xl p-6 border border-white/10 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Screening Questions</h2>
              <p className="text-xs text-zinc-500">
                Candidates answer these when applying. Mark a question as a <span className="text-red-400 font-semibold">knockout</span> to
                automatically filter out applicants who don&apos;t meet the requirement — your pipeline stays clean without manual triage.
              </p>

              {/* Quick templates */}
              <div className="flex flex-wrap gap-2">
                {Q_TEMPLATES.filter(t => !questions.some(q => q.question === t.question)).map(t => (
                  <button key={t.question} type="button" onClick={() => addQuestion(t)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition">
                    + {t.question.length > 46 ? t.question.slice(0, 44) + '…' : t.question}
                  </button>
                ))}
              </div>

              {/* Added questions */}
              <div className="space-y-3">
                {questions.length === 0 && (
                  <p className="text-center text-xs text-zinc-600 py-4">No screening questions yet — add from the templates above or write your own. (Optional but strongly recommended.)</p>
                )}
                {questions.map((q, i) => (
                  <div key={q.id} className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-mono text-zinc-600 pt-1">{i + 1}.</span>
                      <p className="flex-1 text-sm text-zinc-200">{q.question}</p>
                      <button type="button" onClick={() => setQuestions(questions.filter(x => x.id !== q.id))}
                        className="text-zinc-600 hover:text-red-400 transition"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-5">
                      <select value={q.type} onChange={e => updateQ(q.id, { type: e.target.value as ScreeningQ['type'], knockout: e.target.value === 'text' ? false : q.knockout })}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300">
                        <option value="yesno">Yes / No</option>
                        <option value="number">Number</option>
                        <option value="text">Free text</option>
                      </select>
                      {q.type !== 'text' && (
                        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                          <input type="checkbox" checked={q.knockout} onChange={e => updateQ(q.id, { knockout: e.target.checked })} className="accent-red-500" />
                          <span className={q.knockout ? 'text-red-400 font-semibold' : ''}>Knockout</span>
                        </label>
                      )}
                      {q.knockout && q.type === 'yesno' && (
                        <select value={q.idealAnswer || 'yes'} onChange={e => updateQ(q.id, { idealAnswer: e.target.value as 'yes' | 'no' })}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300">
                          <option value="yes">Must answer Yes</option>
                          <option value="no">Must answer No</option>
                        </select>
                      )}
                      {q.knockout && q.type === 'number' && (
                        <input type="number" value={q.minValue || ''} onChange={e => updateQ(q.id, { minValue: e.target.value })}
                          placeholder="Minimum value" className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 w-32" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Custom question */}
              <div className="flex gap-2 pt-1">
                <input value={customQ} onChange={e => setCustomQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (customQ.trim()) { addQuestion({ question: customQ.trim(), type: 'text', knockout: false }); setCustomQ(''); } } }}
                  placeholder="Write a custom question and press Enter…" className={`${inputCls} flex-1`} />
                <button type="button" onClick={() => { if (customQ.trim()) { addQuestion({ question: customQ.trim(), type: 'text', knockout: false }); setCustomQ(''); } }}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Preview ── */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-xs text-zinc-500 flex items-center gap-2"><Eye className="w-3.5 h-3.5" /> This is what candidates will see.</p>
            <div className="cc-card rounded-2xl p-7 space-y-5 border border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">{formData.title || 'Untitled role'}</h2>
                  <p className="text-sm text-zinc-400 mt-0.5">{formData.company || 'Confidential Employer'}{formData.department ? ` · ${formData.department}` : ''}</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                  {formData.salaryVisible ? salaryLabel : 'Competitive'}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{formData.workMode}{formData.location ? ` · ${formData.location}` : ''}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{formData.type}</span>
                <span className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" />{formData.experienceLevel} level</span>
                {formData.visaSponsorship && <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" />Visa sponsorship</span>}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-300 mb-1.5">About the role</h3>
                <p className="text-sm text-zinc-400 whitespace-pre-wrap">{formData.description || '— no description yet —'}</p>
              </div>
              {requirements.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-zinc-300 mb-1.5">Requirements</h3>
                  <ul className="space-y-1">{requirements.map((r, i) => <li key={i} className="text-sm text-zinc-400 flex gap-2"><span className="text-purple-400">•</span>{r}</li>)}</ul>
                </div>
              )}
              {benefits.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-zinc-300 mb-1.5">Benefits</h3>
                  <ul className="space-y-1">{benefits.map((b, i) => <li key={i} className="text-sm text-zinc-400 flex gap-2"><span className="text-emerald-400">•</span>{b}</li>)}</ul>
                </div>
              )}
              {questions.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-zinc-300 mb-1.5">You&apos;ll be asked</h3>
                  <ul className="space-y-1">{questions.map(q => <li key={q.id} className="text-sm text-zinc-400 flex gap-2"><span className="text-indigo-400">?</span>{q.question}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer nav ── */}
        <div className="flex items-center justify-between gap-3 pt-1 pb-8">
          <div>
            {step > 0 && (
              <button type="button" onClick={() => setStep(prev => Math.max(0, prev - 1) as Step)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 rounded-lg font-semibold text-sm transition">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {(!isEditing || existingStatus === 'Draft') && (
              <button type="button" onClick={() => save('draft')} disabled={!!saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 rounded-lg font-semibold text-sm transition disabled:opacity-50">
                {saving === 'draft' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Draft
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={goNext}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-sm transition">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={() => save('publish')} disabled={!!saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition">
                {saving === 'publish' ? <><RefreshCw className="w-4 h-4 animate-spin" /> Publishing…</> : <><Rocket className="w-4 h-4" /> {isEditing && existingStatus !== 'Draft' ? 'Save Changes' : 'Publish Job'}</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </RecruiterLayout>
  );
}

export default function NewRequisitionPage() {
  return (
    <Suspense fallback={<RecruiterLayout><div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="w-8 h-8 animate-spin text-purple-400" /></div></RecruiterLayout>}>
      <NewRequisitionContent />
    </Suspense>
  );
}
