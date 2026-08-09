'use client';

export const dynamic = 'force-dynamic';

// src/app/recruiter/requisitions/page.tsx
import { useState, useEffect } from 'react';

import RequisitionCard from '@/components/recruiter/RequisitionCard';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw, Plus, Briefcase } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { toast } from 'sonner';

type StatusFilter = 'All' | 'Open' | 'Draft' | 'Paused' | 'Archived' | 'Closed' | 'In Review';

export default function RequisitionListPage() {
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'recruiter') { router.push('/'); return; }

    const fetchJobs = async () => {
      setLoading(true);
      try {
        // Fetch jobs and their application counts in parallel
        const res = await fetch(`${API_BASE}/jobs?recruiterId=${user.id}`, {
          headers: { 'Authorization': `Bearer ${await getToken()}` },
        });
        const data = await res.json();
        const jobList: any[] = data.jobs || [];

        // Fetch applicant counts for each job
        const withCounts = await Promise.all(
          jobList.map(async (job: any) => {
            try {
              const appsRes = await fetch(`${API_BASE}/jobs/${job.id}/applications`, {
                headers: { 'Authorization': `Bearer ${await getToken()}` },
              });
              const appsData = await appsRes.json();
              return { ...job, applicants: (appsData.applications || []).length };
            } catch {
              return { ...job, applicants: 0 };
            }
          })
        );
        setJobs(withCounts);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [isAuthenticated, user, router, authLoading]);

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    const prev = jobs;
    setJobs(jobs.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        newStatus === 'Open' ? 'Job is live — candidates can apply.'
        : newStatus === 'Paused' ? 'Job paused — hidden from candidates, applications kept.'
        : newStatus === 'Closed' ? 'Job closed.'
        : `Status changed to ${newStatus}.`
      );
    } catch {
      setJobs(prev); // roll back optimistic update
      toast.error('Failed to update status.');
    }
  };

  if (!isAuthenticated || user?.role !== 'recruiter') return null;

  const filtered = filter === 'All' ? jobs : jobs.filter(j => (j.status || 'Open') === filter);

  const statusCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    const s = j.status || 'Open';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  return (
    <RecruiterLayout>
      <div className="cc-page text-white space-y-6">
        <div className="cc-workspace-header flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="cc-eyebrow mb-1">Hiring operations</p>
            <h1 className="text-3xl font-bold">My Requisitions</h1>
            <p className="text-muted text-sm mt-1">Create, publish, and manage every role in your hiring pipeline.</p>
          </div>
          <Link href="/recruiter/requisitions/new"
            className="cc-btn-primary shrink-0 text-sm">
            <Plus className="w-4 h-4" />New Requisition
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(['All', 'Open', 'Draft', 'Paused', 'In Review', 'Closed', 'Archived'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              data-active={filter === s}
              className="cc-filter-chip px-4 py-1.5 text-sm font-semibold">
              {s}
              {s !== 'All' && statusCounts[s] !== undefined && (
                <span className="ml-1.5 text-xs opacity-70">{statusCounts[s]}</span>
              )}
              {s === 'All' && <span className="ml-1.5 text-xs opacity-70">{jobs.length}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-zinc-400">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />Loading your jobs...
          </div>
        ) : filtered.length === 0 ? (
          <div className="cc-empty-state p-12 text-center text-muted">
            <Briefcase className="w-12 h-12 mx-auto mb-4 text-[var(--cc-accent)]/60" />
            <p className="font-semibold text-lg">
              {filter === 'All' ? "No job postings yet" : `No ${filter} jobs`}
            </p>
            {filter === 'All' && (
              <p className="text-sm mt-2 mb-6">Post your first job to start receiving applications.</p>
            )}
            {filter === 'All' && (
              <Link href="/recruiter/requisitions/new"
                className="cc-btn-primary text-sm">
                <Plus className="w-4 h-4" />Post a Job
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(job => (
              <RequisitionCard
                key={job.id}
                id={job.id}
                title={job.title}
                location={job.location || 'Remote'}
                postedDate={job.postedDate || ''}
                status={job.status || 'Open'}
                applicants={job.applicants || 0}
                department={job.department}
                jobType={job.jobType}
                salaryMin={job.salaryMin}
                salaryMax={job.salaryMax}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </RecruiterLayout>
  );
}
