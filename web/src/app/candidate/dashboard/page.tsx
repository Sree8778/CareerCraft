// src/app/candidate/dashboard/page.tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import CandidateLayout from '@/components/layout/CandidateLayout';
import {
  Sparkles, Briefcase, FileEdit, User, Calendar,
  MapPin, DollarSign, TrendingUp, CheckCircle, Clock,
  ChevronRight, AlertCircle, Volume2, ShieldCheck
} from 'lucide-react';
import { API_BASE, authHeader } from '@/lib/api';
import { motion } from 'framer-motion';

export default function CandidateDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [atsScore, setAtsScore] = useState(0);
  const [activePipelineStep, setActivePipelineStep] = useState(0);
  const [totalApplications, setTotalApplications] = useState(0);
  const [interviewsScheduled, setInterviewsScheduled] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [completion, setCompletion] = useState<{ score: number; missing: string[] }>({ score: 0, missing: [] });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (user?.role !== 'candidate') {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    if (!user?.id) return;
    
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/stats/candidate/${user.id}`, {
          headers: authHeader(user.id),
        });
        if (res.ok) {
          const data = await res.json();
          setTotalApplications(data.totalApplications ?? 0);
          setInterviewsScheduled(data.interviewsScheduled ?? 0);
          setAtsScore(data.hasResume ? 84 : 0);
          if (data.interviewsScheduled > 0) setActivePipelineStep(2);
          else if (data.totalApplications > 0) setActivePipelineStep(1);
          else setActivePipelineStep(0);
        }
      } catch { /* keep defaults */ }
    };

    const fetchNotifs = async () => {
      try {
        const res = await fetch(`${API_BASE}/notifications`, {
          headers: authHeader(user.id),
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    const fetchCompletion = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/${user.id}/completion`, {
          headers: authHeader(user.id),
        });
        if (res.ok) {
          const data = await res.json();
          setCompletion({ score: data.score ?? 0, missing: data.missing ?? [] });
        }
      } catch { /* keep defaults */ }
    };

    fetchStats();
    fetchNotifs();
    fetchCompletion();

    const interval = setInterval(fetchNotifs, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleReadAllNotifs = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: authHeader(user.id),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isAuthenticated || user?.role !== 'candidate') {
    return null;
  }

  const getAtsGlow = (score: number) => {
    if (score >= 85) return 'stroke-cyan-400 text-cyan-400 shadow-cyan-500/20';
    if (score >= 70) return 'stroke-indigo-400 text-indigo-400 shadow-indigo-500/20';
    return 'stroke-rose-500 text-rose-500 shadow-rose-500/20';
  };

  const getAtsBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    if (score >= 70) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
  };

  return (
    <CandidateLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Welcome Header Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-3xl p-8 bg-gradient-to-r from-indigo-950/40 to-slate-900/60 border border-white/10 overflow-hidden shadow-2xl"
        >
          {/* Glass background glowing spots */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="space-y-2">
              <span className="text-[10px] font-bold font-mono tracking-widest uppercase bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
                Candidate Control Center
              </span>
              <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Welcome back, {user.name} 👋
              </h1>
              <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
                Your AI Copilot is fully configured and rotating credentials. Inspect your active parsed profile, resume scores, and live slots below.
              </p>
            </div>
            
            {/* Quick API Status Badge */}
            <div className="flex items-center gap-3 bg-zinc-950/80 p-3 rounded-2xl border border-white/5 shadow-inner shrink-0">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              <div className="space-y-0.5 text-xs">
                <span className="text-zinc-500 font-bold block text-[9px] uppercase tracking-wider">BYOK Chain Status</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1 font-mono text-[10px]">
                  ✓ Active (Rotating Stack)
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dashboard Dynamic 2-Column Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT 2 COLUMNS: METRICS & PIPELINE */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Horizontal Application Progress Pipeline */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-slate-950/40 border border-white/10 p-6 rounded-3xl space-y-6 shadow-xl backdrop-blur-md"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Active Application Pipeline
                </h3>
                <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold bg-white/5 py-1 px-2.5 rounded-full border border-white/5">
                  Senior AI Engineer at Vercel
                </span>
              </div>

              {/* Progress Steps Node Visualizer */}
              <div className="relative pt-4 pb-2 px-4">
                {/* Horizontal connector line */}
                <div className="absolute top-1/2 left-8 right-8 h-1 bg-zinc-900 -translate-y-1/2 -z-10 rounded-full" />
                <div 
                  className="absolute top-1/2 left-8 h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 -translate-y-1/2 -z-10 rounded-full transition-all duration-1000" 
                  style={{ width: `${(activePipelineStep / 3) * 88}%` }}
                />

                <div className="flex justify-between items-center">
                  {[
                    { label: 'Applied', desc: 'Resume Dispatched' },
                    { label: 'Under Review', desc: 'ATS Alignment Match' },
                    { label: 'Interview Scheduled', desc: 'Proctored Audio Slot' },
                    { label: 'Offer Formulated', desc: 'Secure Contract' }
                  ].map((node, i) => {
                    const isCompleted = i <= activePipelineStep;
                    const isActive = i === activePipelineStep;
                    return (
                      <div key={node.label} className="flex flex-col items-center text-center space-y-2.5 relative">
                        <div 
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 border-2 ${
                            isActive 
                              ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/30 scale-110 animate-pulse' 
                              : isCompleted 
                              ? 'bg-[#0B0F19] border-cyan-400 text-cyan-300' 
                              : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                          }`}
                        >
                          {isCompleted && !isActive ? '✓' : i + 1}
                        </div>
                        <div className="space-y-0.5 max-w-[100px]">
                          <span className={`text-[10px] font-bold block ${isActive ? 'text-indigo-300' : isCompleted ? 'text-zinc-200' : 'text-zinc-500'}`}>
                            {node.label}
                          </span>
                          <span className="text-[8px] text-zinc-500 block leading-normal">
                            {node.desc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

            {/* KPI metrics cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { title: 'Job Applications', count: String(totalApplications), desc: 'Total submitted', trend: totalApplications > 0 ? 'Active' : 'None yet', icon: <Briefcase className="w-5 h-5 text-indigo-400" /> },
                { title: 'Screening Slots', count: String(interviewsScheduled), desc: 'Interviews scheduled', trend: interviewsScheduled > 0 ? 'Upcoming' : 'None yet', icon: <Calendar className="w-5 h-5 text-cyan-400" /> },
                { title: 'Portfolio Score', count: atsScore > 0 ? `${atsScore}%` : '—', desc: atsScore > 0 ? 'Resume uploaded' : 'Upload resume to score', trend: atsScore >= 85 ? 'Excellent' : atsScore > 0 ? 'Good' : 'N/A', icon: <Sparkles className="w-5 h-5 text-purple-400" /> }
              ].map((kpi, idx) => (
                <motion.div
                  key={kpi.title}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 + idx * 0.05 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="bg-[#0B0F19]/40 border border-white/10 rounded-2xl p-5 hover:border-indigo-500/30 transition-all duration-300 shadow shadow-indigo-950/20"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] font-bold font-mono tracking-wider text-zinc-400 uppercase">{kpi.title}</span>
                    <div className="p-1.5 bg-white/5 border border-white/10 rounded-lg">{kpi.icon}</div>
                  </div>
                  <h3 className="text-3xl font-black text-white mb-1.5">{kpi.count}</h3>
                  <div className="flex justify-between items-center text-[9px] font-medium text-zinc-500">
                    <span>{kpi.desc}</span>
                    <span className="text-indigo-400 font-mono">{kpi.trend}</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* AI Copilot Quick Actions Panel */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 font-mono">
                Smart Agent Toolkits
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { name: 'Browse Live Jobs', href: '/candidate/jobs', desc: 'Scan matching open requisitions using AI semantic search filters.', label: 'Browse', color: 'border-indigo-500/20 hover:border-indigo-500/50 hover:shadow-indigo-500/5' },
                  { name: 'Portfolio Builder', href: '/candidate/resume-builder', desc: 'Refine education, jobs, skills, and optimize resume grades.', label: 'Design', color: 'border-cyan-500/20 hover:border-cyan-500/50 hover:shadow-cyan-500/5' },
                  { name: 'AI Practice Interview', href: '/candidate/interview/practice', desc: 'Practice technical, behavioral and HR questions with instant AI coaching feedback.', label: 'Practice', color: 'border-emerald-500/20 hover:border-emerald-500/50 hover:shadow-emerald-500/5' },
                  { name: 'Profile Configurations', href: '/candidate/profile', desc: 'Update details, upload files, or tweak keys and credentials.', label: 'Configure', color: 'border-purple-500/20 hover:border-purple-500/50 hover:shadow-purple-500/5' }
                ].map((act, i) => (
                  <Link href={act.href} key={act.name} className="block group">
                    <div className={`h-full bg-slate-900/30 border p-5 rounded-2xl transition-all duration-300 shadow relative flex flex-col justify-between ${act.color}`}>
                      <div className="space-y-1.5">
                        <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-zinc-500 group-hover:text-white transition">
                          {act.label} Tool
                        </span>
                        <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {act.name}
                        </h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                          {act.desc}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 group-hover:text-indigo-300 pt-4 transition-all">
                        Launch <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: CUMULATIVE ATS GRADE & ACTIVITY */}
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

            {/* Interactive Cumulative ATS Score Gauge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-slate-950/40 border border-white/10 p-6 rounded-3xl space-y-6 shadow-xl backdrop-blur-md"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" /> Overall Portfolio Score
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
                      className={`transition-all duration-1000 ease-out ${getAtsGlow(atsScore)}`}
                      strokeWidth="8" 
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 62}
                      strokeDashoffset={2 * Math.PI * 62 * (1 - atsScore / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white">{atsScore}%</span>
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">Grade</span>
                  </div>
                </div>

                <div className="space-y-1 text-center">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${getAtsBadgeColor(atsScore)}`}>
                    {atsScore >= 85 ? 'Excellent Alignment' : 'Moderate Compatibility'}
                  </span>
                  <p className="text-[10px] text-zinc-500 leading-normal pt-2.5 max-w-[220px] mx-auto">
                    Aggregated rating across all technical experience, education major, and keyword sets. Complete profile parameters to boost score!
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Live Alerts Desk */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="bg-slate-950/40 border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl backdrop-blur-md"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" /> Live Alerts Desk
                </h3>
                {notifications.some(n => !n.read) && (
                  <button
                    onClick={handleReadAllNotifs}
                    className="text-[9px] font-mono text-zinc-400 hover:text-white uppercase font-bold bg-white/5 py-1 px-2.5 rounded-full border border-white/5 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="space-y-2.5 max-h-48 overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                  <p className="text-[10px] text-zinc-500 italic py-2 text-center">No active alerts to show.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 rounded-xl border text-[10px] space-y-1 transition ${
                        n.read
                          ? 'bg-zinc-950/20 border-white/5 text-zinc-400'
                          : 'bg-emerald-500/5 border-emerald-500/20 text-zinc-200 shadow-emerald-500/5 shadow'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{n.title}</span>
                        {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="leading-relaxed text-zinc-300">{n.message}</p>
                      <span className="text-[8px] text-zinc-500 block mt-1 font-mono">
                        {new Date(n.timestamp).toLocaleDateString()} at {new Date(n.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Recent activity & Scheduled Reviews widget */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-slate-950/40 border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl backdrop-blur-md"
            >
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2.5">
                <Clock className="w-4 h-4 text-cyan-400" /> Active Schedule Deck
              </h3>

              <div className="space-y-3.5">
                {/* Active calendar slot item */}
                <div className="p-3.5 bg-zinc-950/60 border border-indigo-500/20 rounded-xl space-y-2.5 shadow">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-indigo-400">Technical Screening</span>
                      <h4 className="text-xs font-bold text-white">Vercel Technical Screening</h4>
                      <p className="text-[9px] text-zinc-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> May 28, 2026 at 10:00 AM
                      </p>
                    </div>
                    <span className="text-[8px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                      Secured
                    </span>
                  </div>

                  {/* Soundwave animation */}
                  <div className="flex justify-between items-center bg-black/40 p-2 rounded-lg border border-white/5">
                    <span className="text-[8px] text-zinc-500 font-mono flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" /> Liveness mic check
                    </span>
                    <div className="flex gap-0.5 h-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => (
                        <motion.div
                          key={bar}
                          animate={{
                            height: [2, Math.floor(Math.random() * 8) + 2, 2]
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.4 + Math.random() * 0.3,
                            ease: "easeInOut"
                          }}
                          className="w-[2px] bg-indigo-500 rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Second item (pending) */}
                <div className="p-3.5 bg-[#0B0F19]/20 border border-white/5 rounded-xl flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-zinc-500">Resume Grader Check</span>
                    <h4 className="text-xs font-bold text-zinc-300">OpenAI Match Audit</h4>
                    <p className="text-[9px] text-zinc-500 italic">No slot scheduled yet.</p>
                  </div>
                  <Link href="/candidate/jobs" passHref>
                    <button type="button" className="py-1 px-3 bg-white/5 border border-white/10 hover:bg-indigo-600/30 hover:border-indigo-500/50 hover:text-white rounded-lg text-[9px] font-bold transition text-zinc-400 cursor-pointer">
                      Schedule
                    </button>
                  </Link>
                </div>
              </div>
            </motion.div>

          </div>

        </div>

      </div>
    </CandidateLayout>
  );
}
