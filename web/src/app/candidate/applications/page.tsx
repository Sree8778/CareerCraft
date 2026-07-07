'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { API_BASE, authHeader, jsonHeaders } from '@/lib/api';
import {
  Briefcase, Calendar, ExternalLink, Search, FileText,
  Send, Eye, Mic, Star, X, TrendingUp, BarChart2,
  RefreshCw, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  status: KanbanStatus;
  appliedDate: string;
  jobId?: string;
  jobUrl?: string;
  source?: string;
  coverLetter?: string;
}

type KanbanStatus = 'Applied' | 'In Review' | 'Interview' | 'Offer' | 'Rejected';

// ── Column config ──────────────────────────────────────────────────────────

interface ColumnDef {
  id: KanbanStatus;
  label: string;
  iconEl: ReactNode;
  ring: string;
  badge: string;
  cardBorder: string;
  dot: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'Applied',
    label: 'Applied',
    iconEl: <Send className="w-3.5 h-3.5" />,
    ring: 'border-blue-500/30',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    cardBorder: 'border-blue-500/20 hover:border-blue-400/40',
    dot: 'bg-blue-400',
  },
  {
    id: 'In Review',
    label: 'In Review',
    iconEl: <Eye className="w-3.5 h-3.5" />,
    ring: 'border-yellow-500/30',
    badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    cardBorder: 'border-yellow-500/20 hover:border-yellow-400/40',
    dot: 'bg-yellow-400',
  },
  {
    id: 'Interview',
    label: 'Interview',
    iconEl: <Mic className="w-3.5 h-3.5" />,
    ring: 'border-indigo-500/30',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    cardBorder: 'border-indigo-500/20 hover:border-indigo-400/40',
    dot: 'bg-indigo-400',
  },
  {
    id: 'Offer',
    label: 'Offer',
    iconEl: <Star className="w-3.5 h-3.5" />,
    ring: 'border-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    cardBorder: 'border-emerald-500/20 hover:border-emerald-400/40',
    dot: 'bg-emerald-400',
  },
  {
    id: 'Rejected',
    label: 'Rejected',
    iconEl: <X className="w-3.5 h-3.5" />,
    ring: 'border-red-500/30',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    cardBorder: 'border-red-500/20 hover:border-red-400/40',
    dot: 'bg-red-400',
  },
];

// ── Normalization helpers ──────────────────────────────────────────────────

function normalizeStatus(raw: string): KanbanStatus {
  const s = (raw ?? '').toLowerCase().replace(/_/g, ' ');
  if (s === 'in review' || s === 'reviewing') return 'In Review';
  if (s === 'interviewed' || s === 'interview' || s === 'interview scheduled' || s === 'shortlisted') return 'Interview';
  if (s === 'hired' || s === 'offer' || s === 'accepted') return 'Offer';
  if (s === 'rejected' || s === 'failed' || s === 'not selected') return 'Rejected';
  return 'Applied';
}

function formatDate(appliedAt: any): string {
  if (!appliedAt) return '';
  try {
    const ms = appliedAt._seconds
      ? appliedAt._seconds * 1000
      : Date.parse(appliedAt);
    if (isNaN(ms)) return '';
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function normalizeApp(raw: any): Application {
  return {
    id: raw.id,
    jobTitle: raw.jobTitle || raw.title || 'Untitled Role',
    company: raw.company || '',
    status: normalizeStatus(raw.status),
    appliedDate: raw.appliedDate || formatDate(raw.appliedAt),
    jobId: raw.jobId,
    jobUrl: raw.jobUrl || raw.url || '',
    source: raw.source || '',
    coverLetter: raw.coverLetter || raw.cover_letter || '',
  };
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CandidateApplicationsPage() {
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Drag state
  const draggingId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<KanbanStatus | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'candidate') { router.push('/'); return; }
    load();
  }, [isAuthenticated, user, router, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/applications?candidateId=${user.id}`, {
        headers: await authHeader(getToken),
      });
      if (res.ok) {
        const data = await res.json();
        setApplications((data.applications || []).map(normalizeApp));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [user?.id, getToken]);

  // ── Status update ────────────────────────────────────────────────────────

  const updateStatus = useCallback(async (appId: string, newStatus: KanbanStatus) => {
    setApplications(prev =>
      prev.map(a => a.id === appId ? { ...a, status: newStatus } : a)
    );
    try {
      const res = await fetch(`${API_BASE}/applications/${appId}/status`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error('Failed to update status');
      load();
    }
  }, [getToken, load]);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const onDragStart = (id: string) => { draggingId.current = id; };
  const onDragOver  = (e: React.DragEvent, col: KanbanStatus) => { e.preventDefault(); setDragOver(col); };
  const onDrop      = (col: KanbanStatus) => {
    const id = draggingId.current;
    if (id) updateStatus(id, col);
    draggingId.current = null;
    setDragOver(null);
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const filtered = search
    ? applications.filter(a =>
        a.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
        a.company.toLowerCase().includes(search.toLowerCase())
      )
    : applications;

  const byCol = (col: KanbanStatus) => filtered.filter(a => a.status === col);
  const total = applications.length;
  const responded = applications.filter(a => ['In Review', 'Interview', 'Offer'].includes(a.status)).length;
  const interviewed = applications.filter(a => ['Interview', 'Offer'].includes(a.status)).length;
  const offered = applications.filter(a => a.status === 'Offer').length;

  const pct = (n: number) => total === 0 ? 0 : Math.round((n / total) * 100);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CandidateLayout>
      <div className="space-y-6 text-white">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-400" /> Application Tracker
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">{total} applications · drag cards to update status</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
              />
            </div>
            <button
              onClick={load}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {!loading && total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total',          value: total,        sub: 'applications', icon: <BarChart2 className="w-4 h-4 text-indigo-400" />,  color: 'text-indigo-300' },
              { label: 'Response Rate',  value: `${pct(responded)}%`, sub: `${responded} replied`,  icon: <TrendingUp className="w-4 h-4 text-yellow-400" />, color: 'text-yellow-300' },
              { label: 'Interview Rate', value: `${pct(interviewed)}%`, sub: `${interviewed} interviews`, icon: <Mic className="w-4 h-4 text-indigo-400" />, color: 'text-indigo-300' },
              { label: 'Offer Rate',     value: `${pct(offered)}%`,  sub: `${offered} offers`,   icon: <Star className="w-4 h-4 text-emerald-400" />, color: 'text-emerald-300' },
            ].map(stat => (
              <div key={stat.label} className="glass rounded-xl p-4 border border-white/10 flex items-start gap-3">
                <div className="mt-0.5">{stat.icon}</div>
                <div>
                  <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                  <p className="text-[11px] text-zinc-400 font-semibold">{stat.label}</p>
                  <p className="text-[10px] text-zinc-600">{stat.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty / loading */}
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-zinc-400">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            Loading your applications…
          </div>
        ) : total === 0 ? (
          <div className="text-center py-32 space-y-4">
            <FileText className="w-12 h-12 mx-auto text-zinc-700" />
            <p className="text-zinc-400 font-semibold">No applications yet.</p>
            <Link href="/candidate/smart-apply"
              className="inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition">
              Start Smart Apply
            </Link>
          </div>
        ) : (

          /* ── Kanban board ─────────────────────────────────────────────── */
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
            {COLUMNS.map(col => {
              const cards = byCol(col.id);
              const isOver = dragOver === col.id;
              return (
                <div
                  key={col.id}
                  onDragOver={e => onDragOver(e, col.id)}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={() => onDrop(col.id)}
                  className={`rounded-2xl border transition-all duration-150 min-h-[200px] ${
                    isOver
                      ? `${col.ring} bg-white/5 scale-[1.01] shadow-lg`
                      : 'border-white/8 bg-white/[0.02]'
                  }`}
                >
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2.5 border-b ${isOver ? col.ring : 'border-white/8'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${col.badge}`}>
                        {col.iconEl}
                        {col.label}
                      </span>
                    </div>
                    <span className={`text-xs font-mono font-bold rounded-full w-5 h-5 flex items-center justify-center ${col.badge}`}>
                      {cards.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="p-2 space-y-2">
                    <AnimatePresence>
                      {cards.length === 0 && (
                        <div className="text-center py-8 text-zinc-700 text-xs">
                          {isOver ? 'Drop here' : 'Empty'}
                        </div>
                      )}
                      {cards.map(app => (
                        <KanbanCard
                          key={app.id}
                          app={app}
                          col={col}
                          expanded={expandedCard === app.id}
                          onToggle={() => setExpandedCard(prev => prev === app.id ? null : app.id)}
                          onDragStart={() => onDragStart(app.id)}
                          onMoveTo={updateStatus}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CandidateLayout>
  );
}

// ── KanbanCard ─────────────────────────────────────────────────────────────

interface KanbanCardProps {
  app: Application;
  col: ColumnDef;
  expanded: boolean;
  onToggle: () => void;
  onDragStart: () => void;
  onMoveTo: (id: string, status: KanbanStatus) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  smart_apply_autonomous: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  smart_apply:            'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  supervised:             'bg-sky-500/15    text-sky-300    border-sky-500/25',
};

function KanbanCard({ app, col, expanded, onToggle, onDragStart, onMoveTo }: KanbanCardProps) {
  const sourceLabel = app.source?.includes('autonomous') ? 'Auto' : app.source ? 'Manual' : '';
  const sourceColor = SOURCE_COLORS[app.source ?? ''] ?? 'bg-white/5 text-zinc-400 border-white/10';

  const otherCols = COLUMNS.filter(c => c.id !== col.id);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={onDragStart}
      className={`rounded-xl border bg-white/[0.03] p-3 cursor-grab active:cursor-grabbing transition-all ${col.cardBorder}`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white leading-snug truncate">{app.jobTitle}</p>
          <p className="text-[11px] text-zinc-400 truncate mt-0.5">{app.company}</p>
        </div>
        <button
          onClick={onToggle}
          className="shrink-0 text-zinc-600 hover:text-zinc-300 transition mt-0.5"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {app.appliedDate && (
          <span className="flex items-center gap-0.5 text-[9px] text-zinc-500 font-mono">
            <Calendar className="w-2.5 h-2.5" /> {app.appliedDate}
          </span>
        )}
        {sourceLabel && (
          <span className={`text-[9px] font-bold border px-1.5 py-0.5 rounded-full ${sourceColor}`}>
            {sourceLabel}
          </span>
        )}
        {app.jobUrl && (
          <a
            href={app.jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[9px] text-indigo-400 hover:text-indigo-300 transition ml-auto"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-2.5 h-2.5" /> View
          </a>
        )}
      </div>

      {/* Expanded: cover letter snippet + move-to buttons */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {app.coverLetter && (
              <p className="text-[10px] text-zinc-500 mt-2 line-clamp-3 leading-relaxed border-t border-white/5 pt-2">
                {app.coverLetter}
              </p>
            )}
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-[9px] text-zinc-600 mb-1 font-bold uppercase tracking-wider">Move to</p>
              <div className="flex flex-wrap gap-1">
                {otherCols.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onMoveTo(app.id, c.id)}
                    className={`text-[9px] font-bold border px-2 py-0.5 rounded-full transition hover:opacity-80 ${c.badge}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
