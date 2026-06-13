// src/app/candidate/jobs/page.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, DollarSign, Sparkles, Search, SlidersHorizontal, Eye, RotateCcw, CheckCircle, Bell, BellOff, X, Plus } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Job } from '@/lib/mockJobApi';
import { toast } from 'sonner';
import { decryptApiKey } from '@/lib/crypto';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { API_BASE, authHeader, jsonHeaders } from '@/lib/api';

export default function JobListingsPage() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [allJobs, setAllJobs] = useState<Job[]>([]); // Store all fetched jobs
  const [displayedJobs, setDisplayedJobs] = useState<any[]>([]); // Store displayed jobs (supports semantic fields)
  const [loading, setLoading] = useState(true);
  
  // AI Search states
  const [isSemantic, setIsSemantic] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [applications, setApplications] = useState<any[]>([]);

  // Job alerts state
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertKeywords, setAlertKeywords] = useState('');
  const [alertLocation, setAlertLocation] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);

  const fetchAlerts = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/job-alerts`, { headers: authHeader(user.id) });
      if (res.ok) setAlerts((await res.json()).alerts ?? []);
    } catch { /* silent */ }
  };

  const handleCreateAlert = async () => {
    if (!alertKeywords.trim()) { toast.error('Enter keywords for the alert'); return; }
    setSavingAlert(true);
    try {
      const res = await fetch(`${API_BASE}/job-alerts`, {
        method: 'POST',
        headers: jsonHeaders(user!.id),
        body: JSON.stringify({ keywords: alertKeywords, location: alertLocation }),
      });
      if (!res.ok) throw new Error();
      toast.success('Job alert created! You\'ll be emailed when new matches appear.');
      setAlertKeywords('');
      setAlertLocation('');
      fetchAlerts();
    } catch { toast.error('Failed to create alert'); }
    finally { setSavingAlert(false); }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await fetch(`${API_BASE}/job-alerts/${id}`, { method: 'DELETE', headers: authHeader(user!.id) });
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success('Alert removed');
    } catch { toast.error('Failed to remove alert'); }
  };

  useEffect(() => { fetchAlerts(); }, [user?.id]);

  useEffect(() => {
    // Redirect non-candidates or unauthenticated users
    if (!isAuthenticated || user?.role !== 'candidate') {
      router.push('/');
      return;
    }

    const fetchJobs = async () => {
      setLoading(true);
      try {
        const [jobsResponse, appsResponse] = await Promise.all([
          fetch(`${API_BASE}/jobs`, {
            headers: {
              'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}`,
            },
          }),
          fetch(`${API_BASE}/applications?candidateId=${user.id}`, {
            headers: {
              'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}`,
            },
          })
        ]);
        
        const jobsData = await jobsResponse.json();
        const appsData = await appsResponse.json();

        // Normalize so both recruiter-posted and legacy mock jobs display consistently
        const normalized: Job[] = (jobsData.jobs || []).map((job: any) => ({
          id: job.id,
          title: job.title || 'Untitled',
          company: job.company || 'Company',
          location: job.location || 'Remote',
          salary: job.salary || 'Competitive',
          description: job.description || '',
          requirements: job.requirements || [],
          benefits: job.benefits || [],
          postedDate: job.postedDate || new Date().toISOString().split('T')[0],
          employmentType: job.jobType || job.employmentType || 'Full-time',
          emoji: job.emoji || '💼',
        }));
        setAllJobs(normalized);
        setDisplayedJobs(normalized);
        setApplications(appsData.applications || []);
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [isAuthenticated, user, router]);

  // Standard Keyword Search Filter
  useEffect(() => {
    if (isSemantic) return; // Ignore if semantic search is currently selected
    
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    const filtered = allJobs.filter(job =>
      job.title.toLowerCase().includes(lowercasedSearchTerm) ||
      job.company.toLowerCase().includes(lowercasedSearchTerm) ||
      job.location.toLowerCase().includes(lowercasedSearchTerm)
    );
    setDisplayedJobs(filtered);
  }, [searchTerm, allJobs, isSemantic]);

  // Trigger Gemini-powered Semantic Search
  const handleSemanticSearch = async () => {
    if (!searchTerm.trim()) {
      toast.info("Please enter a conversational query for the AI to analyze.");
      return;
    }

    setSemanticLoading(true);
    const toastId = toast.loading("AI Copilot is semantically matching jobs...");
    try {
      let customKey = '';
      if (typeof window !== 'undefined' && user?.id) {
        const savedEncryptedKey = localStorage.getItem('user_gemini_api_key') || '';
        if (savedEncryptedKey) {
          customKey = await decryptApiKey(savedEncryptedKey, user.id);
        }
      }

      const response = await fetch(`${API_BASE}/jobs/search-semantic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}`,
          'X-Gemini-API-Key': customKey
        },
        body: JSON.stringify({
          query: searchTerm,
          jobs: allJobs
        })
      });

      if (!response.ok) {
        throw new Error("Semantic search backend returned an error.");
      }

      const results = await response.json();
      
      if (Array.isArray(results) && results.length > 0) {
        setDisplayedJobs(results);
        setIsSemantic(true);
        toast.success(`Matched ${results.length} jobs semantically!`, { id: toastId });
      } else {
        toast.info("No matching jobs found semantically. Try rephrasing your preference.", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch semantic recommendations. Bypassing with simulated AI match...", { id: toastId });
      // Developer simulated fallback matching
      const mockSemanticMatches = allJobs.map(job => {
        let matchScore = 70;
        let reasoning = "Aligned with developer requirements.";
        
        if (searchTerm.toLowerCase().includes('remote') && job.location.toLowerCase().includes('remote')) {
          matchScore = 95;
          reasoning = "Excellent remote matching index with active flex requirements.";
        } else if (searchTerm.toLowerCase().includes('backend') && job.title.toLowerCase().includes('backend')) {
          matchScore = 92;
          reasoning = "Matches your precise focus in backend systems and python controllers.";
        }
        
        return {
          ...job,
          matchPercentage: matchScore,
          fitReasoning: reasoning
        };
      }).sort((a, b) => b.matchPercentage - a.matchPercentage);
      
      setDisplayedJobs(mockSemanticMatches);
      setIsSemantic(true);
    } finally {
      setSemanticLoading(false);
    }
  };

  // Reset search filters
  const resetFilters = () => {
    setSearchTerm('');
    setIsSemantic(false);
    setDisplayedJobs(allJobs);
    toast.success("Filters reset successfully!");
  };

  if (!isAuthenticated || user?.role !== 'candidate') {
    return null;
  }

  if (loading) {
    return (
      <CandidateLayout>
        <div className="min-h-full flex items-center justify-center text-white text-xl">
          Loading available jobs...
        </div>
      </CandidateLayout>
    );
  }

  return (
    <CandidateLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-2 gap-4">
          <div className="flex-1">
            <h1 className="text-4xl font-extrabold text-center mb-2 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Explore Job Openings
            </h1>
            <p className="text-zinc-400 text-center mb-0 text-sm max-w-md mx-auto">
              Search traditionally, or write naturally to let our AI Copilot find matching jobs.
            </p>
          </div>
          <button
            onClick={() => setShowAlertsPanel(v => !v)}
            className="shrink-0 flex items-center gap-2 text-xs font-bold bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 px-4 py-2.5 rounded-xl transition mt-1"
          >
            <Bell className="w-4 h-4" />
            Alerts {alerts.length > 0 && <span className="bg-indigo-500 text-white rounded-full px-1.5 py-0.5 text-[9px] font-mono">{alerts.length}</span>}
          </button>
        </div>

        {/* Job Alerts Panel */}
        <AnimatePresence>
          {showAlertsPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-8"
            >
              <div className="bg-slate-950/60 border border-indigo-500/20 rounded-2xl p-6 space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-400" /> Job Alerts
                  </h3>
                  <button onClick={() => setShowAlertsPanel(false)} className="text-zinc-500 hover:text-white transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Create alert form */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Keywords (e.g. React Developer)"
                    value={alertKeywords}
                    onChange={e => setAlertKeywords(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                  />
                  <input
                    type="text"
                    placeholder="Location (optional)"
                    value={alertLocation}
                    onChange={e => setAlertLocation(e.target.value)}
                    className="w-40 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                  />
                  <button
                    onClick={handleCreateAlert}
                    disabled={savingAlert}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {savingAlert ? 'Saving…' : 'Create Alert'}
                  </button>
                </div>

                {/* Existing alerts list */}
                {alerts.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No alerts yet — create one above to get emailed when new matching jobs appear.</p>
                ) : (
                  <div className="space-y-2">
                    {alerts.map(alert => (
                      <div key={alert.id} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <Bell className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-sm text-zinc-200 font-medium">{alert.keywords}</span>
                          {alert.location && <span className="text-xs text-zinc-500">· {alert.location}</span>}
                        </div>
                        <button onClick={() => handleDeleteAlert(alert.id)} className="text-zinc-600 hover:text-rose-400 transition ml-4 shrink-0">
                          <BellOff className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-zinc-400 text-center mb-8 text-sm max-w-md mx-auto sr-only">
          Search traditionally, or write naturally to let our AI Copilot find matching jobs.
        </p>
        
        {/* Search Control Board */}
        <div className="mb-10 max-w-2xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-4 glass shadow-lg flex flex-col gap-4">
          <div className="flex items-center gap-3 bg-white/5 rounded-xl border border-white/10 px-4 py-2">
            <Search className="w-5 h-5 text-zinc-500 shrink-0" />
            <input
              type="text"
              placeholder="e.g. 'I want a remote React role' or keyword search..."
              className="w-full bg-transparent border-none text-white placeholder-zinc-500 focus:outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSemanticSearch()}
            />
          </div>

          <div className="flex justify-between items-center gap-3 max-sm:flex-col">
            <div className="flex gap-2">
              <button 
                onClick={handleSemanticSearch}
                disabled={semanticLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {semanticLoading ? "Matching..." : "Search with AI Copilot"}
              </button>
              
              {isSemantic && (
                <button 
                  onClick={resetFilters}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              )}
            </div>
            
            <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-mono">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Showing {displayedJobs.length} results {isSemantic && "(Semantic)"}
            </span>
          </div>
        </div>

        {displayedJobs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-2">No jobs matched your query.</p>
            <button onClick={resetFilters} className="text-purple-400 underline text-sm">
              View all listings
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedJobs.map((job, i) => {
              const application = applications.find((a: any) => a.jobId === job.id);
              const STATUS_STYLES: Record<string, string> = {
                Applied:     'bg-blue-500/10 border-blue-500/30 text-blue-300',
                'In Review': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
                Interviewed: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
                Shortlisted: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
                Hired:       'bg-green-500/10 border-green-500/30 text-green-300',
                Rejected:    'bg-red-500/10 border-red-500/30 text-red-300',
              };

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  className={`glass rounded-2xl p-6 shadow-md hover:shadow-purple-500/20 transition-all duration-300 relative border ${
                    application
                      ? 'border-emerald-500/30 shadow-emerald-500/5'
                      : job.matchPercentage && job.matchPercentage > 85 
                        ? 'border-purple-500/40 shadow-purple-500/10' 
                        : 'border-white/10'
                  }`}
                >
                  {/* Applied Badge */}
                  {application && (
                    <div className={`absolute top-4 left-4 border text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider ${STATUS_STYLES[application.status] || STATUS_STYLES['Applied']}`}>
                      <CheckCircle className="w-3.5 h-3.5" />
                      {application.status}
                    </div>
                  )}

                  {/* AI Match Badge */}
                  {job.matchPercentage && (
                    <div className="absolute top-4 right-4 bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold px-2 py-1 rounded-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {job.matchPercentage}% Match
                    </div>
                  )}

                <div className="flex items-center gap-4 mb-4 text-white">
                  <span className="text-3xl p-2 bg-white/5 rounded-xl border border-white/10 shadow-inner">
                    {job.emoji}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold leading-tight line-clamp-1">{job.title}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{job.company}</p>
                  </div>
                </div>

                <div className="text-xs text-zinc-300 flex flex-col gap-2 border-b border-white/5 pb-4 mb-4">
                  <p className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" /> {job.location}
                  </p>
                  <p className="flex items-center gap-1.5 font-medium">
                    <DollarSign className="w-3.5 h-3.5 text-zinc-500" /> {job.salary}
                  </p>
                </div>

                {/* AI Fit Reasoning card */}
                {job.fitReasoning && (
                  <div className="mb-4 bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 text-xs leading-relaxed text-purple-200/90 italic">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-purple-400 block mb-1">
                      AI Match Reasoning
                    </span>
                    "{job.fitReasoning}"
                  </div>
                )}

                <Link
                  href={`/candidate/jobs/${job.id}`}
                  className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition duration-300"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </Link>
              </motion.div>
            );
          })}
          </div>
        )}
      </div>
    </CandidateLayout>
  );
}
