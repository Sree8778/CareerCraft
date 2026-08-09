'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, CheckCircle2, ClipboardCheck, Loader2, MessageSquareText, RefreshCw, Scale, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE, authHeader, jsonHeaders } from '@/lib/api';

type Application = { id: string; candidateName?: string; candidateEmail?: string; jobTitle?: string; company?: string; status?: string };
type Scorecard = { id: string; interviewerName: string; technical: number; communication: number; roleFit: number; overall: number; recommendation: 'strong_yes' | 'yes' | 'mixed' | 'no'; feedback: string; createdAt: string };
const inputClass = 'w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-bg)] px-3 py-2.5 text-sm text-[var(--cc-text)] outline-none transition focus:border-[var(--cc-accent-2)]';

function displayDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); }
function label(value: string) { return value.replace('_', ' ').replace(/\b\w/g, item => item.toUpperCase()); }

export default function RecruiterScorecardsPage() {
  const { user, isAuthenticated, loading: authLoading, getToken } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ technical: '3', communication: '3', roleFit: '3', recommendation: 'mixed', feedback: '' });

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = init.method && init.method !== 'GET' ? await jsonHeaders(getToken) : await authHeader(getToken);
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Request failed');
    return body;
  }, [getToken]);

  const loadApplications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await request(`/applications?recruiterId=${user.id}`);
      const list = data.applications || [];
      setApplications(list);
      setSelectedId(current => current || list[0]?.id || '');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load applications'); }
    finally { setLoading(false); }
  }, [request, user?.id]);

  const loadScorecards = useCallback(async () => {
    if (!selectedId) { setScorecards([]); return; }
    try { const data = await request(`/applications/${selectedId}/scorecards`); setScorecards(data.scorecards || []); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load scorecards'); }
  }, [request, selectedId]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'recruiter') { router.replace('/'); return; }
    loadApplications();
  }, [authLoading, isAuthenticated, loadApplications, router, user?.role]);
  useEffect(() => { loadScorecards(); }, [loadScorecards]);

  const selected = applications.find(application => application.id === selectedId);
  const average = useMemo(() => scorecards.length ? (scorecards.reduce((sum, item) => sum + item.overall, 0) / scorecards.length).toFixed(1) : '—', [scorecards]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId) { toast.error('Select an application first.'); return; }
    setSaving(true);
    try {
      const data = await request(`/applications/${selectedId}/scorecards`, { method: 'POST', body: JSON.stringify({ ...form, technical: Number(form.technical), communication: Number(form.communication), roleFit: Number(form.roleFit) }) });
      setScorecards(previous => [data.scorecard, ...previous]);
      setForm({ technical: '3', communication: '3', roleFit: '3', recommendation: 'mixed', feedback: '' });
      toast.success('Scorecard saved for the hiring team.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save scorecard'); }
    finally { setSaving(false); }
  };

  return <RecruiterLayout><main className="space-y-6 text-[var(--cc-text)]">
    <section className="cc-page-hero rounded-3xl border border-[var(--cc-border)] p-6 md:p-8"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="cc-eyebrow"><ClipboardCheck size={13} /> Structured hiring feedback</p><h1 className="mt-3 text-3xl font-black tracking-tight">Score evidence, not impressions.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--cc-text-muted)]">Use the same criteria across interviewers, keep the reasoning visible, and separate helpful AI context from the final human decision.</p></div><button onClick={loadApplications} className="cc-btn-ghost inline-flex items-center justify-center gap-2" disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button></div></section>
    <section className="grid gap-4 sm:grid-cols-3"><Stat icon={<UsersRound size={18} />} label="Applications" value={String(applications.length)} /><Stat icon={<BarChart3 size={18} />} label="Team average" value={average} /><Stat icon={<MessageSquareText size={18} />} label="Submitted scorecards" value={String(scorecards.length)} /></section>
    <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]"><form onSubmit={submit} className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><h2 className="text-xl font-bold">New scorecard</h2><p className="mt-1 text-sm text-[var(--cc-text-muted)]">A scorecard is only visible to recruiters who can access this application.</p><label className="mt-5 block text-xs font-bold text-[var(--cc-text-muted)]">Candidate application<select className={`${inputClass} mt-1.5`} value={selectedId} onChange={event => setSelectedId(event.target.value)} disabled={loading || applications.length === 0}><option value="">Select an application</option>{applications.map(application => <option key={application.id} value={application.id}>{application.candidateName || application.candidateEmail || 'Candidate'} · {application.jobTitle || 'Role'}</option>)}</select></label><div className="mt-4 grid grid-cols-3 gap-3"><Rating label="Technical" value={form.technical} onChange={value => setForm(current => ({ ...current, technical: value }))} /><Rating label="Communication" value={form.communication} onChange={value => setForm(current => ({ ...current, communication: value }))} /><Rating label="Role fit" value={form.roleFit} onChange={value => setForm(current => ({ ...current, roleFit: value }))} /></div><label className="mt-4 block text-xs font-bold text-[var(--cc-text-muted)]">Recommendation<select className={`${inputClass} mt-1.5`} value={form.recommendation} onChange={event => setForm(current => ({ ...current, recommendation: event.target.value }))}><option value="strong_yes">Strong yes</option><option value="yes">Yes</option><option value="mixed">Mixed</option><option value="no">No</option></select></label><label className="mt-4 block text-xs font-bold text-[var(--cc-text-muted)]">Evidence and feedback<textarea className={`${inputClass} mt-1.5 min-h-32 resize-y`} maxLength={2000} placeholder="Reference the candidate's demonstrated skills, examples, and any follow-up areas…" value={form.feedback} onChange={event => setForm(current => ({ ...current, feedback: event.target.value }))} /></label><button disabled={saving || !selectedId} className="cc-btn-primary mt-4 flex w-full items-center justify-center gap-2"><CheckCircle2 size={15} /> Save structured feedback</button></form>
      <section className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-xl font-bold">Team scorecards</h2><p className="mt-1 text-sm text-[var(--cc-text-muted)]">{selected ? `${selected.candidateName || selected.candidateEmail || 'Selected candidate'} · ${selected.jobTitle || 'Role'}` : 'Choose an application to review team feedback.'}</p></div><Scale className="text-[var(--cc-accent-2)]" size={21} /></div>{loading ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="animate-spin text-[var(--cc-accent-2)]" size={20} /></div> : !selectedId ? <Empty /> : scorecards.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><ClipboardCheck size={30} className="text-[var(--cc-accent-2)]" /><p className="mt-3 font-bold">No scorecards yet</p><p className="mt-1 text-sm text-[var(--cc-text-muted)]">Be the first interviewer to add evidence-based feedback.</p></div> : <div className="mt-5 space-y-3">{scorecards.map(card => <article key={card.id} className="rounded-xl border border-[var(--cc-border)] p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${card.recommendation === 'strong_yes' ? 'bg-emerald-500/10 text-emerald-500' : card.recommendation === 'no' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-500'}`}>{label(card.recommendation)}</span><span className="text-xs text-[var(--cc-text-muted)]">{displayDate(card.createdAt)}</span></div><h3 className="mt-2 font-bold">{card.interviewerName}</h3></div><div className="rounded-xl bg-[var(--cc-accent-2)]/10 px-3 py-2 text-center"><p className="text-lg font-black text-[var(--cc-accent-2)]">{card.overall}</p><p className="text-[9px] font-bold uppercase tracking-wider text-[var(--cc-text-muted)]">overall</p></div></div><div className="mt-4 grid grid-cols-3 gap-2">{[['Technical', card.technical], ['Communication', card.communication], ['Role fit', card.roleFit]].map(([name, value]) => <div key={String(name)} className="rounded-xl bg-[var(--cc-bg)] p-2.5 text-center"><p className="text-sm font-black">{value}/5</p><p className="text-[10px] text-[var(--cc-text-muted)]">{name}</p></div>)}</div>{card.feedback && <p className="mt-4 text-sm leading-relaxed text-[var(--cc-text-muted)]">{card.feedback}</p>}</article>)}</div>}</section>
    </section>
  </main></RecruiterLayout>;
}

function Rating({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--cc-text-muted)]">{label}<select className="mt-1.5 w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-bg)] px-2 py-2 text-sm text-[var(--cc-text)] outline-none" value={value} onChange={event => onChange(event.target.value)}>{[1, 2, 3, 4, 5].map(item => <option key={item} value={item}>{item}</option>)}</select></label>; }
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--cc-accent-2)]/10 p-2.5 text-[var(--cc-accent-2)]">{icon}</span><div><p className="text-xl font-black">{value}</p><p className="text-xs text-[var(--cc-text-muted)]">{label}</p></div></div></article>; }
function Empty() { return <div className="flex min-h-56 flex-col items-center justify-center text-center"><ClipboardCheck size={30} className="text-[var(--cc-accent-2)]" /><p className="mt-3 font-bold">Select an application</p><p className="mt-1 text-sm text-[var(--cc-text-muted)]">Scorecards are shown only to the hiring team.</p></div>; }
