'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Save, Briefcase, Sparkles, Plus, X } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { API_BASE as API } from '@/lib/api';


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-1.5 text-sm font-medium text-zinc-300">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm";

function NewRequisitionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditing = !!editId;
  const { user, getToken } = useAuth();

  const [formData, setFormData] = useState({
    title: '', department: '', location: '', type: 'Full-time',
    description: '', company: '', skills: '',
  });
  const [requirements, setRequirements] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [newReq, setNewReq] = useState('');
  const [newBen, setNewBen] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [generating, setGenerating] = useState(false);

  const getAuthHeader = async () => ({ 'Authorization': `Bearer ${await getToken()}` });

  useEffect(() => {
    if (!editId) return;
    (async () => {
      setLoadingExisting(true);
      try {
        const res = await fetch(`${API}/jobs/${editId}`, { headers: await getAuthHeader() });
        if (!res.ok) { toast.error('Job not found.'); router.push('/recruiter/requisitions'); return; }
        const job = await res.json();
        setFormData({
          title: job.title || '', department: job.department || '',
          location: job.location || '', type: job.jobType || job.type || 'Full-time',
          description: job.description || '', company: job.company || '', skills: '',
        });
        setRequirements(job.requirements || []);
        setBenefits(job.benefits || []);
      } catch { toast.error('Failed to load job for editing.'); }
      finally { setLoadingExisting(false); }
    })();
  }, [editId]);

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
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (data.description) setFormData(prev => ({ ...prev, description: data.description }));
      if (data.requirements?.length) setRequirements(data.requirements);
      if (data.benefits?.length) setBenefits(data.benefits);
      toast.success('Job description generated — review and edit before posting.', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate.', { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: formData.title, description: formData.description,
        jobType: formData.type, department: formData.department,
        location: formData.location, company: formData.company || user?.name || 'CareerCraft',
        requirements, benefits,
      };
      const res = isEditing
        ? await fetch(`${API}/jobs/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...await getAuthHeader() }, body: JSON.stringify(payload) })
        : await fetch(`${API}/jobs/v1/post`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...await getAuthHeader() }, body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Failed to save job');
      toast.success(isEditing ? 'Job updated!' : 'Job posted!');
      router.push('/recruiter/requisitions');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingExisting) return (
    <RecruiterLayout><div className="flex items-center justify-center min-h-[60vh]"><RefreshCw className="w-8 h-8 animate-spin text-purple-400" /></div></RecruiterLayout>
  );

  return (
    <RecruiterLayout>
      <Toaster position="top-right" richColors />
      <div className="max-w-3xl mx-auto text-white space-y-6">
        <Link href="/recruiter/requisitions" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition">
          <ArrowLeft className="w-4 h-4" /> Back to Requisitions
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Briefcase className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-bold">{isEditing ? 'Edit Requisition' : 'Create New Requisition'}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Basic info */}
          <div className="glass rounded-xl p-6 border border-white/10 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Role Details</h2>

            <Field label="Job Title *">
              <input type="text" name="title" value={formData.title} onChange={handleChange} required
                placeholder="e.g. Senior Frontend Engineer" className={inputCls} />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Department">
                <input type="text" name="department" value={formData.department} onChange={handleChange}
                  placeholder="e.g. Engineering" className={inputCls} />
              </Field>
              <Field label="Location *">
                <input type="text" name="location" value={formData.location} onChange={handleChange} required
                  placeholder="e.g. Remote / New York" className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Employment Type">
                <select name="type" value={formData.type} onChange={handleChange} className={inputCls}>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </Field>
              <Field label="Company Name">
                <input type="text" name="company" value={formData.company} onChange={handleChange}
                  placeholder={user?.name || 'Your company name'} className={inputCls} />
              </Field>
            </div>

            <Field label="Key Skills / Technologies (helps AI write better)">
              <input type="text" name="skills" value={formData.skills} onChange={handleChange}
                placeholder="e.g. React, Node.js, PostgreSQL, AWS" className={inputCls} />
            </Field>

            {/* AI Generate button */}
            <button type="button" onClick={generateWithAI} disabled={generating || !formData.title}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 hover:text-white rounded-lg text-sm font-semibold transition disabled:opacity-40">
              {generating
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Sparkles className="w-4 h-4" /> Generate Description with AI</>}
            </button>
          </div>

          {/* Description */}
          <div className="glass rounded-xl p-6 border border-white/10 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Job Description *</h2>
            <textarea name="description" rows={7} value={formData.description} onChange={handleChange} required
              placeholder="Describe the role, responsibilities, and what you're looking for…"
              className={`${inputCls} resize-none`} />
          </div>

          {/* Requirements */}
          <div className="glass rounded-xl p-6 border border-white/10 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Requirements</h2>
            <ul className="space-y-2">
              {requirements.map((req, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-zinc-300 bg-white/3 border border-white/8 rounded-lg px-3 py-2">
                  <span className="flex-1">{req}</span>
                  <button type="button" onClick={() => setRequirements(requirements.filter((_, j) => j !== i))}
                    className="text-zinc-600 hover:text-red-400 transition shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input value={newReq} onChange={e => setNewReq(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newReq.trim()) { setRequirements([...requirements, newReq.trim()]); setNewReq(''); } } }}
                placeholder="Add a requirement and press Enter…" className={`${inputCls} flex-1`} />
              <button type="button" onClick={() => { if (newReq.trim()) { setRequirements([...requirements, newReq.trim()]); setNewReq(''); } }}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Benefits */}
          <div className="glass rounded-xl p-6 border border-white/10 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Benefits</h2>
            <ul className="space-y-2">
              {benefits.map((ben, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-zinc-300 bg-white/3 border border-white/8 rounded-lg px-3 py-2">
                  <span className="flex-1">{ben}</span>
                  <button type="button" onClick={() => setBenefits(benefits.filter((_, j) => j !== i))}
                    className="text-zinc-600 hover:text-red-400 transition shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input value={newBen} onChange={e => setNewBen(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newBen.trim()) { setBenefits([...benefits, newBen.trim()]); setNewBen(''); } } }}
                placeholder="Add a benefit and press Enter…" className={`${inputCls} flex-1`} />
              <button type="button" onClick={() => { if (newBen.trim()) { setBenefits([...benefits, newBen.trim()]); setNewBen(''); } }}
                className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-300 transition">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition">
              {loading
                ? <><RefreshCw className="w-4 h-4 animate-spin" />{isEditing ? 'Updating…' : 'Posting…'}</>
                : <><Save className="w-4 h-4" />{isEditing ? 'Save Changes' : 'Post Job'}</>}
            </button>
            <Link href="/recruiter/requisitions"
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 rounded-lg font-semibold text-sm transition">
              Cancel
            </Link>
          </div>
        </form>
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
