// src/app/candidate/dashboard/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import CandidateLayout from '@/components/layout/CandidateLayout';
import {
  Sparkles, Briefcase, FileEdit, Calendar,
  TrendingUp, CheckCircle, ChevronRight, ShieldCheck,
  FileText, Zap, Lightbulb, BarChart2, Activity,
  Mic, Star, Send, Eye, X,
} from 'lucide-react';
import { API_BASE, authHeader } from '@/lib/api';
import { motion } from 'framer-motion';

// ── helpers ────────────────────────────────────────────────────────────────

function normalizeStatus(raw: string): string {
  const s = (raw ?? '').toLowerCase().replace(/_/g, ' ');
  if (s.includes('review') || s.includes('reviewing')) return 'In Review';
  if (s.includes('interview') || s.includes('shortlist')) return 'Interview';
  if (s.includes('hired') || s.includes('offer') || s.includes('accepted')) return 'Offer';
  if (s.includes('reject') || s.includes('fail')) return 'Rejected';
  return 'Applied';
}

function getDateMs(appliedAt: any): number {
  if (!appliedAt) return 0;
  if (appliedAt._seconds) return appliedAt._seconds * 1000;
  return Date.parse(appliedAt) || 0;
}

// ── Funnel chart ───────────────────────────────────────────────────────────

const FUNNEL_COLS = [
  { id: 'Applied',   color: 'bg-blue-500',    label: 'Applied',   icon: <Send className="w-3 h-3" /> },
  { id: 'In Review', color: 'bg-yellow-500',   label: 'In Review', icon: <Eye className="w-3 h-3" /> },
  { id: 'Interview', color: 'bg-indigo-500',   label: 'Interview', icon: <Mic className="w-3 h-3" /> },
  { id: 'Offer',     color: 'bg-emerald-500',  label: 'Offer',     icon: <Star className="w-3 h-3" /> },
  { id: 'Rejected',  color: 'bg-red-500',      label: 'Rejected',  icon: <X className="w-3 h-3" /> },
];

function FunnelChart({ applications }: { applications: any[] }) {
  const counts = FUNNEL_COLS.reduce<Record<string, number>>((acc, c) => {
    acc[c.id] = applications.filter(a => normalizeStatus(a.status) === c.id).length;
    return acc;
  }, {});
  const maxCount = Math.max(...Object.values(counts), 1);

  return (
    <div className="space-y-2">
      {FUNNEL_COLS.map(col => {
        const n = counts[col.id] ?? 0;
        const pct = (n / maxCount) * 100;
        return (
          <div key={col.id} className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-24 shrink-0">
              <span className="text-zinc-400">{col.icon}</span>
              <span className="text-[11px] text-zinc-400 font-medium truncate">{col.label}</span>
            </div>
            <div className="flex-1 h-5 bg-zinc-900 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${col.color} opacity-80`}
              />
            </div>
            <span className="text-xs font-bold text-white w-6 text-right shrink-0">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Weekly sparkline ────────────────────────────────────────────────────────

function WeeklySparkline({ applications }: { applications: any[] }) {
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const end   = start + 86400000;
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const count = applications.filter(a => {
      const ms = getDateMs(a.appliedAt);
      return ms >= start && ms < end;
    }).length;
    days.push({ label, count });
  }

  const maxVal = Math.max(...days.map(d => d.count), 1);
  const H = 48;
  const W = 100;
  const pts = days.map((d, i) => {
    const x = (i / (days.length - 1)) * W;
    const y = H - (d.count / maxVal) * H;
    return { x, y, count: d.count };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${W},${H} L0,${H} Z`;

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H + 2}`} className="w-full" preserveAspectRatio="none" style={{ height: 56 }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => p.count > 0 && (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill="#818cf8" />
        ))}
      </svg>
      <div className="flex justify-between">
        {days.map(d => (
          <span key={d.label} className="text-[9px] text-zinc-600 font-mono">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

// ── AI insight ──────────────────────────────────────────────────────────────

function AIInsightCard({ applications, atsScore }: { applications: any[]; atsScore: number }) {
  const total     = applications.length;
  const responded = applications.filter(a => ['In Review', 'Interview', 'Offer'].includes(normalizeStatus(a.status))).length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  let tip = '';
  let tipColor = 'text-indigo-300';

  if (total === 0) {
    tip = 'Start applying via Smart Apply to see insights here. Target 5–10 applications per day for best results.';
  } else if (responseRate === 0) {
    tip = 'Zero responses so far. Try tailoring your resume to each JD using the JD Match tool in Resume Builder.';
    tipColor = 'text-amber-300';
  } else if (responseRate < 15) {
    tip = `${responseRate}% response rate. Industry average is 20–30%. Use "Auto-tailor" in Resume Builder to boost keyword alignment.`;
    tipColor = 'text-yellow-300';
  } else if (atsScore > 0 && atsScore < 70) {
    tip = `Your ATS score is ${atsScore}%. Adding quantified achievements and missing keywords can push it above 80%.`;
  } else {
    tip = `${responseRate}% response rate — you're in good shape. Keep applying consistently and follow up after 7 days.`;
    tipColor = 'text-emerald-300';
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
        <Lightbulb className="w-4 h-4 text-indigo-400" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">AI Insight</p>
        <p className={`text-xs leading-relaxed ${tipColor}`}>{tip}</p>
        {total > 0 && (
          <div className="flex gap-3 mt-2">
            <span className="text-[10px] font-mono text-zinc-500">{total} applied</span>
            <span className="text-[10px] font-mono text-zinc-500">{responseRate}% response</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CandidateDashboardPage() {
  const { user, isAuthenticated, getToken, loading } = useAuth();
  const router = useRouter();

  const [atsScore,           setAtsScore]           = useState(0);
  const [activePipelineStep, setActivePipelineStep] = useState(0);
  const [interviewsScheduled,setInterviewsScheduled]= useState(0);
  const [completion,         setCompletion]         = useState<{ score: number; missing: string[] }>({ score: 0, missing: [] });
  const [applications,       setApplications]       = useState<any[]>([]);
  const [latestApp,          setLatestApp]          = useState<any>(null);
  const [statsLoading,       setStatsLoading]       = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || user?.role !== 'candidate') { router.push('/'); return; }
  }, [isAuthenticated, user, router, loading]);

  const loadAll = useCallback(async () => {
    if (!user?.id) return;
    setStatsLoading(true);

    const [statsRes, appsRes, completionRes] = await Promise.allSettled([
      fetch(`${API_BASE}/stats/candidate/${user.id}`, { headers: await authHeader(getToken) }),
      fetch(`${API_BASE}/applications?candidateId=${user.id}`, { headers: await authHeader(getToken) }),
      fetch(`${API_BASE}/users/${user.id}/completion`,          { headers: await authHeader(getToken) }),
    ]);

    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
      const d = await statsRes.value.json();
      setAtsScore(d.atsScore ?? 0);
      setInterviewsScheduled(d.interviewsScheduled ?? 0);
    }

    if (appsRes.status === 'fulfilled' && appsRes.value.ok) {
      const d = await appsRes.value.json();
      const apps: any[] = d.applications || [];
      setApplications(apps);
      if (apps.length > 0) setLatestApp(apps[0]);
      const hasInterview = apps.some(a => ['Interview', 'Offer'].includes(normalizeStatus(a.status)));
      const hasReview    = apps.some(a => normalizeStatus(a.status) === 'In Review');
      if (hasInterview) setActivePipelineStep(2);
      else if (hasReview || apps.length > 0) setActivePipelineStep(1);
      else setActivePipelineStep(0);
    }

    if (completionRes.status === 'fulfilled' && completionRes.value.ok) {
      const d = await completionRes.value.json();
      setCompletion({ score: d.score ?? 0, missing: d.missing ?? [] });
    }

    setStatsLoading(false);
  }, [user?.id, getToken]);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading || !isAuthenticated || user?.role !== 'candidate') return null;

  // ── Derived stats ──────────────────────────────────────────────────────
  const total     = applications.length;
  const responded = applications.filter(a => ['In Review', 'Interview', 'Offer'].includes(normalizeStatus(a.status))).length;
  const interviewed = applications.filter(a => ['Interview', 'Offer'].includes(normalizeStatus(a.status))).length;
  const responseRate  = total > 0 ? Math.round((responded / total) * 100) : 0;
  const interviewRate = total > 0 ? Math.round((interviewed / total) * 100) : 0;

  const getAtsGlow = (s: number) => s >= 85 ? 'stroke-cyan-400' : s >= 70 ? 'stroke-indigo-400' : 'stroke-rose-500';

  return (
    <CandidateLayout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Welcome header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl p-7 bg-gradient-to-r from-indigo-950/40 to-slate-900/60 border border-white/10 overflow-hidden shadow-2xl"
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold font-mono tracking-widest uppercase bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
                Candidate Control Center
              </span>
              <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Welcome back, {user.name} 👋
              </h1>
              <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
                {total === 0
                  ? 'No applications yet — start Smart Apply to get your search running.'
                  : `${total} applications submitted · ${responseRate}% response rate · ${interviewRate}% interview rate`}
              </p>
            </div>
            <div className="flex items-center gap-3 bg-zinc-950/80 p-3 rounded-2xl border border-white/5 shrink-0">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              <div className="space-y-0.5 text-xs">
                <span className="text-zinc-500 font-bold block text-[9px] uppercase tracking-wider">BYOK Chain Status</span>
                <span className="font-semibold text-emerald-400 font-mono text-[10px]">✓ Active (Rotating Stack)</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Applications',    value: String(total),           sub: 'total submitted',       icon: <Briefcase className="w-4 h-4 text-indigo-400" />,  color: 'text-indigo-300' },
            { label: 'Response Rate',   value: `${responseRate}%`,      sub: `${responded} replied`,  icon: <TrendingUp className="w-4 h-4 text-yellow-400" />,  color: 'text-yellow-300' },
            { label: 'Interview Rate',  value: `${interviewRate}%`,     sub: `${interviewed} slots`,  icon: <Mic className="w-4 h-4 text-indigo-400" />,         color: 'text-indigo-300' },
            { label: 'Interviews',      value: String(interviewsScheduled), sub: 'scheduled',         icon: <Calendar className="w-4 h-4 text-cyan-400" />,      color: 'text-cyan-300'   },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-[#0B0F19]/40 border border-white/10 rounded-2xl p-4 hover:border-indigo-500/30 transition"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-bold font-mono tracking-wider text-zinc-500 uppercase">{kpi.label}</span>
                <div className="p-1.5 bg-white/5 border border-white/10 rounded-lg">{kpi.icon}</div>
              </div>
              <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[9px] text-zinc-500 mt-0.5">{kpi.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* LEFT 2 cols */}
          <div className="lg:col-span-2 space-y-6">

            {/* Application funnel + weekly sparkline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Application Funnel</h3>
                </div>
                {statsLoading ? (
                  <div className="h-24 flex items-center justify-center text-xs text-zinc-600">Loading…</div>
                ) : (
                  <FunnelChart applications={applications} />
                )}
              </div>

              <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Weekly Activity</h3>
                </div>
                {statsLoading ? (
                  <div className="h-24 flex items-center justify-center text-xs text-zinc-600">Loading…</div>
                ) : (
                  <WeeklySparkline applications={applications} />
                )}
              </div>
            </div>

            {/* AI Insight */}
            <div className="bg-slate-950/40 border border-indigo-500/20 rounded-2xl p-5">
              <AIInsightCard applications={applications} atsScore={atsScore} />
            </div>

            {/* Application Pipeline stepper */}
            <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Pipeline
                </h3>
                {latestApp && (
                  <span className="text-[9px] font-mono text-zinc-500 bg-white/5 py-1 px-2 rounded-full border border-white/5">
                    Latest: {latestApp.jobTitle}
                  </span>
                )}
              </div>
              <div className="relative pt-3 pb-1 px-2">
                <div className="absolute top-[38px] left-8 right-8 h-0.5 bg-zinc-900 rounded-full" />
                <div
                  className="absolute top-[38px] left-8 h-0.5 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-full transition-all duration-1000"
                  style={{ width: `${(activePipelineStep / 3) * 88}%` }}
                />
                <div className="flex justify-between items-center">
                  {[
                    { label: 'Applied',    desc: 'Resume sent' },
                    { label: 'In Review',  desc: 'ATS aligned' },
                    { label: 'Interview',  desc: 'Slot booked' },
                    { label: 'Offer',      desc: 'Accepted' },
                  ].map((node, i) => {
                    const done   = i < activePipelineStep;
                    const active = i === activePipelineStep;
                    return (
                      <div key={node.label} className="flex flex-col items-center text-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          active ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30 scale-110 animate-pulse'
                                 : done  ? 'bg-[#0B0F19] border-cyan-400 text-cyan-300'
                                         : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                        }`}>
                          {done ? '✓' : i + 1}
                        </div>
                        <div>
                          <span className={`text-[10px] font-bold block ${active ? 'text-indigo-300' : done ? 'text-zinc-200' : 'text-zinc-600'}`}>{node.label}</span>
                          <span className="text-[8px] text-zinc-600 block">{node.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { name: 'Smart Apply',     href: '/candidate/smart-apply',       icon: <Zap className="w-4 h-4 text-indigo-400" />,   color: 'hover:border-indigo-500/50' },
                { name: 'Resume Builder',  href: '/candidate/resume-builder',    icon: <FileEdit className="w-4 h-4 text-cyan-400" />, color: 'hover:border-cyan-500/50' },
                { name: 'My Applications', href: '/candidate/applications',      icon: <CheckCircle className="w-4 h-4 text-emerald-400" />, color: 'hover:border-emerald-500/50' },
                { name: 'AI Practice',     href: '/candidate/interview/practice',icon: <Mic className="w-4 h-4 text-purple-400" />,    color: 'hover:border-purple-500/50' },
              ].map(act => (
                <Link key={act.name} href={act.href}
                  className={`bg-slate-900/30 border border-white/8 p-4 rounded-2xl transition flex flex-col gap-3 group ${act.color}`}>
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">{act.icon}</div>
                  <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition leading-tight">{act.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ))}
            </div>

          </div>

          {/* RIGHT col */}
          <div className="space-y-5">

            {/* Profile strength */}
            <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Profile Strength
                </h3>
                <span className={`text-sm font-black ${completion.score >= 80 ? 'text-emerald-400' : completion.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {completion.score}%
                </span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completion.score}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-1.5 rounded-full ${completion.score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : completion.score >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-rose-500 to-pink-500'}`}
                />
              </div>
              {completion.missing.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {completion.missing.slice(0, 3).map(item => (
                    <div key={item} className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                      {item}
                    </div>
                  ))}
                  {completion.missing.length > 3 && (
                    <p className="text-[10px] text-zinc-600">+{completion.missing.length - 3} more</p>
                  )}
                </div>
              )}
            </div>

            {/* ATS score gauge */}
            <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" /> Resume Score
                </h3>
              </div>
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-28 h-28">
                  <svg className="w-28 h-28 -rotate-90">
                    <circle cx="56" cy="56" r="48" className="stroke-slate-900" strokeWidth="7" fill="transparent" />
                    <circle cx="56" cy="56" r="48"
                      className={`transition-all duration-1000 ${getAtsGlow(atsScore)}`}
                      strokeWidth="7" fill="transparent"
                      strokeDasharray={2 * Math.PI * 48}
                      strokeDashoffset={2 * Math.PI * 48 * (1 - atsScore / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{atsScore || '—'}</span>
                    <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">ATS</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 text-center leading-relaxed max-w-[180px]">
                  {atsScore === 0 ? 'Upload your resume to get an ATS score.' : atsScore >= 85 ? 'Excellent alignment.' : 'Add missing JD keywords to improve.'}
                </p>
                <Link href="/candidate/resume-builder"
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition">
                  Optimize in Builder →
                </Link>
              </div>
            </div>

            {/* Recent applications */}
            <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" /> Recent
                </h3>
                <Link href="/candidate/applications"
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition">
                  View all →
                </Link>
              </div>

              {applications.length === 0 ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-[10px] text-zinc-500">No applications yet.</p>
                  <Link href="/candidate/smart-apply"
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition">
                    Start Smart Apply →
                  </Link>
                </div>
              ) : (
                applications.slice(0, 5).map(app => {
                  const ns = normalizeStatus(app.status);
                  const sc: Record<string, string> = {
                    'Applied':   'text-blue-300    bg-blue-500/10   border-blue-500/30',
                    'In Review': 'text-yellow-300  bg-yellow-500/10 border-yellow-500/30',
                    'Interview': 'text-indigo-300  bg-indigo-500/10 border-indigo-500/30',
                    'Offer':     'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
                    'Rejected':  'text-red-300     bg-red-500/10    border-red-500/30',
                  };
                  return (
                    <Link href="/candidate/applications" key={app.id}
                      className="flex items-center justify-between p-2.5 bg-zinc-950/40 border border-white/5 rounded-xl hover:border-indigo-500/20 transition">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{app.jobTitle}</p>
                        <p className="text-[9px] text-zinc-500 truncate">{app.company}</p>
                      </div>
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border shrink-0 ml-2 ${sc[ns] ?? sc['Applied']}`}>
                        {ns}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>

          </div>
        </div>
      </div>
    </CandidateLayout>
  );
}
