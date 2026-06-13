// src/app/recruiter/requisitions/new/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Save, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const API = 'http://127.0.0.1:5000/api';

function NewRequisitionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditing = !!editId;

  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    type: 'Full-time',
    description: '',
    company: '',
  });
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  useEffect(() => {
    if (!editId) return;
    const fetchJob = async () => {
      setLoadingExisting(true);
      try {
        const res = await fetch(`${API}/jobs/${editId}`, {
          headers: { 'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}` },
        });
        if (!res.ok) { toast.error('Job not found.'); router.push('/recruiter/requisitions'); return; }
        const job = await res.json();
        setFormData({
          title: job.title || '',
          department: job.department || '',
          location: job.location || '',
          type: job.jobType || job.type || 'Full-time',
          description: job.description || '',
          company: job.company || '',
        });
      } catch { toast.error('Failed to load job for editing.'); }
      finally { setLoadingExisting(false); }
    };
    fetchJob();
  }, [editId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        jobType: formData.type,
        department: formData.department,
        location: formData.location,
        company: formData.company || user?.name || 'CareerCraft',
      };

      let res: Response;
      if (isEditing) {
        res = await fetch(`${API}/jobs/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API}/jobs/v1/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}` },
          body: JSON.stringify(payload),
        });
      }

      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Failed to save job');

      toast.success(isEditing ? 'Job updated successfully!' : 'Job posted successfully!');
      router.push('/recruiter/requisitions');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingExisting) return (
    <RecruiterLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    </RecruiterLayout>
  );

  return (
    <RecruiterLayout>
      <div className="max-w-2xl mx-auto text-white space-y-6">
        <Link href="/recruiter/requisitions" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition">
          <ArrowLeft className="w-4 h-4" />Back to Requisitions
        </Link>

        <div className="flex items-center gap-3">
          <Briefcase className="w-6 h-6 text-purple-400" />
          <h1 className="text-2xl font-bold">{isEditing ? 'Edit Requisition' : 'Create New Requisition'}</h1>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-xl p-6 border border-white/10 space-y-5">

          <div>
            <label className="block mb-1.5 text-sm font-medium text-zinc-300">Job Title *</label>
            <input type="text" name="title" value={formData.title} onChange={handleChange} required
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-zinc-300">Department</label>
              <input type="text" name="department" value={formData.department} onChange={handleChange}
                placeholder="e.g. Engineering"
                className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-zinc-300">Location *</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} required
                placeholder="e.g. Remote / New York"
                className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-zinc-300">Employment Type</label>
              <select name="type" value={formData.type} onChange={handleChange}
                className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-purple-500">
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-zinc-300">Company Name</label>
              <input type="text" name="company" value={formData.company} onChange={handleChange}
                placeholder={user?.name || 'Your company name'}
                className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500" />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-sm font-medium text-zinc-300">Job Description *</label>
            <textarea name="description" rows={6} value={formData.description} onChange={handleChange} required
              placeholder="Describe the role, responsibilities, and requirements..."
              className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-semibold text-sm transition">
              {loading
                ? <><RefreshCw className="w-4 h-4 animate-spin" />{isEditing ? 'Updating...' : 'Posting...'}</>
                : <><Save className="w-4 h-4" />{isEditing ? 'Save Changes' : 'Post Job'}</>
              }
            </button>
            <Link href="/recruiter/requisitions"
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 rounded-lg font-semibold text-sm transition">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </RecruiterLayout>
  );
}

export default function NewRequisitionPage() {
  return (
    <Suspense fallback={
      <RecruiterLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      </RecruiterLayout>
    }>
      <NewRequisitionContent />
    </Suspense>
  );
}
