'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck, BellRing, BookOpenCheck, Bot, BriefcaseBusiness,
  CalendarCheck2, Check, ChevronRight, CircleDollarSign, Copy,
  FilePenLine, HandHeart, Lightbulb, Loader2, Plus, RefreshCw, ShieldCheck,
  SlidersHorizontal, Sparkles, Target, Trash2, UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE, authHeader, jsonHeaders } from '@/lib/api';

type Tab = 'matches' | 'autopilot' | 'schedule' | 'offers' | 'trust';
type Match = { jobId: string; title: string; company: string; location: string; score: number; matchingSkills: string[]; missingSkills: string[]; reason: string };
type Slot = { id: string; title: string; jobTitle?: string; startsAt: string; duration: number; mode: string; meetingLink?: string; status: string; candidateId?: string };
type Kit = { id: string; jobTitle: string; company: string; followUpAt?: string; checklist: string[]; answers: Record<string, string>; createdAt: string };
type Offer = { id: string; company: string; role: string; baseSalary: number; bonus: number; benefitsScore: number; growthScore: number; personalFit: number; remote: boolean; location: string; notes: string; comparisonScore: number };
type Preferences = { showExplanations: boolean; humanReviewRequested: boolean; reduceMotion: boolean; captionsPreferred: boolean; highContrast: boolean };

const tabs: { id: Tab; label: string; icon: typeof Target }[] = [
  { id: 'matches', label: 'Job matches', icon: Target },
  { id: 'autopilot', label: 'Application kit', icon: FilePenLine },
  { id: 'schedule', label: 'Self-schedule', icon: CalendarCheck2 },
  { id: 'offers', label: 'Offer compare', icon: CircleDollarSign },
  { id: 'trust', label: 'AI & access', icon: ShieldCheck },
];

const emptyPreferences: Preferences = {
  showExplanations: true,
  humanReviewRequested: false,
  reduceMotion: false,
  captionsPreferred: false,
  highContrast: false,
};

const inputClass = 'w-full rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] px-3 py-2.5 text-sm text-[var(--cc-text)] outline-none transition placeholder:text-[var(--cc-text-muted)] focus:border-[var(--cc-accent)]';

function dateTime(value: string) {
  if (!value) return 'To be confirmed';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function Toggle({ checked, onChange, label, detail }: { checked: boolean; onChange: (value: boolean) => void; label: string; detail: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-4 transition hover:border-[var(--cc-accent)]/50">
      <span>
        <span className="block text-sm font-semibold text-[var(--cc-text)]">{label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[var(--cc-text-muted)]">{detail}</span>
      </span>
      <input aria-label={label} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-indigo-500" />
    </label>
  );
}

export default function CareerToolsPage() {
  const { user, isAuthenticated, loading: authLoading, getToken } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences);
  const [saving, setSaving] = useState(false);
  const [kitForm, setKitForm] = useState({ jobTitle: '', company: '', jobDescription: '', followUpAt: '' });
  const [offerForm, setOfferForm] = useState({ company: '', role: '', baseSalary: '', bonus: '', benefitsScore: '3', growthScore: '3', personalFit: '3', remote: false, location: '', notes: '' });

  useEffect(() => {
    document.documentElement.classList.toggle('cc-user-reduce-motion', preferences.reduceMotion);
    document.documentElement.classList.toggle('cc-user-high-contrast', preferences.highContrast);
    document.documentElement.dataset.captionsPreferred = String(preferences.captionsPreferred);
  }, [preferences.captionsPreferred, preferences.highContrast, preferences.reduceMotion]);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const headers = init.method && init.method !== 'GET' ? await jsonHeaders(getToken) : await authHeader(getToken);
    const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || 'Request failed');
    return body;
  }, [getToken]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [matchData, slotData, kitData, offerData, preferenceData] = await Promise.all([
        request('/career/job-matches'), request('/interview-slots?view=candidate'), request('/career/application-kits'), request('/offers'), request('/ai-preferences'),
      ]);
      setMatches(matchData.matches || []);
      setSlots(slotData.slots || []);
      setKits(kitData.kits || []);
      setOffers(offerData.offers || []);
      setPreferences({ ...emptyPreferences, ...(preferenceData.preferences || {}) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load Career tools');
    } finally {
      setLoading(false);
    }
  }, [request, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'candidate') { router.replace('/'); return; }
    load();
  }, [authLoading, isAuthenticated, load, router, user?.role]);

  const createKit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!kitForm.jobTitle.trim()) { toast.error('Add a target job title first.'); return; }
    setSaving(true);
    try {
      const data = await request('/career/application-kits', { method: 'POST', body: JSON.stringify(kitForm) });
      setKits(previous => [data.kit, ...previous]);
      setKitForm({ jobTitle: '', company: '', jobDescription: '', followUpAt: '' });
      toast.success('Application kit created with a follow-up plan.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create the application kit'); }
    finally { setSaving(false); }
  };

  const bookSlot = async (slot: Slot) => {
    setSaving(true);
    try {
      const data = await request(`/interview-slots/${slot.id}/book`, { method: 'POST', body: JSON.stringify({ candidateName: user?.name || 'Candidate' }) });
      setSlots(previous => previous.map(item => item.id === slot.id ? data.slot : item));
      toast.success('Interview time reserved. The recruiter will see your booking.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'That slot is no longer available'); }
    finally { setSaving(false); }
  };

  const createOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!offerForm.company.trim() || !offerForm.role.trim()) { toast.error('Company and role are required.'); return; }
    setSaving(true);
    try {
      const data = await request('/offers', { method: 'POST', body: JSON.stringify({ ...offerForm, baseSalary: Number(offerForm.baseSalary), bonus: Number(offerForm.bonus) }) });
      setOffers(previous => [...previous, data.offer].sort((a, b) => b.comparisonScore - a.comparisonScore));
      setOfferForm({ company: '', role: '', baseSalary: '', bonus: '', benefitsScore: '3', growthScore: '3', personalFit: '3', remote: false, location: '', notes: '' });
      toast.success('Offer added to your private comparison.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save offer'); }
    finally { setSaving(false); }
  };

  const deleteOffer = async (id: string) => {
    try {
      await request(`/offers/${id}`, { method: 'DELETE' });
      setOffers(previous => previous.filter(offer => offer.id !== id));
      toast.success('Offer removed.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not remove offer'); }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const data = await request('/ai-preferences', { method: 'PUT', body: JSON.stringify(preferences) });
      setPreferences({ ...emptyPreferences, ...(data.preferences || {}) });
      toast.success('AI and accessibility preferences saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save preferences'); }
    finally { setSaving(false); }
  };

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success('Copied to clipboard.'); }
    catch { toast.error('Copy is unavailable in this browser.'); }
  };

  const visibleSlots = slots.filter(slot => slot.status === 'open' || slot.candidateId === user?.id);

  return (
    <CandidateLayout>
      <main className="space-y-6 text-[var(--cc-text)]">
        <section className="cc-page-hero rounded-3xl border border-[var(--cc-border)] p-6 md:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="cc-eyebrow"><Sparkles size={13} /> Career command center</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">Build momentum, with clarity.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--cc-text-muted)]">Keep your job search organized, understand every AI suggestion, and make the next step easier to act on.</p>
            </div>
            <button onClick={load} className="cc-btn-ghost inline-flex items-center justify-center gap-2" disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh tools</button>
          </div>
        </section>

        <nav aria-label="Career tools" className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition ${selected ? 'border-[var(--cc-accent)] bg-[var(--cc-accent)]/15 text-[var(--cc-text)]' : 'border-[var(--cc-border)] bg-[var(--cc-surface)] text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]'}`}><Icon size={15} />{tab.label}</button>;
          })}
        </nav>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center gap-3 rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] text-sm text-[var(--cc-text-muted)]"><Loader2 className="animate-spin text-[var(--cc-accent)]" size={20} /> Loading career tools…</div>
        ) : activeTab === 'matches' ? (
          <section className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-bold">Explainable job matches</h2><p className="mt-1 text-sm text-[var(--cc-text-muted)]">Every score shows the profile terms that supported it. It is guidance—not an automated hiring decision.</p></div><Link href="/candidate/jobs" className="cc-btn-primary inline-flex items-center gap-2"><BriefcaseBusiness size={15} /> Browse jobs</Link></div>
            {matches.length === 0 ? <Empty icon={<Target />} title="Add a richer resume to unlock job matches" detail="Your profile and resume terms are compared locally against job requirements, then the matching and missing terms are shown." action={<Link href="/candidate/resume-builder" className="cc-btn-ghost">Open Resume Builder</Link>} /> : <div className="grid gap-4 lg:grid-cols-2">{matches.map(match => <article key={match.jobId || `${match.title}-${match.company}`} className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><div className="flex gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--cc-accent)]/15 text-lg font-black text-[var(--cc-accent)]">{match.score}%</div><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{match.title}</h3><p className="mt-0.5 text-sm text-[var(--cc-text-muted)]">{match.company}{match.location ? ` · ${match.location}` : ''}</p><p className="mt-3 text-xs leading-relaxed text-[var(--cc-text-muted)]"><Lightbulb className="mr-1 inline text-amber-400" size={13} />{match.reason}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><SkillList title="Matched" values={match.matchingSkills} tone="emerald" /><SkillList title="Explore" values={match.missingSkills} tone="amber" /></div>{match.jobId && <Link href={`/candidate/jobs/${match.jobId}`} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--cc-accent)] hover:underline">View job <ChevronRight size={14} /></Link>}</article>)}</div>}
          </section>
        ) : activeTab === 'autopilot' ? (
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <form onSubmit={createKit} className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><p className="cc-eyebrow"><Bot size={13} /> Application autopilot</p><h2 className="mt-2 text-xl font-bold">Create a job-specific kit</h2><p className="mt-2 text-sm text-[var(--cc-text-muted)]">A focused checklist, reusable response drafts, and a follow-up reminder. You review everything before submitting.</p><div className="mt-5 space-y-3"><input required className={inputClass} placeholder="Job title *" value={kitForm.jobTitle} onChange={event => setKitForm(value => ({ ...value, jobTitle: event.target.value }))} /><input className={inputClass} placeholder="Company" value={kitForm.company} onChange={event => setKitForm(value => ({ ...value, company: event.target.value }))} /><textarea className={`${inputClass} min-h-28 resize-y`} placeholder="Paste the key job requirements (optional)" value={kitForm.jobDescription} onChange={event => setKitForm(value => ({ ...value, jobDescription: event.target.value }))} /><label className="block text-xs font-semibold text-[var(--cc-text-muted)]">Follow-up date<input type="datetime-local" className={`${inputClass} mt-1.5`} value={kitForm.followUpAt} onChange={event => setKitForm(value => ({ ...value, followUpAt: event.target.value }))} /></label><button disabled={saving} className="cc-btn-primary flex w-full items-center justify-center gap-2"><FilePenLine size={15} /> Create application kit</button></div></form>
            <div className="space-y-4">{kits.length === 0 ? <Empty icon={<BookOpenCheck />} title="No application kits yet" detail="Create one for a role to keep your resume, answers, and follow-up plan together." /> : kits.map(kit => <article key={kit.id} className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><h3 className="font-bold">{kit.jobTitle}</h3><p className="text-sm text-[var(--cc-text-muted)]">{kit.company || 'Target company'}{kit.followUpAt ? ` · Follow up ${dateTime(kit.followUpAt)}` : ''}</p></div><BellRing className="text-[var(--cc-accent-2)]" size={19} /></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-[var(--cc-text-muted)]">Submission checklist</p><ul className="mt-2 space-y-2">{kit.checklist.map(item => <li key={item} className="flex gap-2 text-xs leading-relaxed text-[var(--cc-text-muted)]"><Check className="mt-0.5 shrink-0 text-emerald-400" size={14} />{item}</li>)}</ul></div><div className="space-y-2">{Object.entries(kit.answers).map(([label, answer]) => <button key={label} type="button" onClick={() => copy(answer)} className="w-full rounded-xl border border-[var(--cc-border)] p-3 text-left transition hover:border-[var(--cc-accent)]/60"><span className="flex items-center justify-between text-xs font-bold capitalize">{label}<Copy size={13} className="text-[var(--cc-accent)]" /></span><span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-[var(--cc-text-muted)]">{answer}</span></button>)}</div></div></article>)}</div>
          </section>
        ) : activeTab === 'schedule' ? (
          <section className="space-y-4"><div><h2 className="text-xl font-bold">Choose an interview time</h2><p className="mt-1 text-sm text-[var(--cc-text-muted)]">Recruiters publish available slots. Reserving one updates their hiring workspace immediately; calendar provider sync is optional for each team.</p></div>{visibleSlots.length === 0 ? <Empty icon={<CalendarCheck2 />} title="No open slots right now" detail="When a recruiter publishes availability, it will appear here. You can still use Messages to coordinate a time." action={<Link href="/candidate/messages" className="cc-btn-ghost">Open Messages</Link>} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleSlots.map(slot => <article key={slot.id} className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><p className="cc-eyebrow"><CalendarCheck2 size={13} /> {slot.mode}</p><h3 className="mt-2 font-bold">{slot.title}</h3>{slot.jobTitle && <p className="mt-1 text-sm text-[var(--cc-text-muted)]">{slot.jobTitle}</p>}<p className="mt-5 text-sm font-semibold">{dateTime(slot.startsAt)}</p><p className="mt-1 text-xs text-[var(--cc-text-muted)]">{slot.duration} minutes</p>{slot.status === 'booked' ? <div className="mt-5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-500">Reserved for you</div> : <button disabled={saving} onClick={() => bookSlot(slot)} className="cc-btn-primary mt-5 flex w-full items-center justify-center gap-2"><CalendarCheck2 size={15} /> Reserve this time</button>}</article>)}</div>}</section>
        ) : activeTab === 'offers' ? (
          <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]"><form onSubmit={createOffer} className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><p className="cc-eyebrow"><CircleDollarSign size={13} /> Private comparison</p><h2 className="mt-2 text-xl font-bold">Add an offer</h2><p className="mt-2 text-sm text-[var(--cc-text-muted)]">Scores are transparent personal comparison aids, not financial or career advice.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><input required className={inputClass} placeholder="Company *" value={offerForm.company} onChange={event => setOfferForm(value => ({ ...value, company: event.target.value }))} /><input required className={inputClass} placeholder="Role *" value={offerForm.role} onChange={event => setOfferForm(value => ({ ...value, role: event.target.value }))} /><input type="number" min="0" className={inputClass} placeholder="Base salary" value={offerForm.baseSalary} onChange={event => setOfferForm(value => ({ ...value, baseSalary: event.target.value }))} /><input type="number" min="0" className={inputClass} placeholder="Bonus" value={offerForm.bonus} onChange={event => setOfferForm(value => ({ ...value, bonus: event.target.value }))} /><RatingInput label="Benefits" value={offerForm.benefitsScore} onChange={value => setOfferForm(current => ({ ...current, benefitsScore: value }))} /><RatingInput label="Growth" value={offerForm.growthScore} onChange={value => setOfferForm(current => ({ ...current, growthScore: value }))} /><RatingInput label="Personal fit" value={offerForm.personalFit} onChange={value => setOfferForm(current => ({ ...current, personalFit: value }))} /><input className={inputClass} placeholder="Location" value={offerForm.location} onChange={event => setOfferForm(value => ({ ...value, location: event.target.value }))} /></div><label className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--cc-text-muted)]"><input type="checkbox" checked={offerForm.remote} onChange={event => setOfferForm(value => ({ ...value, remote: event.target.checked }))} className="accent-indigo-500" /> Remote-friendly</label><textarea className={`${inputClass} mt-3 min-h-20`} placeholder="Personal notes" value={offerForm.notes} onChange={event => setOfferForm(value => ({ ...value, notes: event.target.value }))} /><button disabled={saving} className="cc-btn-primary mt-4 flex w-full items-center justify-center gap-2"><Plus size={15} /> Add to comparison</button></form><div className="space-y-4">{offers.length === 0 ? <Empty icon={<CircleDollarSign />} title="No offers to compare" detail="Offer information stays private to your account and is never shared with recruiters." /> : offers.map((offer, index) => <article key={offer.id} className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-5"><div className="flex items-start justify-between gap-4"><div><p className="cc-eyebrow">Rank {index + 1}</p><h3 className="mt-1 font-bold">{offer.role}</h3><p className="text-sm text-[var(--cc-text-muted)]">{offer.company}{offer.location ? ` · ${offer.location}` : ''}{offer.remote ? ' · Remote' : ''}</p></div><div className="text-right"><p className="text-2xl font-black text-[var(--cc-accent)]">{offer.comparisonScore}</p><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cc-text-muted)]">comparison score</p></div></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><Metric label="Base pay" value={offer.baseSalary ? `$${Number(offer.baseSalary).toLocaleString()}` : '—'} /><Metric label="Benefits" value={`${offer.benefitsScore}/5`} /><Metric label="Growth" value={`${offer.growthScore}/5`} /><Metric label="Fit" value={`${offer.personalFit}/5`} /></div>{offer.notes && <p className="mt-4 text-xs leading-relaxed text-[var(--cc-text-muted)]">{offer.notes}</p>}<button onClick={() => deleteOffer(offer.id)} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-300"><Trash2 size={13} /> Remove</button></article>)}</div></section>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]"><article className="rounded-2xl border border-[var(--cc-border)] bg-[var(--cc-surface)] p-6"><p className="cc-eyebrow"><ShieldCheck size={13} /> AI transparency</p><h2 className="mt-2 text-xl font-bold">You stay in control.</h2><p className="mt-3 text-sm leading-relaxed text-[var(--cc-text-muted)]">CareerCraft AI can help you draft, practice, and organize. It should not make employment decisions. Job-match explanations identify the supporting profile terms, and your interview consent is requested before identity verification.</p><div className="mt-5 space-y-3"><TrustPoint icon={<BadgeCheck />} text="Recommendations are explainable, with matched and missing terms visible." /><TrustPoint icon={<UsersRound />} text="Request a human review instead of relying on an automated suggestion." /><TrustPoint icon={<HandHeart />} text="Accessibility choices change the experience without asking you to disclose a disability." /></div></article><div className="space-y-3"><Toggle checked={preferences.showExplanations} onChange={value => setPreferences(current => ({ ...current, showExplanations: value }))} label="Show why AI suggested something" detail="Keep job-match reasons and other explanatory context visible." /><Toggle checked={preferences.humanReviewRequested} onChange={value => setPreferences(current => ({ ...current, humanReviewRequested: value }))} label="Request human review" detail="Mark that you prefer a person to review important recommendations and decisions." /><Toggle checked={preferences.captionsPreferred} onChange={value => setPreferences(current => ({ ...current, captionsPreferred: value }))} label="Prefer captions and written prompts" detail="Use text-forward interview and practice experiences where available." /><Toggle checked={preferences.reduceMotion} onChange={value => setPreferences(current => ({ ...current, reduceMotion: value }))} label="Reduce motion" detail="Minimize non-essential animated transitions in supported workspaces." /><Toggle checked={preferences.highContrast} onChange={value => setPreferences(current => ({ ...current, highContrast: value }))} label="High contrast" detail="Prioritize stronger visual separation in supported interfaces." /><button disabled={saving} onClick={savePreferences} className="cc-btn-primary flex w-full items-center justify-center gap-2"><SlidersHorizontal size={15} /> Save preferences</button></div></section>
        )}
      </main>
    </CandidateLayout>
  );
}

function Empty({ icon, title, detail, action }: { icon: React.ReactNode; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[var(--cc-border)] bg-[var(--cc-surface)] px-6 py-14 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--cc-accent)]/10 text-[var(--cc-accent)]">{icon}</div><h3 className="mt-4 font-bold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--cc-text-muted)]">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function SkillList({ title, values, tone }: { title: string; values: string[]; tone: 'emerald' | 'amber' }) {
  const color = tone === 'emerald' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500';
  return <div><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cc-text-muted)]">{title}</p><div className="mt-2 flex flex-wrap gap-1.5">{values.length ? values.map(value => <span key={value} className={`rounded-full px-2 py-1 text-[10px] font-bold ${color}`}>{value}</span>) : <span className="text-xs text-[var(--cc-text-muted)]">No terms yet</span>}</div></div>;
}

function RatingInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-xs font-semibold text-[var(--cc-text-muted)]">{label} (1–5)<select className={`${inputClass} mt-1.5`} value={value} onChange={event => onChange(event.target.value)}>{[1, 2, 3, 4, 5].map(item => <option key={item} value={item}>{item}</option>)}</select></label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[var(--cc-bg)] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cc-text-muted)]">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}

function TrustPoint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex gap-3 rounded-xl border border-[var(--cc-border)] p-3 text-xs leading-relaxed text-[var(--cc-text-muted)]"><span className="mt-0.5 text-[var(--cc-accent)]">{icon}</span>{text}</div>;
}
