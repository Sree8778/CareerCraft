// src/app/recruiter/requisitions/[id]/applications/page.tsx
'use client';

import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { ArrowLeft, Users, RefreshCw, ChevronRight, Search } from 'lucide-react';

const STAGES = ['Applied', 'In Review', 'Interviewed', 'Shortlisted', 'Hired', 'Rejected'];

const STAGE_COLORS: Record<string, { bg: string; border: string; badge: string; dot: string }> = {
  Applied:     { bg: 'bg-blue-950/30',   border: 'border-blue-500/20',   badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',     dot: 'bg-blue-400' },
  'In Review': { bg: 'bg-yellow-950/30', border: 'border-yellow-500/20', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', dot: 'bg-yellow-400' },
  Interviewed: { bg: 'bg-indigo-950/30', border: 'border-indigo-500/20', badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', dot: 'bg-indigo-400' },
  Shortlisted: { bg: 'bg-cyan-950/30',   border: 'border-cyan-500/20',   badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',       dot: 'bg-cyan-400' },
  Hired:       { bg: 'bg-green-950/30',  border: 'border-green-500/20',  badge: 'bg-green-500/20 text-green-300 border-green-500/30',    dot: 'bg-green-400' },
  Rejected:    { bg: 'bg-red-950/30',    border: 'border-red-500/20',    badge: 'bg-red-500/20 text-red-300 border-red-500/30',          dot: 'bg-red-400' },
};

type ViewMode = 'kanban' | 'list';

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || 'U';
};

export default function ApplicationsListPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('All');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  const authHeader = { 'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}` };

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [appsRes, jobRes] = await Promise.all([
          fetch(`${API_BASE}/jobs/${id}/applications`, { headers: authHeader }),
          fetch(`${API_BASE}/jobs/${id}`, { headers: authHeader }),
        ]);
        const appsData = await appsRes.json();
        setApplications(appsData.applications || []);
        if (jobRes.ok) {
          const jobData = await jobRes.json();
          setJobTitle(jobData.title || '');
        }
      } catch { setApplications([]); }
      finally { setLoading(false); }
    };
    load();
  }, [id, user]);

  const filtered = applications.filter(app => {
    const matchSearch = !search ||
      app.candidateName?.toLowerCase().includes(search.toLowerCase()) ||
      app.candidateEmail?.toLowerCase().includes(search.toLowerCase());
    const matchStage = filterStage === 'All' || app.status === filterStage;
    return matchSearch && matchStage;
  });

  const byStage = (stage: string) => filtered.filter(a => a.status === stage);

  const ApplicantCard = ({ app }: { app: any }) => {
    const colors = STAGE_COLORS[app.status] || STAGE_COLORS['Applied'];
    return (
      <Link href={`/recruiter/applications/${app.id}`}>
        <motion.div whileHover={{ y: -2 }}
          className="glass p-4 rounded-xl border border-white/10 hover:border-purple-500/40 transition group cursor-pointer space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                {getInitials(app.candidateName)}
              </div>
              <div>
                <p className="font-semibold text-sm group-hover:text-purple-300 transition leading-tight">{app.candidateName}</p>
                <p className="text-[11px] text-zinc-500">{app.candidateEmail}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 shrink-0 transition" />
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${colors.badge}`}>{app.status}</span>
            <span className="text-[10px] text-zinc-500">{app.appliedDate}</span>
          </div>
          {app.recruiterNotes && (
            <p className="text-[10px] text-zinc-500 italic truncate">Note: {app.recruiterNotes}</p>
          )}
        </motion.div>
      </Link>
    );
  };

  return (
    <RecruiterLayout>
      <div className="text-white space-y-6">

        {/* Back */}
        <Link href={`/recruiter/requisitions/${id}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition">
          <ArrowLeft className="w-4 h-4" />Back to Requisition
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Applicants</h1>
            {jobTitle && <p className="text-sm text-zinc-400 mt-0.5">for <span className="text-purple-300">{jobTitle}</span></p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">{applications.length} total</span>
            {/* View mode toggle */}
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5">
              {(['kanban', 'list'] as ViewMode[]).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold transition ${viewMode === m ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'}`}>
                  {m === 'kanban' ? '⬛ Kanban' : '☰ List'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates..."
              className="pl-8 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 w-48" />
          </div>
          {['All', ...STAGES].map(stage => (
            <button key={stage} onClick={() => setFilterStage(stage)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                filterStage === stage
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
              }`}>
              {stage}
              {stage !== 'All' && (
                <span className="ml-1.5 text-[10px] opacity-70">{applications.filter(a => a.status === stage).length}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-zinc-400">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />Loading applicants...
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-12 border border-white/10 text-center text-zinc-500">
            <Users className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
            <p className="font-semibold">{applications.length === 0 ? 'No applications yet' : 'No results match your filter'}</p>
          </div>
        ) : viewMode === 'kanban' ? (
          /* KANBAN VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STAGES.map(stage => {
              const stageApps = byStage(stage);
              if (stageApps.length === 0 && filterStage !== 'All' && filterStage !== stage) return null;
              const colors = STAGE_COLORS[stage];
              return (
                <div key={stage} className={`rounded-xl border p-4 space-y-3 ${colors.bg} ${colors.border}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">{stage}</h3>
                    </div>
                    <span className="text-xs font-bold text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full">{stageApps.length}</span>
                  </div>
                  <div className="space-y-2">
                    {stageApps.length === 0 ? (
                      <p className="text-[11px] text-zinc-600 text-center py-4">No candidates</p>
                    ) : (
                      stageApps.map(app => <ApplicantCard key={app.id} app={app} />)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="glass rounded-xl border border-white/10 overflow-hidden">
            <div className="divide-y divide-white/5">
              {filtered.map(app => {
                const colors = STAGE_COLORS[app.status] || STAGE_COLORS['Applied'];
                return (
                  <Link key={app.id} href={`/recruiter/applications/${app.id}`}
                    className="flex items-center justify-between px-5 py-4 hover:bg-white/5 transition group">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {getInitials(app.candidateName)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm group-hover:text-purple-300 transition">{app.candidateName}</p>
                        <p className="text-xs text-zinc-500">{app.candidateEmail} · Applied {app.appliedDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${colors.badge}`}>{app.status}</span>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </RecruiterLayout>
  );
}
