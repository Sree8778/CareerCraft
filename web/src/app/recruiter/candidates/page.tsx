// src/app/recruiter/candidates/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import CandidateCard from '@/components/recruiter/CandidateCard';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, SlidersHorizontal, X, RefreshCw } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/lib/api';

const statusOptions = ['All', 'Shortlisted', 'Interviewed', 'Applied'];

export default function CandidateListPage() {
  const { getToken } = useAuth();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [roleFilter, setRoleFilter] = useState('All');

  // AI Recruiter Copilot States
  const [copilotQuery, setCopilotQuery] = useState('');
  const [isCopilotActive, setIsCopilotActive] = useState(false);
  const [copilotResults, setCopilotResults] = useState<any[]>([]);
  const [showCopilotSidebar, setShowCopilotSidebar] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);

  // Real-time Firestore listener for candidates
  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'candidate'));
    const unsub = onSnapshot(q, snap => {
      setCandidates(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || data.fullName || 'Candidate',
          role: data.targetRole || data.currentRole || '',
          status: data.status || 'Applied',
          location: data.location || 'Remote',
          experience: data.experienceYears || '',
          skills: data.skills || '',
        };
      }));
    }, () => {});
    return () => unsub();
  }, []);

  // Dynamic role options derived from loaded candidates
  const roleOptions = useMemo(() => {
    const roles = Array.from(new Set(candidates.map(c => c.role).filter(Boolean)));
    return ['All', ...roles.sort()];
  }, [candidates]);

  // Filtered candidates (standard filters — bypassed when Copilot is active)
  const displayedCandidates = useMemo(() => {
    if (isCopilotActive) return copilotResults;
    return candidates.filter(c => {
      const statusMatch = statusFilter === 'All' || c.status === statusFilter;
      const roleMatch   = roleFilter   === 'All' || c.role   === roleFilter;
      return statusMatch && roleMatch;
    });
  }, [candidates, statusFilter, roleFilter, isCopilotActive, copilotResults]);

  // AI Recruiter Copilot Search
  const handleCopilotSearch = async () => {
    if (!copilotQuery.trim()) {
      toast.info("Ask Copilot something, e.g. 'Find candidates with 4+ years React experience'");
      return;
    }
    setCopilotLoading(true);
    const toastId = toast.loading('AI Recruiter Copilot is analyzing candidate resumes…');
    try {
      const res = await fetch(`${API_BASE}/candidates/search-copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
        body: JSON.stringify({ query: copilotQuery, candidates }),
      });
      if (!res.ok) throw new Error('Copilot search failed');
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        setCopilotResults(results);
        setIsCopilotActive(true);
        toast.success(`AI Copilot found ${results.length} matched candidates!`, { id: toastId });
      } else {
        toast.info('No candidates matched this criteria semantically.', { id: toastId });
      }
    } catch {
      toast.dismiss(toastId);
      toast.error('Copilot backend unavailable');
    } finally {
      setCopilotLoading(false);
    }
  };

  const resetCopilot = () => {
    setCopilotQuery('');
    setIsCopilotActive(false);
    setCopilotResults([]);
    toast.success('AI Copilot filters cleared.');
  };

  return (
    <RecruiterLayout>
      <Toaster position="top-right" richColors />
      <div className="flex flex-col gap-6 relative min-h-[80vh]">
        
        {/* Banner with Copilot Trigger */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 glass flex justify-between items-center max-sm:flex-col max-sm:gap-4 max-sm:text-center">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              RecruitEdge Candidates
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Review applicant submissions, track proctoring security metrics, and leverage AI matching.
            </p>
          </div>
          
          <button 
            onClick={() => setShowCopilotSidebar(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-purple-500/20 shadow-lg text-white font-bold py-2.5 px-6 rounded-xl transition"
          >
            <Sparkles className="w-4.5 h-4.5" />
            AI Recruiter Copilot
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="glass p-4 rounded-xl flex flex-wrap justify-between items-center gap-4 border border-white/10">
          <div className="flex flex-wrap gap-4 items-center">
            <label className="text-sm text-zinc-300 flex items-center gap-2">
              Status:
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                disabled={isCopilotActive}
                className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-zinc-300 flex items-center gap-2">
              Role:
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                disabled={isCopilotActive}
                className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
              >
                {roleOptions.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
          </div>

          <span className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Showing {displayedCandidates.length} applicants {isCopilotActive && "(AI Copilot Ranked)"}
          </span>
        </div>

        {/* Candidates Grid */}
        {displayedCandidates.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-400 text-lg mb-2">No matching candidates found.</p>
            {isCopilotActive && (
              <button onClick={resetCopilot} className="text-purple-400 underline text-sm">
                Clear Copilot Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedCandidates.map((candidate, i) => (
              <motion.div 
                key={candidate.id} 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ scale: 1.02 }}
                className={`glass rounded-2xl p-5 hover:shadow-purple-500/10 transition-all duration-300 relative border ${
                  candidate.matchScore && candidate.matchScore > 85 
                    ? 'border-purple-500/30' 
                    : 'border-white/10'
                }`}
              >
                {/* AI Score Badge */}
                {candidate.matchScore && (
                  <div className="absolute top-4 right-4 bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {candidate.matchScore}% Fit
                  </div>
                )}

                <CandidateCard candidate={candidate} />
                
                {/* AI Matching Skills */}
                {candidate.matchingSkills && candidate.matchingSkills.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {candidate.matchingSkills.map((sk: string) => (
                      <span key={sk} className="text-[10px] font-mono px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded">
                        {sk}
                      </span>
                    ))}
                  </div>
                )}

                {/* Copilot Reasoning Card */}
                {candidate.copilotReasoning && (
                  <div className="mt-4 bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 text-xs leading-relaxed text-purple-200 italic">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-purple-400 block mb-1">
                      AI Match Reasoning
                    </span>
                    "{candidate.copilotReasoning}"
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* SIDEBAR: INTERACTIVE AI RECRUITER COPILOT */}
        <AnimatePresence>
          {showCopilotSidebar && (
            <>
              {/* Overlay background */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCopilotSidebar(false)}
                className="fixed inset-0 bg-black z-40 cursor-pointer"
              />
              
              {/* Sidebar Panel */}
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 20 }}
                className="fixed right-0 top-0 bottom-0 w-96 max-sm:w-full bg-zinc-950 border-l border-white/10 z-50 p-6 flex flex-col justify-between shadow-2xl"
              >
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
                      <h2 className="text-xl font-bold">AI Recruiter Copilot</h2>
                    </div>
                    <button 
                      onClick={() => setShowCopilotSidebar(false)}
                      className="p-1 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition"
                    >
                      <X className="w-5 h-5 text-zinc-400 hover:text-white" />
                    </button>
                  </div>
                  
                  <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                    Search candidate profiles and resumes semantically. The AI recruiter assesses applicant skills, years of experience, and achievements to present the best fits with detailed reasoning.
                  </p>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                      Conversational Search Query
                    </label>
                    <textarea 
                      placeholder="e.g. 'Show me candidates who have experience building scalable Python backends and know Docker'"
                      className="w-full h-32 p-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                      value={copilotQuery}
                      onChange={(e) => setCopilotQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-white/5">
                  <button 
                    onClick={handleCopilotSearch}
                    disabled={copilotLoading}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 rounded-xl transition"
                  >
                    {copilotLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Analyzing candidates...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Execute Semantic Match
                      </>
                    )}
                  </button>
                  
                  {isCopilotActive && (
                    <button 
                      onClick={resetCopilot}
                      className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition text-sm font-semibold"
                    >
                      Clear AI Search
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>
    </RecruiterLayout>
  );
}
