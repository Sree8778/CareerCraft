'use client';

export const dynamic = 'force-dynamic';

// src/app/recruiter/applications/page.tsx
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  RefreshCw, Search, Users, Calendar, ChevronRight,
  CheckSquare, Square, ChevronDown, BarChart2, Sparkles,
  TrendingUp, UserCheck, Clock,
} from 'lucide-react';
import { API_BASE, authHeader, jsonHeaders } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── Config ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Applied:      'bg-blue-500/20   text-blue-300   border-blue-500/30',
  'In Review':  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Interviewed:  'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  Shortlisted:  'bg-cyan-500/20   text-cyan-300   border-cyan-500/30',
  Hired:        'bg-green-500/20  text-green-300  border-green-500/30',
  Rejected:     'bg-red-500/20    text-red-300    border-red-500/30',
};

const PIPELINE_STATUSES = ['Applied', 'In Review', 'Interviewed', 'Shortlisted', 'Hired', 'Rejected'];
const FILTERS           = ['All', ...PIPELINE_STATUSES];

const MATCH_COLOR = (s: number) =>
  s >= 80 ? 'bg-green-500/15 text-green-300 border-green-500/30'
: s >= 55 ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
          : 'bg-red-500/15 text-red-300 border-red-500/30';

const getInitials = (name: string) =>
  (name ?? '').split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || 'U';

const AVATAR_GRADIENTS = [
  'from-purple-600 to-indigo-600',
  'from-pink-600 to-rose-600',
  'from-cyan-600 to-blue-600',
  'from-amber-600 to-orange-600',
  'from-emerald-600 to-teal-600',
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function RecruiterApplicationsPage() {
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();
  const router = useRouter();

  const [applications,    setApplications]    = useState<any[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [selectedFilter,  setSelectedFilter]  = useState('All');
  const [searchQuery,     setSearchQuery]     = useState('');
  const [selected,        setSelected]        = useState<Set<string>>(new Set());
  const [showBulkMenu,    setShowBulkMenu]    = useState(false);
  const [updatingBulk,    setUpdatingBulk]    = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'recruiter') { router.push('/'); return; }
    load();
  }, [isAuthenticated, user, router, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/applications?recruiterId=${user.id}`, {
        headers: await authHeader(getToken),
      });
      const data = await res.json();
      setApplications(data.applications || []);
    } catch { setApplications([]); }
    finally { setLoading(false); }
  }, [user?.id, getToken]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const sorted = [...applications].sort((a, b) => {
    const sa = a.matchScore ?? a.atsScore ?? 0;
    const sb = b.matchScore ?? b.atsScore ?? 0;
    return sb - sa;
  });

  const filtered = sorted
    .filter(a => selectedFilter === 'All' || a.status === selectedFilter)
    .filter(a =>
      !searchQuery ||
      a.candidateName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // ── Stats ──────────────────────────────────────────────────────────────────

  const total        = applications.length;
  const inReview     = applications.filter(a => a.status === 'In Review').length;
  const interviewed  = applications.filter(a => a.status === 'Interviewed').length;
  const hired        = applications.filter(a => a.status === 'Hired').length;

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const toggleSelect = (id: string) =>
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(a => a.id)));
  };

  const applyBulkStatus = async (newStatus: string) => {
    if (!selected.size || !newStatus) return;
    setUpdatingBulk(true);
    setShowBulkMenu(false);
    const ids   = Array.from(selected);
    const token = await getToken();
    try {
      await Promise.all(
        ids.map(id =>
          fetch(`${API_BASE}/applications/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );
      setApplications(prev => prev.map(a => selected.has(a.id) ? { ...a, status: newStatus } : a));
      setSelected(new Set());
      toast.success(`${ids.length} application${ids.length > 1 ? 's' : ''} moved to ${newStatus}`);
    } catch {
      toast.error('Some updates failed — please retry');
    } finally { setUpdatingBulk(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <RecruiterLayout>
      <div className="cc-page mx-auto space-y-6">

        {/* Header */}
        <div className="cc-workspace-header flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
          <div className="relative z-10">
            <p className="cc-eyebrow mb-2">Hiring pipeline</p>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-[var(--cc-text)]">
              <Users className="w-5 h-5 text-purple-400" /> Applicant Pipeline
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">{total} total · sorted by AI match score</p>
          </div>
          <div className="relative z-10 flex w-full items-center gap-2 md:w-auto">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search candidate or role…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full min-w-0 rounded-xl border py-2 pl-9 pr-4 text-sm placeholder:text-muted md:w-60"
              />
            </div>
            <button onClick={load} aria-label="Refresh applications" className="cc-btn-ghost shrink-0 !p-2.5">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        {!loading && total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total',       value: total,       icon: <BarChart2 className="w-4 h-4 text-purple-400" />,  color: 'text-purple-300' },
              { label: 'In Review',   value: inReview,    icon: <Clock className="w-4 h-4 text-yellow-400" />,      color: 'text-yellow-300' },
              { label: 'Interviewed', value: interviewed, icon: <TrendingUp className="w-4 h-4 text-indigo-400" />, color: 'text-indigo-300' },
              { label: 'Hired',       value: hired,       icon: <UserCheck className="w-4 h-4 text-emerald-400" />, color: 'text-emerald-300' },
            ].map(s => (
              <div key={s.label} className="cc-card flex items-center gap-3 rounded-xl p-4">
                {s.icon}
                <div>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-zinc-500 font-semibold">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters + bulk actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button key={f} onClick={() => setSelectedFilter(f)}
                data-active={selectedFilter === f}
                className="cc-filter-chip px-3 py-1.5 text-xs font-semibold">
                {f}
              </button>
            ))}
          </div>

          {/* Bulk action toolbar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-zinc-400 font-semibold">{selected.size} selected</span>
              <div className="relative">
                <button
                  onClick={() => setShowBulkMenu(v => !v)}
                  disabled={updatingBulk}
                  className="cc-btn-primary !rounded-xl !px-3 !py-1.5 text-xs disabled:opacity-50"
                >
                  {updatingBulk ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Move to
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <AnimatePresence>
                  {showBulkMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="cc-card absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-xl shadow-xl"
                    >
                      {PIPELINE_STATUSES.map(s => (
                        <button key={s} onClick={() => applyBulkStatus(s)}
                          className="w-full px-4 py-2.5 text-left text-xs text-muted transition hover:bg-white/5 hover:text-[var(--cc-text)]">
                          {s}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={() => setSelected(new Set())}
                className="text-xs text-zinc-500 hover:text-white transition px-2">
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-zinc-400">
            <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            Loading applications…
          </div>
        ) : filtered.length === 0 ? (
          <div className="cc-empty-state space-y-3 py-20 text-center">
            <Users className="w-10 h-10 mx-auto text-zinc-700" />
            <p className="text-zinc-400 font-semibold">
              {total === 0 ? 'No applications yet.' : 'No results match your filter.'}
            </p>
          </div>
        ) : (
          <>
            {/* Select-all row */}
            <div className="flex items-center gap-3 text-xs text-zinc-500 pb-1">
              <button onClick={toggleAll} className="flex items-center gap-1.5 hover:text-white transition">
                {selected.size === filtered.length
                  ? <CheckSquare className="w-4 h-4 text-purple-400" />
                  : <Square className="w-4 h-4" />}
                {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
              </button>
              <span className="text-zinc-700">·</span>
              <span>{filtered.length} shown</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((app, idx) => {
                const gradientClass = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                const matchScore = app.matchScore ?? app.atsScore;
                const isSelected = selected.has(app.id);
                return (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx, 12) * 0.03 }}
                    className={`cc-card relative flex flex-col gap-3 rounded-2xl p-5 transition group ${
                      isSelected ? 'border-purple-500/50 bg-purple-500/5' : 'border-white/10 hover:border-purple-500/30'
                    }`}
                  >
                    {/* Select checkbox */}
                    <button
                      onClick={e => { e.preventDefault(); toggleSelect(app.id); }}
                      className="absolute top-3 right-3 z-10"
                    >
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-purple-400" />
                        : <Square className="w-4 h-4 text-zinc-600 hover:text-zinc-300 transition" />}
                    </button>

                    {/* Candidate info */}
                    <div className="flex items-center gap-3 pr-6">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-sm font-black text-white shrink-0`}>
                        {app.candidateAvatar
                          ? <img src={app.candidateAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                          : getInitials(app.candidateName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-white truncate">{app.candidateName || 'Applicant'}</p>
                        <p className="text-xs text-zinc-400 truncate">{app.jobTitle}{app.company ? ` · ${app.company}` : ''}</p>
                      </div>
                    </div>

                    {/* Status + match score */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[app.status] ?? 'bg-zinc-700/30 text-zinc-400 border-zinc-600/40'}`}>
                        {app.status}
                      </span>
                      {matchScore !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${MATCH_COLOR(matchScore)}`}>
                          {matchScore}% match
                        </span>
                      )}
                      {idx === 0 && matchScore !== undefined && matchScore >= 80 && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                          <Sparkles className="w-2.5 h-2.5" /> Top pick
                        </span>
                      )}
                    </div>

                    {/* Applied date */}
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <Calendar className="w-3 h-3" />
                      {app.appliedDate || (app.appliedAt
                        ? new Date(app.appliedAt._seconds ? app.appliedAt._seconds * 1000 : app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Recent')}
                    </div>

                    {/* Quick status change */}
                    <div className="flex flex-wrap gap-1 border-t pt-3" style={{ borderColor: 'var(--cc-border)' }}>
                      {PIPELINE_STATUSES.filter(s => s !== app.status).slice(0, 3).map(s => (
                        <button
                          key={s}
                          onClick={async e => {
                            e.preventDefault();
                            try {
                              await fetch(`${API_BASE}/applications/${app.id}/status`, {
                                method: 'POST',
                                headers: await jsonHeaders(getToken),
                                body: JSON.stringify({ status: s }),
                              });
                              setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: s } : a));
                              toast.success(`Moved to ${s}`);
                            } catch { toast.error('Failed to update'); }
                          }}
                          className="rounded-full border border-[var(--cc-border)] px-2 py-0.5 text-[9px] font-bold text-muted transition hover:border-[var(--cc-accent)]/45 hover:text-[var(--cc-text)]"
                        >
                          → {s}
                        </button>
                      ))}
                    </div>

                    {/* Review link */}
                    <Link href={`/recruiter/applications/${app.id}`}
                      className="flex items-center justify-end gap-1 pt-1 text-xs text-[var(--cc-accent)] transition group-hover:text-[var(--cc-accent-2)]">
                      Review <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </RecruiterLayout>
  );
}
