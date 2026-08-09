'use client';

export const dynamic = 'force-dynamic';

// src/app/candidate/jobs/page.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, DollarSign, Sparkles, Search, SlidersHorizontal, Eye, RotateCcw, CheckCircle, Bell, BellOff, X, Plus, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Job } from '@/lib/mockJobApi';
import { toast } from 'sonner';
import { decryptApiKey } from '@/lib/crypto';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { API_BASE, authHeader, jsonHeaders } from '@/lib/api';

const JOBS_PER_PAGE = 9;

function buildSalaryLabel(job: any): string {
  if (job.salaryVisible === false) return 'Competitive';
  const min = Number(job.salaryMin || 0);
  const max = Number(job.salaryMax || 0);
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (min) return `$${min.toLocaleString()}+`;
  if (max) return `Up to $${max.toLocaleString()}`;
  return job.salary || 'Competitive';
}

type DateFilter = 'any' | 'today' | 'week' | 'month';
type SortOrder  = 'newest' | 'oldest';

function daysSince(dateStr: string): number {
  if (!dateStr) return 9999;
  const posted = new Date(dateStr);
  const now    = new Date();
  return Math.floor((now.getTime() - posted.getTime()) / 86_400_000);
}

export default function JobListingsPage() {
  const { isAuthenticated, user, getToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm]   = useState('');
  const [allJobs, setAllJobs]         = useState<Job[]>([]);
  // semantic results override allJobs when AI search is active
  const [semanticJobs, setSemanticJobs] = useState<any[] | null>(null);
  const [loading, setLoading]         = useState(true);

  // AI Search
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [applications, setApplications]       = useState<any[]>([]);

  // Filters & sort
  const [dateFilter, setDateFilter] = useState<DateFilter>('any');
  const [sortOrder,  setSortOrder]  = useState<SortOrder>('newest');
  const [page,       setPage]       = useState(1);

  // Job alerts
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [alerts,          setAlerts]          = useState<any[]>([]);
  const [alertKeywords,   setAlertKeywords]   = useState('');
  const [alertLocation,   setAlertLocation]   = useState('');
  const [savingAlert,     setSavingAlert]      = useState(false);

  const fetchAlerts = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/job-alerts`, { headers: await authHeader(getToken) });
      if (res.ok) setAlerts((await res.json()).alerts ?? []);
    } catch { /* silent */ }
  };

  const handleCreateAlert = async () => {
    if (!alertKeywords.trim()) { toast.error('Enter keywords for the alert'); return; }
    setSavingAlert(true);
    try {
      const res = await fetch(`${API_BASE}/job-alerts`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
        body: JSON.stringify({ keywords: alertKeywords, location: alertLocation }),
      });
      if (!res.ok) throw new Error();
      toast.success("Job alert created! You'll be emailed when new matches appear.");
      setAlertKeywords(''); setAlertLocation('');
      fetchAlerts();
    } catch { toast.error('Failed to create alert'); }
    finally { setSavingAlert(false); }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await fetch(`${API_BASE}/job-alerts/${id}`, { method: 'DELETE', headers: await authHeader(getToken) });
      setAlerts(prev => prev.filter(a => a.id !== id));
      toast.success('Alert removed');
    } catch { toast.error('Failed to remove alert'); }
  };

  useEffect(() => { fetchAlerts(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'candidate') { router.push('/'); return; }

    const fetchJobs = async () => {
      setLoading(true);
      try {
        const [jobsRes, appsRes] = await Promise.all([
          fetch(`${API_BASE}/jobs`, { headers: { 'Authorization': `Bearer ${await getToken()}` } }),
          fetch(`${API_BASE}/applications?candidateId=${user.id}`, { headers: { 'Authorization': `Bearer ${await getToken()}` } }),
        ]);
        const jobsData = await jobsRes.json();
        const appsData = await appsRes.json();

        const normalized: Job[] = (jobsData.jobs || []).map((job: any) => ({
          id:             job.id,
          title:          job.title || 'Untitled',
          company:        job.company || 'Company',
          location:       job.location || 'Remote',
          salary:         buildSalaryLabel(job),
          description:    job.description || '',
          requirements:   job.requirements || [],
          benefits:       job.benefits || [],
          postedDate:     job.postedDate || new Date().toISOString().split('T')[0],
          employmentType: job.jobType || job.employmentType || 'Full-time',
          emoji:          job.emoji || '💼',
        }));
        setAllJobs(normalized);
        setApplications(appsData.applications || []);
      } catch (err) {
        console.error('Failed to fetch jobs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, [isAuthenticated, user, router, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── derived / filtered / sorted / paginated ────────────────────────────────
  const baseJobs = semanticJobs ?? allJobs;

  const processedJobs = useMemo(() => {
    // 1. keyword filter (skip when semantic results are active)
    let jobs = semanticJobs
      ? semanticJobs
      : allJobs.filter(j => {
          const q = searchTerm.toLowerCase();
          return !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.location.toLowerCase().includes(q);
        });

    // 2. date filter
    if (dateFilter !== 'any') {
      const maxDays = dateFilter === 'today' ? 1 : dateFilter === 'week' ? 7 : 30;
      jobs = jobs.filter(j => daysSince(j.postedDate) < maxDays);
    }

    // 3. sort (newest/oldest by postedDate)
    jobs = [...jobs].sort((a, b) => {
      const da = a.postedDate ?? '';
      const db = b.postedDate ?? '';
      return sortOrder === 'newest' ? db.localeCompare(da) : da.localeCompare(db);
    });

    return jobs;
  }, [allJobs, semanticJobs, searchTerm, dateFilter, sortOrder]);

  const totalPages   = Math.max(1, Math.ceil(processedJobs.length / JOBS_PER_PAGE));
  const safePage     = Math.min(page, totalPages);
  const pagedJobs    = processedJobs.slice((safePage - 1) * JOBS_PER_PAGE, safePage * JOBS_PER_PAGE);

  // Reset to page 1 whenever the filtered set changes
  useEffect(() => { setPage(1); }, [searchTerm, dateFilter, sortOrder, semanticJobs]);

  // ── AI semantic search ─────────────────────────────────────────────────────
  const handleSemanticSearch = async () => {
    if (!searchTerm.trim()) { toast.info('Enter a query for the AI to analyse.'); return; }
    setSemanticLoading(true);
    const toastId = toast.loading('AI Copilot is semantically matching jobs…');
    try {
      let customKey = '';
      if (typeof window !== 'undefined' && user?.id) {
        const enc = localStorage.getItem('user_gemini_api_key') || '';
        if (enc) customKey = await decryptApiKey(enc, user.id);
      }
      const res = await fetch(`${API_BASE}/jobs/search-semantic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}`, 'X-Gemini-API-Key': customKey },
        body: JSON.stringify({ query: searchTerm, jobs: allJobs }),
      });
      if (!res.ok) throw new Error('Semantic search failed');
      const results = await res.json();
      if (Array.isArray(results) && results.length > 0) {
        setSemanticJobs(results);
        toast.success(`Matched ${results.length} jobs semantically!`, { id: toastId });
      } else {
        toast.info('No semantic matches found — try rephrasing.', { id: toastId });
      }
    } catch {
      toast.error('AI search unavailable — showing keyword results.', { id: toastId });
      setSemanticJobs(null);
    } finally {
      setSemanticLoading(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSemanticJobs(null);
    setDateFilter('any');
    setSortOrder('newest');
    setPage(1);
  };

  if (authLoading || !isAuthenticated || user?.role !== 'candidate') return null;

  if (loading) {
    return (
      <CandidateLayout>
        <div className="min-h-full flex items-center justify-center text-white text-xl">
          Loading available jobs…
        </div>
      </CandidateLayout>
    );
  }

  const DATE_FILTER_LABELS: Record<DateFilter, string> = {
    any:   'Any time',
    today: 'Today',
    week:  'This week',
    month: 'This month',
  };

  return (
    <CandidateLayout>
      <div className="cc-page max-w-6xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-2 gap-4">
          <div className="flex-1">
            <h1 className="text-4xl font-extrabold text-center mb-2 bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Explore Job Openings
            </h1>
            <p className="text-zinc-400 text-center text-sm max-w-md mx-auto">
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

        {/* ── Job Alerts Panel ── */}
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
                <div className="flex flex-col sm:flex-row gap-3">
                  <input type="text" placeholder="Keywords (e.g. React Developer)" value={alertKeywords}
                    onChange={e => setAlertKeywords(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50" />
                  <input type="text" placeholder="Location (optional)" value={alertLocation}
                    onChange={e => setAlertLocation(e.target.value)}
                    className="w-40 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50" />
                  <button onClick={handleCreateAlert} disabled={savingAlert}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shrink-0">
                    <Plus className="w-3.5 h-3.5" />{savingAlert ? 'Saving…' : 'Create Alert'}
                  </button>
                </div>
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

        {/* ── Search & Filters ── */}
        <div className="mb-8 max-w-2xl mx-auto space-y-3">
          {/* Search row */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 glass shadow-lg flex flex-col gap-4">
            <div className="flex items-center gap-3 bg-white/5 rounded-xl border border-white/10 px-4 py-2">
              <Search className="w-5 h-5 text-zinc-500 shrink-0" />
              <input
                type="text"
                placeholder="e.g. 'I want a remote React role' or keyword search…"
                className="w-full bg-transparent border-none text-white placeholder-zinc-500 focus:outline-none text-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSemanticSearch()}
              />
            </div>

            <div className="flex justify-between items-center gap-3 max-sm:flex-col">
              <div className="flex gap-2">
                <button onClick={handleSemanticSearch} disabled={semanticLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition">
                  <Sparkles className="w-3.5 h-3.5" />
                  {semanticLoading ? 'Matching…' : 'AI Copilot'}
                </button>
                {(semanticJobs || searchTerm || dateFilter !== 'any' || sortOrder !== 'newest') && (
                  <button onClick={resetFilters}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition">
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                )}
              </div>
              <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-mono">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {processedJobs.length} job{processedJobs.length !== 1 ? 's' : ''}{semanticJobs ? ' (AI)' : ''}
              </span>
            </div>
          </div>

          {/* Date filter + sort row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Date chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {(['any', 'today', 'week', 'month'] as DateFilter[]).map(f => (
                <button key={f} onClick={() => setDateFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    dateFilter === f
                      ? 'bg-purple-600/30 border-purple-500/60 text-purple-200'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}>
                  {DATE_FILTER_LABELS[f]}
                </button>
              ))}
            </div>

            {/* Sort toggle */}
            <button
              onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full transition"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
            </button>
          </div>
        </div>

        {/* ── Grid ── */}
        {pagedJobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-400 text-lg mb-3">No jobs matched your filters.</p>
            <button onClick={resetFilters} className="text-purple-400 underline text-sm">Clear filters</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pagedJobs.map((job, i) => {
                const application = applications.find((a: any) => a.jobId === job.id);
                const STATUS_STYLES: Record<string, string> = {
                  Applied:     'bg-blue-500/10 border-blue-500/30 text-blue-300',
                  'In Review': 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
                  Interviewed: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
                  Shortlisted: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
                  Hired:       'bg-green-500/10 border-green-500/30 text-green-300',
                  Rejected:    'bg-red-500/10 border-red-500/30 text-red-300',
                };
                const daysAgo = daysSince(job.postedDate);
                const postedLabel = daysAgo === 0 ? 'Today'
                  : daysAgo === 1 ? 'Yesterday'
                  : daysAgo < 7  ? `${daysAgo}d ago`
                  : daysAgo < 30 ? `${Math.floor(daysAgo / 7)}w ago`
                  : `${Math.floor(daysAgo / 30)}mo ago`;

                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    whileHover={{ scale: 1.02 }}
                    className={`glass rounded-2xl p-6 shadow-md hover:shadow-purple-500/20 transition-all duration-300 relative border ${
                      application
                        ? 'border-emerald-500/30 shadow-emerald-500/5'
                        : job.matchPercentage && job.matchPercentage > 85
                          ? 'border-purple-500/40 shadow-purple-500/10'
                          : 'border-white/10'
                    }`}
                  >
                    {/* Applied badge */}
                    {application && (
                      <div className={`absolute top-4 left-4 border text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider ${STATUS_STYLES[application.status] || STATUS_STYLES['Applied']}`}>
                        <CheckCircle className="w-3.5 h-3.5" />{application.status}
                      </div>
                    )}

                    {/* AI match badge */}
                    {job.matchPercentage && (
                      <div className="absolute top-4 right-4 bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold px-2 py-1 rounded-md flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />{job.matchPercentage}%
                      </div>
                    )}

                    <div className="flex items-center gap-4 mb-4 text-white">
                      <span className="text-3xl p-2 bg-white/5 rounded-xl border border-white/10 shadow-inner">{job.emoji}</span>
                      <div className="min-w-0">
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

                    {/* Posted date label */}
                    <p className="text-[10px] text-zinc-600 mb-3 font-mono">{postedLabel}</p>

                    {/* AI reasoning */}
                    {job.fitReasoning && (
                      <div className="mb-4 bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 text-xs leading-relaxed text-purple-200/90 italic">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-purple-400 block mb-1">AI Match Reasoning</span>
                        "{job.fitReasoning}"
                      </div>
                    )}

                    <Link href={`/candidate/jobs/${job.id}`}
                      className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition duration-300">
                      <Eye className="w-4 h-4" /> View Details
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                    const isActive = p === safePage;
                    // Show first, last, current ±1, and ellipses
                    const show = p === 1 || p === totalPages || Math.abs(p - safePage) <= 1;
                    const showEllipsisBefore = p === safePage - 2 && safePage > 3;
                    const showEllipsisAfter  = p === safePage + 2 && safePage < totalPages - 2;
                    if (showEllipsisBefore || showEllipsisAfter) {
                      return <span key={p} className="px-1 text-zinc-600 text-sm">…</span>;
                    }
                    if (!show) return null;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-9 h-9 rounded-lg text-sm font-bold border transition ${
                          isActive
                            ? 'bg-purple-600 border-purple-500 text-white'
                            : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}>
                        {p}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border border-white/10 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Page info */}
            <p className="text-center text-xs text-zinc-600 mt-3 font-mono">
              Page {safePage} of {totalPages} · {processedJobs.length} total job{processedJobs.length !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>
    </CandidateLayout>
  );
}
