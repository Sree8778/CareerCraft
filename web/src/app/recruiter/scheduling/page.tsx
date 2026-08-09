'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck2, Clock3, Link2, Loader2, Plus, RefreshCw, UsersRound, Video } from 'lucide-react';
import { toast } from 'sonner';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE, authHeader, jsonHeaders } from '@/lib/api';

type Slot = { id: string; title: string; jobTitle?: string; startsAt: string; duration: number; mode: string; meetingLink?: string; status: string; candidateName?: string; candidateId?: string };
const inputClass = 'w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-2.5 text-sm text-[var(--cc-text)] outline-none transition placeholder:text-[var(--cc-text-muted)] focus:border-[var(--cc-accent-2)]';

function format(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function RecruiterSchedulingPage() {
  const { user, isAuthenticated, loading: authLoading, getToken } = useAuth();
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', jobTitle: '', startsAt: '', duration: '45', mode: 'Video', meetingLink: '' });

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = init.method && init.method !== 'GET' ? await jsonHeaders(getToken) : await authHeader(getToken);
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Request failed');
    return body;
  }, [getToken]);

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await request('/interview-slots'); setSlots(data.slots || []); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load availability'); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'recruiter') { router.replace('/'); return; }
    load();
  }, [authLoading, isAuthenticated, load, router, user?.role]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.startsAt) { toast.error('Add a title and a date/time.'); return; }
    setSaving(true);
    try {
      const data = await request('/interview-slots', { method: 'POST', body: JSON.stringify({ ...form, duration: Number(form.duration) }) });
      setSlots(previous => [...previous, data.slot].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setForm({ title: '', jobTitle: '', startsAt: '', duration: '45', mode: 'Video', meetingLink: '' });
      toast.success('Availability published. Candidates can now reserve it.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not publish availability'); }
    finally { setSaving(false); }
  };

  const openSlots = slots.filter(slot => slot.status === 'open').length;
  const bookedSlots = slots.filter(slot => slot.status === 'booked').length;

  return <RecruiterLayout><main className="space-y-6 text-[var(--cc-text)]">
    <section className="cc-page-hero rounded-3xl border border-[var(--cc-border)] p-6 md:p-8"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="cc-eyebrow"><CalendarCheck2 size={13} /> Candidate self-scheduling</p><h1 className="mt-3 text-3xl font-black tracking-tight">Publish availability once.</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--cc-text-muted)]">Candidates select a time that works for them, and your hiring team sees the reservation instantly. External Google or Outlook calendar sync can be connected separately when credentials are available.</p></div><button onClick={load} className="cc-btn-ghost inline-flex items-center justify-center gap-2" disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button></div></section>
    <section className="grid gap-4 sm:grid-cols-3"><Stat label="Published slots" value={String(slots.length)} icon={<CalendarCheck2 size={18} />} /><Stat label="Available" value={String(openSlots)} icon={<Clock3 size={18} />} /><Stat label="Candidate bookings" value={String(bookedSlots)} icon={<UsersRound size={18} />} /></section>
    <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]"><form onSubmit={create} className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><h2 className="text-xl font-bold">Publish a time slot</h2><p className="mt-1 text-sm text-[var(--cc-text-muted)]">Keep slots specific to a role or use them for general introductory conversations.</p><div className="mt-5 space-y-3"><input className={inputClass} placeholder="Interview title *" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /><input className={inputClass} placeholder="Job title (optional)" value={form.jobTitle} onChange={event => setForm(current => ({ ...current, jobTitle: event.target.value }))} /><label className="block text-xs font-bold text-[var(--cc-text-muted)]">Start time<input required type="datetime-local" className={`${inputClass} mt-1.5`} value={form.startsAt} onChange={event => setForm(current => ({ ...current, startsAt: event.target.value }))} /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-[var(--cc-text-muted)]">Duration<select className={`${inputClass} mt-1.5`} value={form.duration} onChange={event => setForm(current => ({ ...current, duration: event.target.value }))}>{[30, 45, 60, 90].map(value => <option key={value} value={value}>{value} minutes</option>)}</select></label><label className="text-xs font-bold text-[var(--cc-text-muted)]">Format<select className={`${inputClass} mt-1.5`} value={form.mode} onChange={event => setForm(current => ({ ...current, mode: event.target.value }))}><option>Video</option><option>Phone</option><option>In person</option></select></label></div><label className="block text-xs font-bold text-[var(--cc-text-muted)]">Meeting link (optional)<input className={`${inputClass} mt-1.5`} placeholder="https://…" value={form.meetingLink} onChange={event => setForm(current => ({ ...current, meetingLink: event.target.value }))} /></label><button disabled={saving} className="cc-btn-primary flex w-full items-center justify-center gap-2"><Plus size={15} /> Publish availability</button></div></form>
      <section className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Availability board</h2><p className="mt-1 text-sm text-[var(--cc-text-muted)]">Open slots remain private to your candidate workspace until a candidate reserves them.</p></div><Video className="text-[var(--cc-accent-2)]" size={21} /></div>{loading ? <div className="flex min-h-56 items-center justify-center text-[var(--cc-text-muted)]"><Loader2 className="animate-spin" size={20} /></div> : slots.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><CalendarCheck2 size={30} className="text-[var(--cc-accent-2)]" /><p className="mt-3 font-bold">No availability published</p><p className="mt-1 text-sm text-[var(--cc-text-muted)]">Create your first time slot to let candidates self-schedule.</p></div> : <div className="mt-5 space-y-3">{slots.map(slot => <article key={slot.id} className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--cc-border)] p-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${slot.status === 'booked' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-[var(--cc-accent)]/10 text-[var(--cc-accent)]'}`}>{slot.status === 'booked' ? 'Reserved' : 'Open'}</span><span className="text-xs text-[var(--cc-text-muted)]">{slot.mode} · {slot.duration} min</span></div><h3 className="mt-2 font-bold">{slot.title}</h3><p className="mt-1 text-sm text-[var(--cc-text-muted)]">{slot.jobTitle ? `${slot.jobTitle} · ` : ''}{format(slot.startsAt)}</p>{slot.status === 'booked' && <p className="mt-2 text-xs font-bold text-emerald-500">Booked by {slot.candidateName || 'Candidate'}</p>}</div>{slot.meetingLink && <a href={slot.meetingLink} target="_blank" rel="noreferrer" className="cc-btn-ghost inline-flex items-center justify-center gap-2"><Link2 size={14} /> Meeting link</a>}</article>)}</div>}</section>
    </section>
  </main></RecruiterLayout>;
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <article className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--cc-accent-2)]/10 p-2.5 text-[var(--cc-accent-2)]">{icon}</span><div><p className="text-xl font-black">{value}</p><p className="text-xs text-[var(--cc-text-muted)]">{label}</p></div></div></article>;
}
