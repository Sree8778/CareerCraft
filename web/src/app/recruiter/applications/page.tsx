// src/app/recruiter/applications/page.tsx
'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const STATUS_COLORS: Record<string, string> = {
  Applied: 'bg-blue-500',
  'In Review': 'bg-yellow-500',
  Interviewed: 'bg-indigo-500',
  Shortlisted: 'bg-cyan-500',
  Hired: 'bg-green-500',
  Rejected: 'bg-red-500',
};

const FILTERS = ['All', 'Applied', 'In Review', 'Interviewed', 'Shortlisted', 'Hired', 'Rejected'];

export default function ApplicationsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'recruiter') { router.push('/'); return; }
    const fetch_ = async () => {
      setLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/applications?recruiterId=${user.id}`, {
          headers: { 'Authorization': `Bearer mock_token_for_${user.id}` },
        });
        const data = await res.json();
        setApplications(data.applications || []);
      } catch { setApplications([]); }
      finally { setLoading(false); }
    };
    fetch_();
  }, [isAuthenticated, user, router]);

  const filtered = applications
    .filter(a => selectedFilter === 'All' || a.status === selectedFilter)
    .filter(a =>
      a.candidateName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <RecruiterLayout>
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold">Applications</h1>
        <div className="flex flex-wrap gap-2 items-center">
          {FILTERS.map(s => (
            <button key={s} onClick={() => setSelectedFilter(s)}
              className={`px-3 py-1 rounded-full text-sm ${selectedFilter === s ? 'bg-purple-600 text-white' : 'bg-white text-black'}`}>
              {s}
            </button>
          ))}
          <input type="text" placeholder="Search..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3 py-1 rounded-md text-sm bg-white text-black border border-gray-300" />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading applications...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400">{applications.length === 0 ? 'No applications received yet.' : 'No results match your filter.'}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(app => (
            <Link href={`/recruiter/applications/${app.id}`} key={app.id}
              className="glass p-6 rounded-xl text-white shadow-lg hover:shadow-xl hover:scale-[1.01] transition">
              <h3 className="text-lg font-semibold">{app.candidateName}</h3>
              <p className="text-sm text-zinc-400">{app.jobTitle} · {app.company}</p>
              <p className="text-xs text-zinc-500 mt-1">Applied {app.appliedDate}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs text-white ${STATUS_COLORS[app.status] || 'bg-zinc-500'}`}>
                {app.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </RecruiterLayout>
  );
}
