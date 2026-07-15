// src/app/recruiter/dashboard/page.tsx
'use client';

import RecruiterLayout from '@/components/layout/RecruiterLayout';
import {
  Users, ClipboardList, TrendingUp, Sparkles,
  ChevronRight, Calendar, UserCheck, Play, Award, ShieldCheck, FileText, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useRecruiter } from '@/hooks/useRecruiter';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { API_BASE, authHeader } from '@/lib/api';

export default function RecruiterDashboardPage() {
  const { name } = useRecruiter();
  const { user, isAuthenticated, getToken, loading } = useAuth();
  const router = useRouter();

  const [hiringVelocity, setHiringVelocity] = useState(0);
  const [openJobs, setOpenJobs] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [totalInterviews, setTotalInterviews] = useState(0);
  const [completion, setCompletion] = useState<{ score: number; missing: string[] }>({ score: 0, missing: [] });
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.push('/');
    } else if (user?.role !== 'recruiter') {
      router.push('/');
    }
  }, [isAuthenticated, user, router, loading]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/stats/recruiter/${user.id}`, {
          headers: await authHeader(getToken),
        });
        if (res.ok) {
          const data = await res.json();
          setOpenJobs(data.openJobs ?? 0);
          setTotalApplications(data.totalApplications ?? 0);
          setTotalInterviews(data.totalInterviews ?? 0);
          const velocity = data.totalApplications > 0
            ? Math.min(100, Math.round((data.totalInterviews / data.totalApplications) * 100))
            : 0;
          setHiringVelocity(velocity);
        } else {
          setStatsError(true);
        }
      } catch { setStatsError(true); }
    };
    const fetchCompletion = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/${user.id}/completion`, {
          headers: await authHeader(getToken),
        });
        if (res.ok) {
          const data = await res.json();
          setCompletion({ score: data.score ?? 0, missing: data.missing ?? [] });
        }
      } catch { /* keep defaults */ }
    };
    const fetchRecentApps = async () => {
      try {
        const res = await fetch(`${API_BASE}/applications?recruiterId=${user.id}`, {
          headers: await authHeader(getToken),
        });
        if (res.ok) {
          const data = await res.json();
          setRecentApps((data.applications || []).slice(0, 4));
        }
      } catch { /* keep defaults */ }
    };

    setStatsLoading(true);
    setStatsError(false);
    Promise.allSettled([fetchStats(), fetchCompletion(), fetchRecentApps()])
      .then(() => setStatsLoading(false));
  }, [user?.id]);

  if (!isAuthenticated || user?.role !== 'recruiter') {
    return null;
  }

  return (
    <RecruiterLayout>
      <section className="space-y-8 max-w-7xl mx-auto">
        
        {/* Welcome Box - High End Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-3xl p-8 bg-gradient-to-r from-purple-950/40 to-slate-900/60 border border-white/10 overflow-hidden shadow-2xl"
        >
          {/* Glass background glowing spots */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="space-y-2">
              <span className="text-[10px] font-bold font-mono tracking-widest uppercase bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full border border-purple-500/30">
                Talent Pipeline Command
              </span>
              <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Welcome back, {name || user.name} 💼
              </h1>
              <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
                Manage your active open requisitions, audit candidate resume parsing pipelines, and inspect scheduled voice screenings.
              </p>
            </div>
            
            {/* Quick stats / live banner */}
            <div className="flex items-center gap-3 bg-zinc-950/80 p-3 rounded-2xl border border-white/5 shadow-inner shrink-0">
              <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />
              <div className="space-y-0.5 text-xs">
                <span className="text-zinc-500 font-bold block text-[9px] uppercase tracking-wider">Secure Assessment Rule</span>
                <span className="font-semibold text-purple-400 flex items-center gap-1 font-mono text-[10px]">
                  ✓ Anti-Cheat Proctor Enabled
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dashboard 2-Column Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT 2 COLUMNS: METRICS & PIPELINES */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                // While stats load, show a placeholder — a fake "0" reads as "you have
                // nothing" on slow connections. On fetch failure, say so instead of lying.
                { title: 'Pipeline Candidates', count: statsLoading ? '…' : statsError ? '—' : String(totalApplications), desc: 'Total applicants', trend: statsLoading ? 'Loading' : statsError ? 'Failed to load' : totalApplications > 0 ? 'Active pipeline' : 'None yet', icon: <Users className="w-5 h-5 text-cyan-400" /> },
                { title: 'Open Requisitions', count: statsLoading ? '…' : statsError ? '—' : String(openJobs), desc: 'Live job postings', trend: statsLoading ? 'Loading' : statsError ? 'Failed to load' : openJobs > 0 ? 'Active slots' : 'Post a job', icon: <ClipboardList className="w-5 h-5 text-purple-400" /> },
                { title: 'Interviews', count: statsLoading ? '…' : statsError ? '—' : String(totalInterviews), desc: 'Scheduled or completed', trend: statsLoading ? 'Loading' : statsError ? 'Failed to load' : totalInterviews > 0 ? 'In progress' : 'None yet', icon: <UserCheck className="w-5 h-5 text-[#6366F1]" /> }
              ].map((kpi, idx) => (
                <motion.div
                  key={kpi.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 + idx * 0.05 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="bg-[#0B0F19]/40 border border-white/10 rounded-2xl p-5 hover:border-purple-500/30 transition-all duration-300 shadow shadow-purple-950/20"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold font-mono tracking-wider text-zinc-400 uppercase">{kpi.title}</span>
                    <div className="p-1.5 bg-white/5 border border-white/10 rounded-lg">{kpi.icon}</div>
                  </div>
                  <h3 className="text-3xl font-black text-white mb-1.5">{kpi.count}</h3>
                  <div className="flex justify-between items-center text-[9px] font-medium text-zinc-500">
                    <span>{kpi.desc}</span>
                    <span className="text-purple-400 font-mono">{kpi.trend}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Smart Quick Navigation Triggers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Link href="/recruiter/requisitions" className="block group">
                <div className="bg-[#0B0F19]/40 hover:bg-slate-900/40 border border-white/10 hover:border-purple-500/40 rounded-2xl p-6 transition-all duration-300 shadow relative flex flex-col justify-between h-full">
                  <div className="space-y-2">
                    <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-zinc-500">Requisitions Deck</span>
                    <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                      📄 View Requisitions
                    </h3>
                    <p className="text-xs text-zinc-400 leading-normal">
                      Scan, edit, or toggle status settings for all active job slots and requirements.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-purple-400 group-hover:text-purple-300 pt-6 transition">
                    Open Dashboard <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>

              <Link href="/recruiter/candidates" className="block group">
                <div className="bg-[#0B0F19]/40 hover:bg-slate-900/40 border border-white/10 hover:border-cyan-500/40 rounded-2xl p-6 transition-all duration-300 shadow relative flex flex-col justify-between h-full">
                  <div className="space-y-2">
                    <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-zinc-500">Talent Database</span>
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                      🧑‍💼 Manage Candidates
                    </h3>
                    <p className="text-xs text-zinc-400 leading-normal">
                      Verify candidate parsed files, biometric waveforms, and semantic search alignments.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 group-hover:text-cyan-300 pt-6 transition">
                    Open Candidates <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>

            {/* Smart Actions deck */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 font-mono">
                Talent Pipeline Actions
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { name: 'Post New Requisition', href: '/recruiter/requisitions/new', desc: 'Create and publish open job requisitions.', color: 'hover:border-purple-500/40' },
                  { name: 'Review Applications', href: '/recruiter/applications', desc: 'Scan and grade incoming applicant list.', color: 'hover:border-cyan-500/40' },
                  { name: 'Manage Account Profile', href: '/recruiter/profile', desc: 'Update details and settings.', color: 'hover:border-indigo-500/40' }
                ].map((item) => (
                  <Link href={item.href} key={item.name} className="block group">
                    <div className={`h-full bg-slate-900/30 border border-white/5 p-4 rounded-xl shadow relative flex flex-col justify-between transition duration-300 ${item.color}`}>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                          {item.desc}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-zinc-400 group-hover:text-white flex items-center gap-0.5 pt-3 transition">
                        Launch <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: VELOCITY METER & LIVE SCREENINGS */}
          <div className="space-y-8 col-span-1">

            {/* Profile Completion Meter */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="bg-slate-950/40 border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl backdrop-blur-md"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Profile Strength
                </h3>
                <span className={`text-xs font-bold font-mono ${completion.score >= 80 ? 'text-emerald-400' : completion.score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {completion.score}%
                </span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completion.score}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-2 rounded-full ${completion.score >= 80 ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : completion.score >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-rose-500 to-pink-500'}`}
                />
              </div>
              {completion.missing.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 font-mono">Complete your profile</p>
                  {completion.missing.slice(0, 3).map((item) => (
                    <div key={item} className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                      {item}
                    </div>
                  ))}
                  {completion.missing.length > 3 && (
                    <p className="text-[10px] text-zinc-500">+{completion.missing.length - 3} more items</p>
                  )}
                </div>
              )}
            </motion.div>

            {/* Hiring Target Velocity Dial */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-slate-950/40 border border-white/10 p-6 rounded-3xl space-y-6 shadow-xl backdrop-blur-md"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" /> Monthly Hiring Target
                </h3>
              </div>

              {/* Glowing SVG dial */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative w-36 h-36">
                  <svg className="w-36 h-36 transform -rotate-90">
                    <circle cx="72" cy="72" r="62" className="stroke-slate-900" strokeWidth="8" fill="transparent" />
                    <circle 
                      cx="72" 
                      cy="72" 
                      r="62" 
                      className="stroke-purple-500 text-purple-500 shadow-purple-500/20 transition-all duration-1000 ease-out"
                      strokeWidth="8" 
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 62}
                      strokeDashoffset={2 * Math.PI * 62 * (1 - hiringVelocity / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white">{hiringVelocity}%</span>
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">Velocity</span>
                  </div>
                </div>

                <div className="space-y-1 text-center">
                  <span className="text-[10px] font-bold px-3 py-1 rounded-full border bg-purple-500/20 text-purple-300 border-purple-500/30">
                    {hiringVelocity >= 50 ? 'Ahead of Target' : hiringVelocity > 0 ? 'In Progress' : 'No Data Yet'}
                  </span>
                  <p className="text-[10px] text-zinc-500 leading-normal pt-2.5 max-w-[200px] mx-auto">
                    Percentage of open job requisitions successfully filled within the active 30-day billing cycle.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Recent applications feed */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-slate-950/40 border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl backdrop-blur-md"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" /> Recent Applications
                </h3>
                <Link href="/recruiter/applications" className="text-[9px] font-mono text-purple-400 hover:text-purple-300 uppercase font-bold bg-white/5 py-1 px-2.5 rounded-full border border-white/5 transition">
                  View All
                </Link>
              </div>

              <div className="space-y-2.5">
                {recentApps.length === 0 ? (
                  <p className="text-[10px] text-zinc-500 italic text-center py-3">No applications received yet.</p>
                ) : (
                  recentApps.map((app) => {
                    const statusColor =
                      app.status === 'Hired' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                      app.status === 'Rejected' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                      app.status === 'Shortlisted' ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' :
                      app.status === 'Interviewed' ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' :
                      'text-zinc-400 bg-white/5 border-white/10';
                    return (
                      <Link href={`/recruiter/applications/${app.id}`} key={app.id}
                        className="flex items-center justify-between p-2.5 bg-zinc-950/40 border border-white/5 rounded-xl hover:border-purple-500/20 transition">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{app.candidateName}</p>
                          <p className="text-[9px] text-zinc-500 truncate">{app.jobTitle}</p>
                        </div>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border shrink-0 ml-2 ${statusColor}`}>
                          {app.status}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </motion.div>

          </div>

        </div>

      </section>
    </RecruiterLayout>
  );
}
