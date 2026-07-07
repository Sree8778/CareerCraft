// src/app/recruiter/sourcing/page.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import {
  Search, Sparkles, RefreshCw, Globe,
  Mail, MapPin, Copy, CheckCircle, ExternalLink
} from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { useEffect } from 'react';
import { API_BASE as API } from '@/lib/api';

const JOB_BOARDS = [
  { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/search/?keywords=', icon: '💼', color: 'border-blue-500/30 hover:border-blue-400/60' },
  { name: 'Indeed', url: 'https://www.indeed.com/jobs?q=', icon: '🔍', color: 'border-indigo-500/30 hover:border-indigo-400/60' },
  { name: 'Glassdoor', url: 'https://www.glassdoor.com/Job/jobs.htm?sc.keyword=', icon: '🏢', color: 'border-emerald-500/30 hover:border-emerald-400/60' },
  { name: 'Wellfound (AngelList)', url: 'https://wellfound.com/jobs?role=', icon: '🚀', color: 'border-orange-500/30 hover:border-orange-400/60' },
  { name: 'Dice (Tech)', url: 'https://www.dice.com/jobs?q=', icon: '🎲', color: 'border-red-500/30 hover:border-red-400/60' },
  { name: 'GitHub Jobs', url: 'https://jobs.github.com/?search=', icon: '⚙️', color: 'border-zinc-500/30 hover:border-zinc-400/60' },
];

export default function RecruiterSourcingPage() {
  const { user, isAuthenticated, getToken, loading } = useAuth();
  const router = useRouter();

  const [jobTitle, setJobTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [location, setLocation] = useState('');
  const [outreachTemplate, setOutreachTemplate] = useState('');
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || user?.role !== 'recruiter') router.push('/');
  }, [isAuthenticated, user, router, loading]);

  const searchQuery = [jobTitle, skills, location].filter(Boolean).join(' ');

  const openJobBoard = (baseUrl: string) => {
    if (!searchQuery.trim()) { toast.error('Enter a job title or skills first.'); return; }
    window.open(baseUrl + encodeURIComponent(searchQuery), '_blank');
  };

  const generateOutreach = async () => {
    if (!jobTitle.trim()) { toast.error('Enter a job title first.'); return; }
    setGeneratingOutreach(true);
    const toastId = toast.loading('AI is drafting an outreach message…');
    try {
      const res = await fetch(`${API}/jobs/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({
          title: jobTitle, skills, type: 'outreach',
          company: user?.name || 'our company',
        }),
      });
      const data = await res.json();
      const template = data.description
        ? `Hi [Candidate Name],\n\nI came across your profile and think you'd be a great fit for a ${jobTitle} role at ${user?.name || 'our company'}.\n\n${data.description.slice(0, 300)}…\n\nWould you be open to a quick call to discuss? Happy to share more details.\n\nBest,\n${user?.name || 'Recruiter'}`
        : `Hi [Candidate Name],\n\nI came across your profile and I'm reaching out about an exciting ${jobTitle} opportunity${skills ? ` requiring ${skills}` : ''} at ${user?.name || 'our company'}.\n\nWould you be open to a quick chat to explore if it could be a good fit?\n\nBest regards,\n${user?.name || 'Recruiter'}`;
      setOutreachTemplate(template);
      toast.success('Outreach template ready.', { id: toastId });
    } catch {
      const fallback = `Hi [Candidate Name],\n\nI came across your profile and I'm reaching out about an exciting ${jobTitle} opportunity${skills ? ` requiring ${skills}` : ''} at ${user?.name || 'our company'}.\n\nWould you be open to a quick conversation to explore if it could be a good fit?\n\nBest regards,\n${user?.name || 'Recruiter'}`;
      setOutreachTemplate(fallback);
      toast.success('Outreach template ready.', { id: toastId });
    } finally {
      setGeneratingOutreach(false);
    }
  };

  const copyTemplate = () => {
    navigator.clipboard.writeText(outreachTemplate);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <RecruiterLayout>
      <Toaster position="top-right" richColors />
      <div className="max-w-4xl mx-auto space-y-8 text-white">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-purple-400" /> Passive Sourcing
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Search external job boards and generate AI outreach messages for candidates outside the platform.
          </p>
        </div>

        {/* Search panel */}
        <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Build Your Search Query</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Job Title</label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Senior React Engineer"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Key Skills</label>
              <input value={skills} onChange={e => setSkills(e.target.value)}
                placeholder="e.g. React, TypeScript, AWS"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Location</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="Remote / New York"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
              </div>
            </div>
          </div>

          {searchQuery && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Search className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              Query: <span className="text-white font-mono">{searchQuery}</span>
            </div>
          )}
        </div>

        {/* Job boards */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Search on Job Boards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {JOB_BOARDS.map(board => (
              <button key={board.name} onClick={() => openJobBoard(board.url)}
                className={`glass rounded-xl p-4 border text-left transition flex items-center justify-between group ${board.color}`}>
                <div>
                  <span className="text-base mr-2">{board.icon}</span>
                  <span className="text-sm font-semibold text-white">{board.name}</span>
                </div>
                <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-white transition shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* AI outreach generator */}
        <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" /> AI Outreach Message
            </h2>
            <button onClick={generateOutreach} disabled={generatingOutreach || !jobTitle.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-300 hover:text-white rounded-lg text-xs font-semibold transition disabled:opacity-40">
              {generatingOutreach ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Generating…</> : <><Sparkles className="w-3.5 h-3.5" />Generate</>}
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Generate a personalised cold outreach message to send to passive candidates on LinkedIn, email, or other platforms.
          </p>

          {outreachTemplate ? (
            <div className="space-y-3">
              <textarea
                value={outreachTemplate}
                onChange={e => setOutreachTemplate(e.target.value)}
                rows={10}
                className="w-full p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-zinc-200 font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              />
              <button onClick={copyTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold transition">
                {copied ? <><CheckCircle className="w-3.5 h-3.5" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy to Clipboard</>}
              </button>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-white/10 rounded-xl text-zinc-500 text-sm">
              Fill in the job title above and click Generate to create an outreach message.
            </div>
          )}
        </div>

      </div>
    </RecruiterLayout>
  );
}
