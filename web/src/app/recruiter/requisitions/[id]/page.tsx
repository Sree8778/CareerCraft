// src/app/recruiter/requisitions/[id]/page.tsx
'use client';
import React, { useEffect, useState } from 'react';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Calendar, MapPin, Briefcase, Edit3, Archive,
  RefreshCw, ChevronRight, CheckCircle, Clock, TrendingUp
} from 'lucide-react';
import { API_BASE as API } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  Applied: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'In Review': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Interviewed: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  Shortlisted: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Hired: 'bg-green-500/20 text-green-300 border-green-500/30',
  Rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || 'U';
};

export default function RequisitionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, getToken } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);

  const getAuthHeader = async () => ({ 'Authorization': `Bearer ${await getToken()}` });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [jobRes, appsRes] = await Promise.all([
          fetch(`${API}/jobs/${id}`, { headers: await getAuthHeader() }),
          fetch(`${API}/jobs/${id}/applications`, { headers: await getAuthHeader() }),
        ]);
        if (!jobRes.ok) { router.push('/recruiter/requisitions'); return; }
        const jobData = await jobRes.json();
        setJob(jobData);
        const appsData = await appsRes.json();
        setApplications(appsData.applications || []);
      } catch { toast.error('Failed to load requisition.'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const handleArchive = async () => {
    if (!confirm('Archive this job? It will be hidden from candidate search.')) return;
    setArchiving(true);
    try {
      const res = await fetch(`${API}/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
        body: JSON.stringify({ status: 'Archived' }),
      });
      if (!res.ok) throw new Error('Failed to archive');
      toast.success('Job archived.');
      router.push('/recruiter/requisitions');
    } catch { toast.error('Failed to archive job.'); }
    finally { setArchiving(false); }
  };

  if (loading) return (
    <RecruiterLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    </RecruiterLayout>
  );
  if (!job) return null;

  const applicantCount = applications.length;
  const interviewCount = applications.filter(a => ['Interviewed', 'Interview Scheduled'].includes(a.status)).length;
  const hiredCount = applications.filter(a => a.status === 'Hired').length;
  const shortlistedCount = applications.filter(a => a.status === 'Shortlisted').length;

  // Group applications by status for pipeline summary
  const stageCounts: Record<string, number> = {};
  applications.forEach(a => { stageCounts[a.status] = (stageCounts[a.status] || 0) + 1; });

  const recentApps = applications.slice(0, 5);

  return (
    <RecruiterLayout>
      <div className="max-w-5xl mx-auto text-white space-y-6">

        {/* Back */}
        <Link href="/recruiter/requisitions" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition">
          <ArrowLeft className="w-4 h-4" />Back to Requisitions
        </Link>

        {/* Header */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold">{job.title}</h1>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${
                  job.status === 'Archived' ? 'bg-zinc-700/50 text-zinc-400 border-zinc-600' :
                  'bg-green-500/20 text-green-300 border-green-500/30'
                }`}>
                  {job.status || 'Open'}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
                <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.company}</span>
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.jobType}</span>
                {job.department && <span className="text-purple-400">{job.department}</span>}
              </div>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />Posted {job.postedDate}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap shrink-0">
              <Link href={`/recruiter/requisitions/new?edit=${id}`}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-sm transition">
                <Edit3 className="w-4 h-4" />Edit
              </Link>
              <button onClick={handleArchive} disabled={archiving || job.status === 'Archived'}
                className="flex items-center gap-2 px-4 py-2 bg-red-700/30 hover:bg-red-700 border border-red-700/50 hover:border-red-600 disabled:opacity-40 rounded-lg text-sm text-red-300 hover:text-white transition">
                {archiving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                {archiving ? 'Archiving...' : job.status === 'Archived' ? 'Archived' : 'Archive'}
              </button>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Applicants', value: applicantCount, icon: Users, color: 'text-blue-400' },
            { label: 'Interviews', value: interviewCount, icon: TrendingUp, color: 'text-indigo-400' },
            { label: 'Shortlisted', value: shortlistedCount, icon: CheckCircle, color: 'text-cyan-400' },
            { label: 'Hired', value: hiredCount, icon: CheckCircle, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <motion.div key={label} whileHover={{ y: -2 }}
              className="glass rounded-xl p-4 border border-white/10">
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs text-zinc-400 font-medium">{label}</p>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-3xl font-black">{value}</p>
            </motion.div>
          ))}
        </div>

        {/* Job description */}
        <div className="glass rounded-xl p-6 border border-white/10">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-widest text-zinc-400">Job Description</h2>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{job.description}</p>
        </div>

        {/* Pipeline stage breakdown */}
        {applicantCount > 0 && (
          <div className="glass rounded-xl p-6 border border-white/10">
            <h2 className="font-semibold mb-4 text-sm uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />Pipeline Breakdown
            </h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stageCounts).map(([stage, count]) => (
                <div key={stage} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${STATUS_COLORS[stage] || 'bg-zinc-700/50 text-zinc-400 border-zinc-600'}`}>
                  <span>{stage}</span>
                  <span className="font-black">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent applicants */}
        <div className="glass rounded-xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h2 className="font-semibold text-sm uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />Applicants ({applicantCount})
            </h2>
            <Link href={`/recruiter/requisitions/${id}/applications`}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {applicantCount === 0 ? (
            <div className="px-6 py-10 text-center text-zinc-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
              <p className="font-semibold">No applications yet</p>
              <p className="text-sm mt-1">Applications will appear here once candidates apply.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentApps.map(app => (
                <Link key={app.id} href={`/recruiter/applications/${app.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold">
                      {getInitials(app.candidateName)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm group-hover:text-purple-300 transition">{app.candidateName}</p>
                      <p className="text-xs text-zinc-500">{app.candidateEmail} · Applied {app.appliedDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${STATUS_COLORS[app.status] || 'bg-zinc-700/50 text-zinc-400 border-zinc-600'}`}>
                      {app.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition" />
                  </div>
                </Link>
              ))}
              {applicantCount > 5 && (
                <Link href={`/recruiter/requisitions/${id}/applications`}
                  className="block px-6 py-3 text-center text-xs text-purple-400 hover:text-purple-300 hover:bg-white/5 transition">
                  + {applicantCount - 5} more applicants — View all
                </Link>
              )}
            </div>
          )}
        </div>

      </div>
    </RecruiterLayout>
  );
}
