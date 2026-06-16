// src/app/recruiter/sourcing/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { 
  Users, Search, SlidersHorizontal, MapPin, 
  Award, ShieldCheck, Mail, Phone, ChevronRight, BrainCircuit 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

export default function RecruiterSourcingPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [candidates, setCandidates] = useState<any[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [skillsFilter, setSkillsFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [minExp, setMinExp] = useState(0);
  const [minProctor, setMinProctor] = useState(0);

  // Copilot query state
  const [copilotQuery, setCopilotQuery] = useState('');
  const [runningCopilot, setRunningCopilot] = useState(false);
  const [copilotUsed, setCopilotUsed] = useState(false);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (user?.role !== 'recruiter') {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  // Load all candidates
  const loadCandidates = async () => {
    setLoading(true);
    try {
      const token = user?.id ? `mock_token_for_${user.id}` : 'mock_token';
      const res = await fetch(`${API}/candidates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCandidates(data || []);
        setFilteredCandidates(data || []);
      }
    } catch (err) {
      console.error('Failed to load candidate directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, [user]);

  // Handle standard filters matching
  const applyFilters = () => {
    setCopilotUsed(false);
    let temp = [...candidates];

    if (skillsFilter.trim()) {
      const targetSkill = skillsFilter.toLowerCase().trim();
      temp = temp.filter(c => c.skills?.toLowerCase().includes(targetSkill));
    }

    if (locationFilter.trim()) {
      const targetLoc = locationFilter.toLowerCase().trim();
      temp = temp.filter(c => c.location?.toLowerCase().includes(targetLoc));
    }

    if (minExp > 0) {
      temp = temp.filter(c => {
        // Parse experience years (e.g. "Senior Software Engineer (5 years)" or standard integer parse)
        const expStr = c.experience || '';
        const match = expStr.match(/(\d+)\s*years?/i);
        if (match) {
          return parseInt(match[1]) >= minExp;
        }
        // If not found in match, assume 3 years or matches loosely
        return minExp <= 3;
      });
    }

    if (minProctor > 0) {
      temp = temp.filter(c => {
        // Check dynamic proctor grade or voice scorecard
        const score = c.matchScore || c.matchPercentage || 85; // Fallback score
        return score >= minProctor;
      });
    }

    setFilteredCandidates(temp);
  };

  // Run AI Copilot search
  const handleCopilotSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim()) return;

    setRunningCopilot(true);
    try {
      const token = user?.id ? `mock_token_for_${user.id}` : 'mock_token';
      const res = await fetch(`${API}/candidates/search-copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: copilotQuery,
          candidates: candidates
        })
      });

      if (res.ok) {
        const sorted = await res.json();
        setFilteredCandidates(sorted);
        setCopilotUsed(true);
        toast.success(`Copilot returned ${sorted.length} semantically-ranked matches.`);
      } else {
        toast.error('AI Copilot search service failed.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network failure connecting to Copilot API.');
    } finally {
      setRunningCopilot(false);
    }
  };

  const handleReset = () => {
    setSkillsFilter('');
    setLocationFilter('');
    setMinExp(0);
    setMinProctor(0);
    setCopilotQuery('');
    setCopilotUsed(false);
    setFilteredCandidates(candidates);
  };

  return (
    <RecruiterLayout>
      <div className="max-w-6xl mx-auto space-y-6 text-white pb-12">
        
        {/* Header section */}
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <BrainCircuit className="w-8 h-8 text-purple-400" />
            AI Candidate Sourcing Search
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Source high-performing candidates using compound logical sliders and real-time AI matchmaking reasons.</p>
        </div>

        {/* AI Copilot input card */}
        <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border border-purple-500/20 rounded-3xl p-6 glass shadow-xl">
          <form onSubmit={handleCopilotSearch} className="space-y-3">
            <label className="text-[10px] font-mono tracking-widest text-purple-300 font-bold uppercase block flex items-center gap-1.5">
              <BrainCircuit className="w-4 h-4 text-purple-400 animate-pulse" /> Ask AI Recilot to Rank Applicants
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder='e.g., "Find Senior Flutter devs based in Austin who completed voice interviews with high proctor grades"'
                value={copilotQuery}
                onChange={(e) => setCopilotQuery(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={runningCopilot || !copilotQuery.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-xs font-bold font-mono tracking-wider uppercase rounded-xl shadow transition active:scale-95 cursor-pointer"
              >
                {runningCopilot ? 'Rank-Sorting...' : 'Query AI'}
              </button>
            </div>
          </form>
        </div>

        {/* Workspace dual columns */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* LEFT PANEL: FILTERS CARD */}
          <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-3xl p-6 glass space-y-6 h-fit">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-bold font-mono tracking-wider text-zinc-400 uppercase flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-zinc-500" /> Filters
              </span>
              <button 
                onClick={handleReset}
                className="text-[10px] font-bold font-mono tracking-wide text-zinc-500 hover:text-zinc-300 uppercase cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Filter sections */}
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono tracking-wider">Required Skills</label>
                <input
                  type="text"
                  placeholder="e.g. Flutter, React, Cloud"
                  value={skillsFilter}
                  onChange={(e) => setSkillsFilter(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono tracking-wider">Target Location</label>
                <input
                  type="text"
                  placeholder="e.g. Remote, Texas"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-mono font-bold text-zinc-400">
                  <label className="text-[10px] uppercase tracking-wider">Min Experience</label>
                  <span>{minExp}+ Years</span>
                </div>
                <input
                  type="range" min={0} max={10} value={minExp}
                  onChange={(e) => setMinExp(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between font-mono font-bold text-zinc-400">
                  <label className="text-[10px] uppercase tracking-wider">Min Proctor Score</label>
                  <span>{minProctor}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={5} value={minProctor}
                  onChange={(e) => setMinProctor(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <button
                onClick={applyFilters}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold font-mono tracking-wide text-white transition cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: RANKED CANDIDATES FEED */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-zinc-400 uppercase font-mono tracking-wider">
                {copilotUsed ? 'Copilot Match-Ranked Candidates' : 'Candidate Listings'}
              </span>
              <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                {filteredCandidates.length} Active Records
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-48 text-zinc-400 text-xs gap-2">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Retrieving profiles database...
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="p-16 border border-white/5 bg-white/5 rounded-3xl text-center space-y-3">
                <Users className="w-12 h-12 mx-auto text-zinc-700" />
                <h3 className="font-bold text-zinc-400">No candidates match search</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-normal">
                  Try decreasing experience slides or resetting AI queries to browse all profiles in Firestore.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCandidates.map((cand, index) => {
                  const matchScore = cand.matchScore || cand.matchPercentage;
                  const copilotReasoning = cand.copilotReasoning || cand.matchDescription;
                  
                  return (
                    <motion.div
                      key={cand.uid || cand.id || index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white/5 border border-white/10 hover:border-white/20 rounded-3xl p-6 glass transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/10 border border-white/5 flex items-center justify-center font-extrabold text-purple-400 shrink-0 text-sm">
                            {cand.name ? cand.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                              {cand.name || 'Anonymous Candidate'}
                              {matchScore && (
                                <span className="text-[10px] font-mono font-bold bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 flex items-center gap-0.5">
                                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> {matchScore}% Match
                                </span>
                              )}
                            </h3>
                            <p className="text-[11px] text-zinc-400 mt-0.5">{cand.title || 'Technical Specialist'}</p>
                          </div>
                        </div>

                        {/* Quick Contact metadata */}
                        <div className="flex gap-3 text-xs text-zinc-400">
                          {cand.email && (
                            <a href={`mailto:${cand.email}`} className="p-2 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 hover:text-white transition">
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          {cand.phone && (
                            <a href={`tel:${cand.phone}`} className="p-2 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 hover:text-white transition">
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Bio stats */}
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-t border-white/5 pt-4">
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Skills & Capabilities</span>
                          <p className="text-zinc-300 font-medium">{cand.skills || 'Not specified'}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Experience details</span>
                          <p className="text-zinc-300 font-medium truncate">{cand.experience || 'Not listed'}</p>
                        </div>
                      </div>

                      {/* AI Copilot reasoning bubble */}
                      {copilotReasoning && (
                        <div className="mt-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-purple-300 uppercase tracking-wider">
                            <BrainCircuit className="w-3.5 h-3.5 text-purple-400" /> AI Copilot Match Reasoning
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                            {copilotReasoning}
                          </p>
                        </div>
                      )}

                    </motion.div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

      </div>
    </RecruiterLayout>
  );
}
