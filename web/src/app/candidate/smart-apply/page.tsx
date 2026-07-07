'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { API_BASE, authHeader, jsonHeaders } from '@/lib/api';
import { doc, getDoc, updateDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Zap, Search, MapPin, DollarSign, ExternalLink, Plus, Trash2,
  Play, Square, CheckCircle, XCircle, Clock, Loader2, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle, BookOpen, Bot, User,
  Building2, Tag, Globe, Briefcase, LayoutList, Cpu, FileText, Star, X, UploadCloud,
} from 'lucide-react';

interface ScrapedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  url: string;
  source: 'remoteok' | 'indeed' | 'linkedin' | string;
  tags: string[];
  logo: string;
  scraped_at: string;
  query?: string;
}

interface ApplyProgress {
  job_id: string;
  title: string;
  company: string;
  status: 'applied' | 'failed';
  applied_at?: string;
}

type ApplyMode = 'supervised' | 'autonomous';

interface ResumeVersion {
  id: string;
  name: string;
  savedAt?: string;
  resumeData: Record<string, any>;
  isDefault?: boolean;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  arbeitnow: { label: 'Arbeitnow', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  jobicy:    { label: 'Jobicy',    color: 'bg-violet-500/20 text-violet-400 border-violet-500/30'   },
  remoteok:  { label: 'RemoteOK', color: 'bg-green-500/20  text-green-400  border-green-500/30'    },
  indeed:    { label: 'Indeed',   color: 'bg-blue-500/20   text-blue-400   border-blue-500/30'     },
  linkedin:  { label: 'LinkedIn', color: 'bg-sky-500/20    text-sky-400    border-sky-500/30'      },
};

export default function SmartApplyPage() {
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();
  const router = useRouter();

  // ── Search state ──────────────────────────────────────────────────────────
  const [roles,     setRoles]     = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState('');
  const [location,  setLocation]  = useState('Remote');
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [sources,   setSources]   = useState<string[]>(['arbeitnow', 'jobicy', 'remoteok', 'indeed', 'linkedin']);
  const [searching, setSearching] = useState(false);
  const [jobs,      setJobs]      = useState<ScrapedJob[]>([]);
  const [wasCached, setWasCached] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // ── Queue state ───────────────────────────────────────────────────────────
  const [queue,        setQueue]        = useState<ScrapedJob[]>([]);
  const [appliedToday, setAppliedToday] = useState(0);
  const [appliedJobs,  setAppliedJobs]  = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // ── Apply mode state ──────────────────────────────────────────────────────
  const [applyMode,  setApplyMode]  = useState<ApplyMode>('supervised');
  const [autoRunning, setAutoRunning] = useState(false);
  const [progress,    setProgress]    = useState<ApplyProgress[]>([]);

  // ── Supervised apply state ────────────────────────────────────────────────
  const [supervisedJob,   setSupervisedJob]   = useState<ScrapedJob | null>(null);
  const [coverLetter,     setCoverLetter]     = useState('');
  const [coverLoading,    setCoverLoading]    = useState(false);
  const [applyingJobId,   setApplyingJobId]   = useState<string | null>(null);

  // ── Resume selection ──────────────────────────────────────────────────────
  const [resumes,           setResumes]           = useState<ResumeVersion[]>([]);
  const [selectedResumeId,  setSelectedResumeId]  = useState<string>('main');
  const [showResumePicker,  setShowResumePicker]  = useState(false);
  const [uploadingResume,   setUploadingResume]   = useState(false);
  const resumeUploadRef = useRef<HTMLInputElement>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const DAILY_CAP = 20;

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'candidate') router.push('/');
  }, [authLoading, isAuthenticated, user, router]);

  // ── Load queue on mount ───────────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/smart-apply/queue`, {
        headers: await authHeader(getToken),
      });
      if (res.ok) {
        const d = await res.json();
        setQueue(d.queue ?? []);
        setAppliedToday(d.applied_today ?? 0);
        setAppliedJobs(d.applied_jobs ?? []);
        setAutoRunning(d.autonomous_running ?? false);
      }
    } catch { /* silent */ }
  }, [user?.id, getToken]);

  // ── Resume versions ───────────────────────────────────────────────────────
  const fetchResumes = useCallback(async () => {
    if (!user?.id) return;
    try {
      const snap = await getDoc(doc(db, 'resumes', user.id));
      if (!snap.exists()) return;
      const data = snap.data();
      const resumeName = data.resumeData?.personal?.name
        ? `${data.resumeData.personal.name}'s Resume`
        : 'My Resume';
      const main: ResumeVersion = { id: 'main', name: resumeName, resumeData: data.resumeData ?? {} };
      const versions: ResumeVersion[] = (data.savedVersions ?? []).map((v: any) => ({
        id: v.id, name: v.name, savedAt: v.savedAt, resumeData: v.resumeData ?? {},
      }));
      setResumes([main, ...versions]);
      const defaultId = data.defaultSmartApplyResumeId ?? 'main';
      setSelectedResumeId(prev => prev === 'main' ? defaultId : prev);
    } catch { /* silent */ }
  }, [user?.id]);

  const saveDefaultResume = async (resumeId: string) => {
    if (!user?.id) return;
    try {
      await updateDoc(doc(db, 'resumes', user.id), { defaultSmartApplyResumeId: resumeId });
      toast.success('Default resume updated for Smart Apply');
    } catch { toast.error('Failed to save default'); }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploadingResume(true);
    const toastId = 'resume-upload';
    toast.loading('Uploading resume…', { id: toastId });
    try {
      // 1. Upload to Firebase Storage
      const storageRef = ref(storage, `resumes/${user.id}/uploads/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      // 2. Try to parse via backend
      const formData = new FormData();
      formData.append('file', file);
      let parsedData: Record<string, any> = {};
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/parse-resume`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          const json = await res.json();
          parsedData = json.parsedData ?? {};
        }
      } catch { /* parsing optional */ }

      // 3. Save as a resume version in Firestore
      const newVersion = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ''),
        savedAt: new Date().toISOString(),
        fileUrl: downloadUrl,
        resumeData: parsedData,
      };
      await setDoc(doc(db, 'resumes', user.id), { savedVersions: arrayUnion(newVersion) }, { merge: true });

      // 4. Add to local state and select it
      const entry: ResumeVersion = { id: newVersion.id, name: newVersion.name, savedAt: newVersion.savedAt, resumeData: parsedData };
      setResumes(prev => [...prev, entry]);
      setSelectedResumeId(newVersion.id);
      setShowResumePicker(false);
      toast.success(`"${newVersion.name}" uploaded and selected`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed', { id: toastId });
    } finally {
      setUploadingResume(false);
      e.target.value = '';
    }
  };

  const getSelectedResumeData = () => {
    return resumes.find(r => r.id === selectedResumeId)?.resumeData
      ?? resumes[0]?.resumeData
      ?? {};
  };

  // ── Poll status during autonomous run ────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${API_BASE}/smart-apply/status`, {
        headers: await authHeader(getToken),
      });
      if (res.ok) {
        const d = await res.json();
        setAutoRunning(d.autonomous_running ?? false);
        setAppliedToday(d.applied_today ?? 0);
        setProgress(d.progress ?? []);
        if (!d.autonomous_running) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          fetchQueue();
          toast.success('Autonomous apply session complete!');
        }
      }
    } catch { /* silent */ }
  }, [user?.id, getToken, fetchQueue]);

  useEffect(() => {
    if (user?.id) { fetchQueue(); fetchResumes(); }
  }, [user?.id, fetchQueue, fetchResumes]);

  useEffect(() => {
    if (autoRunning && !pollRef.current) {
      pollRef.current = setInterval(fetchStatus, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [autoRunning, fetchStatus]);

  // ── Role tag helpers ──────────────────────────────────────────────────────
  const addRole = (raw: string) => {
    const trimmed = raw.trim().replace(/,+$/, '');
    if (trimmed && !roles.includes(trimmed)) setRoles(r => [...r, trimmed]);
    setRoleInput('');
  };

  const removeRole = (i: number) => setRoles(r => r.filter((_, idx) => idx !== i));

  const handleRoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && roleInput.trim()) {
      e.preventDefault();
      addRole(roleInput);
    } else if (e.key === 'Backspace' && !roleInput && roles.length > 0) {
      removeRole(roles.length - 1);
    }
  };

  // ── Location suggestions ──────────────────────────────────────────────────
  const LOCATION_SUGGESTIONS = [
    // Remote options
    'Remote', 'Remote (Worldwide)', 'Remote (US Only)', 'Remote (EU Only)',
    // United States
    'New York, NY', 'San Francisco, CA', 'Los Angeles, CA', 'Chicago, IL',
    'Austin, TX', 'Seattle, WA', 'Boston, MA', 'Denver, CO', 'Atlanta, GA',
    'Miami, FL', 'Dallas, TX', 'Houston, TX', 'Phoenix, AZ', 'Portland, OR',
    'Minneapolis, MN', 'San Diego, CA', 'Washington, DC', 'Raleigh, NC',
    'Nashville, TN', 'Detroit, MI', 'Columbus, OH', 'Salt Lake City, UT',
    'Las Vegas, NV', 'Charlotte, NC', 'Pittsburgh, PA', 'Philadelphia, PA',
    // Canada
    'Toronto, Canada', 'Vancouver, Canada', 'Montreal, Canada', 'Calgary, Canada', 'Ottawa, Canada',
    // UK & Ireland
    'London, UK', 'Manchester, UK', 'Edinburgh, UK', 'Birmingham, UK', 'Dublin, Ireland',
    // Europe — West
    'Berlin, Germany', 'Munich, Germany', 'Hamburg, Germany', 'Frankfurt, Germany',
    'Amsterdam, Netherlands', 'Paris, France', 'Madrid, Spain', 'Barcelona, Spain',
    'Zurich, Switzerland', 'Vienna, Austria', 'Brussels, Belgium',
    'Lisbon, Portugal', 'Rome, Italy', 'Milan, Italy',
    // Europe — North & East
    'Stockholm, Sweden', 'Oslo, Norway', 'Copenhagen, Denmark', 'Helsinki, Finland',
    'Warsaw, Poland', 'Prague, Czech Republic', 'Budapest, Hungary', 'Bucharest, Romania',
    // Asia — South
    'Bangalore, India', 'Mumbai, India', 'Delhi, India', 'Hyderabad, India',
    'Pune, India', 'Chennai, India', 'Kolkata, India',
    // Asia — Southeast
    'Singapore', 'Kuala Lumpur, Malaysia', 'Bangkok, Thailand', 'Jakarta, Indonesia',
    'Ho Chi Minh City, Vietnam', 'Manila, Philippines',
    // Asia — East
    'Tokyo, Japan', 'Seoul, South Korea', 'Beijing, China', 'Shanghai, China',
    'Shenzhen, China', 'Hong Kong', 'Taipei, Taiwan',
    // Australia & NZ
    'Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia',
    'Perth, Australia', 'Auckland, New Zealand',
    // Middle East
    'Dubai, UAE', 'Abu Dhabi, UAE', 'Tel Aviv, Israel', 'Riyadh, Saudi Arabia', 'Doha, Qatar',
    // South America
    'São Paulo, Brazil', 'Buenos Aires, Argentina', 'Bogotá, Colombia',
    'Santiago, Chile', 'Lima, Peru', 'Medellín, Colombia',
    // Africa
    'Lagos, Nigeria', 'Cape Town, South Africa', 'Nairobi, Kenya', 'Cairo, Egypt',
  ];
  const filteredSuggestions = LOCATION_SUGGESTIONS.filter(
    s => s.toLowerCase().includes(location.toLowerCase()) && s.toLowerCase() !== location.toLowerCase()
  );

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const activeRoles = roles.length > 0 ? roles : (roleInput.trim() ? [roleInput.trim()] : []);
    if (activeRoles.length === 0) { toast.error('Enter at least one job role'); return; }
    if (sources.length === 0) { toast.error('Select at least one source'); return; }
    if (roleInput.trim()) { addRole(roleInput); }
    setSearching(true);
    setJobs([]);
    try {
      const res = await fetch(`${API_BASE}/smart-apply/search`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
        body: JSON.stringify({ roles: activeRoles, query: activeRoles.join(' OR '), location, sources }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Search failed'); return; }
      setJobs(d.jobs ?? []);
      setWasCached(d.cached ?? false);
      if ((d.jobs ?? []).length === 0) toast.info('No jobs found — try different keywords');
      else toast.success(`Found ${d.count} jobs${d.cached ? ' (cached)' : ''}`);
    } catch { toast.error('Search failed — check your connection'); }
    finally { setSearching(false); }
  };

  // ── Add to queue ──────────────────────────────────────────────────────────
  const addToQueue = async (job: ScrapedJob) => {
    if (queue.find(j => j.id === job.id)) { toast.info('Already in queue'); return; }
    try {
      const res = await fetch(`${API_BASE}/smart-apply/queue/add`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
        body: JSON.stringify({ job }),
      });
      if (res.ok) {
        setQueue(q => [...q, job]);
        toast.success(`Added "${job.title}" to queue`);
      }
    } catch { toast.error('Failed to add to queue'); }
  };

  // ── Remove from queue ─────────────────────────────────────────────────────
  const removeFromQueue = async (jobId: string) => {
    try {
      await fetch(`${API_BASE}/smart-apply/queue/remove`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
        body: JSON.stringify({ job_id: jobId }),
      });
      setQueue(q => q.filter(j => j.id !== jobId));
    } catch { toast.error('Failed to remove'); }
  };

  // ── Supervised: open review panel + generate cover letter ────────────────
  const openSupervised = async (job: ScrapedJob) => {
    setSupervisedJob(job);
    setCoverLetter('');
    setCoverLoading(true);
    try {
      const resumeData = getSelectedResumeData();
      const clRes = await fetch(`${API_BASE}/generate-cover-letter`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
        body: JSON.stringify({
          resumeData,
          jobDetails: `${job.title} at ${job.company} — ${job.description || job.title}`,
        }),
      });
      if (clRes.ok) {
        const clData = await clRes.json();
        setCoverLetter(clData.coverLetter ?? '');
      }
    } catch { /* keep blank */ }
    finally { setCoverLoading(false); }
  };

  // ── Supervised: confirm apply ─────────────────────────────────────────────
  const confirmSupervised = async () => {
    if (!supervisedJob) return;
    setApplyingJobId(supervisedJob.id);
    try {
      const res = await fetch(`${API_BASE}/smart-apply/apply-supervised`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
        body: JSON.stringify({
          job_id:       supervisedJob.id,
          job_data:     supervisedJob,
          cover_letter: coverLetter,
        }),
      });
      if (res.ok) {
        toast.success(`Applied to ${supervisedJob.title} at ${supervisedJob.company}!`);
        setAppliedToday(n => n + 1);
        setQueue(q => q.filter(j => j.id !== supervisedJob.id));
        setSupervisedJob(null);
        fetchQueue();
        window.open(supervisedJob.url, '_blank');
      } else {
        toast.error('Apply failed — please try again');
      }
    } catch { toast.error('Apply failed'); }
    finally { setApplyingJobId(null); }
  };

  // ── Autonomous: start ─────────────────────────────────────────────────────
  const startAutonomous = async () => {
    if (queue.length === 0) { toast.error('Add jobs to your queue first'); return; }
    try {
      const res = await fetch(`${API_BASE}/smart-apply/autonomous/start`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
        body: JSON.stringify({ daily_cap: DAILY_CAP }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || 'Failed to start'); return; }
      setAutoRunning(true);
      setProgress([]);
      toast.success(`Autonomous apply started — ${d.jobs_queued} jobs queued`);
    } catch { toast.error('Failed to start autonomous mode'); }
  };

  // ── Autonomous: stop ──────────────────────────────────────────────────────
  const stopAutonomous = async () => {
    try {
      await fetch(`${API_BASE}/smart-apply/autonomous/stop`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
      });
      setAutoRunning(false);
      clearInterval(pollRef.current!);
      pollRef.current = null;
      toast.info('Autonomous apply stopped');
      fetchQueue();
    } catch { toast.error('Failed to stop'); }
  };

  const toggleSource = (src: string) => {
    setSources(s => s.includes(src) ? s.filter(x => x !== src) : [...s, src]);
  };

  const inQueue = (id: string) => queue.some(j => j.id === id);
  const alreadyApplied = (id: string) => appliedJobs.some(j => j.job_id === id);

  return (
    <CandidateLayout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <Zap className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Smart Apply</h1>
              <p className="text-xs text-zinc-400 mt-0.5">Scrape jobs from the web · share the pool · apply in one click</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Applied today</p>
              <p className="text-lg font-bold text-white leading-none">
                {appliedToday}<span className="text-zinc-500 text-xs font-normal">/{DAILY_CAP}</span>
              </p>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${autoRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-700'}`} />
          </div>
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── LEFT: Search + Results ───────────────────────────────────────── */}
          <div className="lg:col-span-8 space-y-5">

            {/* Search panel */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-white">Find Jobs</span>
              </div>

              {/* Multi-role tag input */}
              <div>
                <div className="flex flex-wrap items-center gap-1.5 min-h-[42px] bg-zinc-900/60 border border-white/8 rounded-xl px-3 py-2 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20">
                  <Briefcase className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  {roles.map((r, i) => (
                    <span key={i} className="flex items-center gap-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold px-2 py-0.5 rounded-lg">
                      {r}
                      <button type="button" onClick={() => removeRole(i)} className="text-indigo-400 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={roleInput}
                    onChange={e => setRoleInput(e.target.value)}
                    onKeyDown={handleRoleKeyDown}
                    onBlur={() => { if (roleInput.trim()) addRole(roleInput); }}
                    placeholder={roles.length === 0 ? 'e.g. React Developer — press Enter to add more roles…' : 'Add another role…'}
                    className="flex-1 min-w-[180px] bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-zinc-600 mt-1 ml-1">
                  Press <kbd className="bg-zinc-800 text-zinc-400 px-1 rounded text-[10px]">Enter</kbd> or{' '}
                  <kbd className="bg-zinc-800 text-zinc-400 px-1 rounded text-[10px]">,</kbd> to add each role · backspace removes last
                </p>
              </div>

              {/* Location with suggestions */}
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 z-10" />
                <input
                  ref={locationInputRef}
                  value={location}
                  onChange={e => { setLocation(e.target.value); setShowLocationSuggestions(true); }}
                  onFocus={() => setShowLocationSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 150)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Remote, New York, London…"
                  className="w-full bg-zinc-900/60 border border-white/8 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                />
                <AnimatePresence>
                  {showLocationSuggestions && filteredSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute z-30 mt-1 w-full bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden"
                    >
                      {filteredSuggestions.slice(0, 6).map(s => (
                        <button key={s} type="button"
                          onMouseDown={() => { setLocation(s); setShowLocationSuggestions(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5 hover:text-white transition-colors text-left">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />{s}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Sources + search button */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-zinc-500">Sources:</span>
                {Object.entries(SOURCE_LABELS).map(([src, meta]) => (
                  <button key={src} onClick={() => toggleSource(src)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      sources.includes(src)
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-zinc-900/40 border-white/5 text-zinc-500 hover:border-white/15'
                    }`}>
                    {meta.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-zinc-600">
                  Arbeitnow &amp; Jobicy work without a key. Indeed &amp; LinkedIn require{' '}
                  <a href="/candidate/settings?section=api-keys" className="text-indigo-400 hover:underline">Apify</a>.
                </p>
                <button onClick={handleSearch} disabled={searching}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all whitespace-nowrap shrink-0">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {searching ? 'Scraping…' : 'Find Jobs'}
                </button>
              </div>
            </motion.div>

            {/* Results */}
            {jobs.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutList className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm font-semibold text-white">{jobs.length} Jobs Found</span>
                    {wasCached && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                        cached · shared pool
                      </span>
                    )}
                  </div>
                  <button onClick={handleSearch}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {jobs.map(job => (
                    <motion.div key={job.id} layout
                      className={`bg-white/3 border rounded-xl p-4 transition-all ${
                        inQueue(job.id)       ? 'border-indigo-500/40 bg-indigo-500/5'
                        : alreadyApplied(job.id) ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-white/8 hover:border-white/15'
                      }`}>
                      <div className="flex items-start gap-3">
                        {job.logo
                          ? <img src={job.logo} alt={job.company} className="w-9 h-9 rounded-lg object-cover bg-zinc-800 flex-shrink-0" />
                          : <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4 text-zinc-500" /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-white truncate">{job.title}</h3>
                              <p className="text-xs text-zinc-400 truncate">{job.company}</p>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 font-mono ${
                              SOURCE_LABELS[job.source]?.color ?? 'bg-zinc-700 text-zinc-300 border-zinc-600'
                            }`}>
                              {SOURCE_LABELS[job.source]?.label ?? job.source}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                            {job.location && (
                              <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                                <MapPin className="w-3 h-3" />{job.location}
                              </span>
                            )}
                            {job.salary && (
                              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                                <DollarSign className="w-3 h-3" />{job.salary}
                              </span>
                            )}
                          </div>

                          {job.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {job.tags.slice(0, 4).map(tag => (
                                <span key={tag} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">{tag}</span>
                              ))}
                            </div>
                          )}

                          {job.description && (
                            <div className="mt-2">
                              <button onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
                                {expandedJob === job.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                {expandedJob === job.id ? 'Hide' : 'Preview'} description
                              </button>
                              <AnimatePresence>
                                {expandedJob === job.id && (
                                  <motion.p
                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    className="text-[11px] text-zinc-400 mt-1 leading-relaxed overflow-hidden"
                                    dangerouslySetInnerHTML={{ __html: job.description.replace(/<[^>]*>/g, '') }}
                                  />
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-3">
                            <a href={job.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors">
                              <ExternalLink className="w-3 h-3" /> View
                            </a>
                            {alreadyApplied(job.id) ? (
                              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                                <CheckCircle className="w-3 h-3" /> Applied
                              </span>
                            ) : inQueue(job.id) ? (
                              <span className="flex items-center gap-1 text-[11px] text-indigo-400 font-semibold">
                                <Clock className="w-3 h-3" /> In Queue
                              </span>
                            ) : (
                              <button onClick={() => addToQueue(job)}
                                className="flex items-center gap-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg font-semibold transition-all">
                                <Plus className="w-3 h-3" /> Queue
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Empty state */}
            {!searching && jobs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-700 gap-2">
                <Search className="w-10 h-10" />
                <p className="text-sm">Search for jobs above to get started</p>
              </div>
            )}
          </div>

          {/* ── RIGHT: Apply Queue (sticky) ────────────────────────────────── */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 bg-white/3 border border-white/8 rounded-2xl overflow-hidden">

              {/* Queue header — row 1: title + mode toggle */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-semibold text-white">Apply Queue</span>
                  <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
                    {queue.length}
                  </span>
                </div>
                <div className="flex items-center bg-zinc-900/80 border border-white/8 rounded-xl p-1 shrink-0">
                  <button onClick={() => setApplyMode('supervised')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      applyMode === 'supervised' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                    }`}>
                    <User className="w-3 h-3" /> Supervised
                  </button>
                  <button onClick={() => setApplyMode('autonomous')}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      applyMode === 'autonomous' ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                    }`}>
                    <Bot className="w-3 h-3" /> Auto
                  </button>
                </div>
              </div>

              {/* Queue header — row 2: resume selector */}
              <div className="px-5 pb-4 border-b border-white/8">
                <button onClick={() => setShowResumePicker(v => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-900/60 border border-white/8 hover:border-white/15 rounded-xl text-xs text-white transition-colors group">
                  <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="flex-1 text-left truncate text-zinc-300 group-hover:text-white font-medium">
                    {resumes.find(r => r.id === selectedResumeId)?.name ?? 'My Resume'}
                  </span>
                  {showResumePicker ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                </button>
              </div>

              {/* Resume picker dropdown */}
              <AnimatePresence>
                {showResumePicker && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-white/8"
                  >
                    <div className="p-3 space-y-1">
                      {resumes.map(r => (
                        <button key={r.id}
                          onClick={() => { setSelectedResumeId(r.id); setShowResumePicker(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                            selectedResumeId === r.id
                              ? 'bg-indigo-500/15 border border-indigo-500/30'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}>
                          <FileText className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{r.name}</p>
                            {r.savedAt && <p className="text-[10px] text-zinc-500">Saved {new Date(r.savedAt).toLocaleDateString()}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {selectedResumeId === r.id && <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />}
                            <button onClick={e => { e.stopPropagation(); saveDefaultResume(r.id); }} title="Set as default"
                              className="p-1 text-zinc-500 hover:text-amber-400 transition-colors">
                              <Star className="w-3 h-3" />
                            </button>
                          </div>
                        </button>
                      ))}
                      <a href="/candidate/resume-builder"
                        className="flex items-center gap-2 px-3 py-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                        <Plus className="w-3 h-3" /> Create a new resume version
                      </a>
                      <input ref={resumeUploadRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumeUpload} />
                      <button onClick={() => resumeUploadRef.current?.click()} disabled={uploadingResume}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50">
                        {uploadingResume
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                          : <><UploadCloud className="w-3 h-3" /> Upload from device (PDF / DOCX)</>
                        }
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Queue content */}
              <div className="p-5 space-y-4 max-h-[calc(100vh-18rem)] overflow-y-auto">

                {/* Supervised mode */}
                {applyMode === 'supervised' && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Review each job + AI cover letter before applying. Opens the job page in a new tab.</p>
                    {queue.length === 0 ? (
                      <div className="flex flex-col items-center py-10 text-zinc-700 gap-2">
                        <Briefcase className="w-7 h-7" />
                        <p className="text-xs text-center">No jobs queued yet.<br />Search and click <strong className="text-zinc-500">Queue</strong>.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {queue.map(job => (
                          <div key={job.id} className="p-3 bg-zinc-900/40 border border-white/5 rounded-xl space-y-2">
                            <div>
                              <p className="text-xs font-semibold text-white truncate">{job.title}</p>
                              <p className="text-[11px] text-zinc-500 truncate">{job.company} · {job.location}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => openSupervised(job)}
                                className="flex-1 flex items-center justify-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-semibold transition-all">
                                <BookOpen className="w-3 h-3" /> Review &amp; Apply
                              </button>
                              <button onClick={() => removeFromQueue(job.id)}
                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Autonomous mode */}
                {applyMode === 'autonomous' && (
                  <div className="space-y-4">
                    <div className="flex items-start gap-2.5 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-300/80">
                        Applies to all queued jobs automatically (max {DAILY_CAP}/day). Use responsibly.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Daily cap</span>
                        <span className="font-mono">{appliedToday} / {DAILY_CAP}</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                          style={{ width: `${Math.min((appliedToday / DAILY_CAP) * 100, 100)}%` }} />
                      </div>
                    </div>

                    {!autoRunning ? (
                      <button onClick={startAutonomous} disabled={queue.length === 0 || appliedToday >= DAILY_CAP}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all">
                        <Play className="w-4 h-4" />
                        Start ({Math.min(queue.length, DAILY_CAP - appliedToday)} jobs)
                      </button>
                    ) : (
                      <button onClick={stopAutonomous}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600/80 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-all">
                        <Square className="w-4 h-4" /> Stop Applying
                      </button>
                    )}

                    {(autoRunning || progress.length > 0) && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Cpu className={`w-3.5 h-3.5 ${autoRunning ? 'text-indigo-400 animate-pulse' : 'text-zinc-500'}`} />
                          <span className="text-xs font-semibold text-zinc-300">{autoRunning ? 'Applying…' : 'Session complete'}</span>
                        </div>
                        <div className="bg-zinc-950/60 rounded-xl p-3 font-mono text-xs space-y-1.5 max-h-40 overflow-y-auto">
                          <AnimatePresence initial={false}>
                            {progress.map((p, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-2">
                                {p.status === 'applied'
                                  ? <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                  : <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                                <span className={p.status === 'applied' ? 'text-emerald-300 truncate' : 'text-red-300 truncate'}>
                                  {p.status === 'applied' ? '✓' : '✗'} {p.title} @ {p.company}
                                </span>
                              </motion.div>
                            ))}
                            {autoRunning && (
                              <motion.div key="spinner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="flex items-center gap-2 text-zinc-500">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Processing next…</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    {queue.length > 0 && !autoRunning && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Queued ({queue.length})</p>
                        {queue.map(job => (
                          <div key={job.id} className="flex items-center justify-between p-2.5 bg-zinc-900/40 border border-white/5 rounded-xl">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{job.title}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{job.company}</p>
                            </div>
                            <button onClick={() => removeFromQueue(job.id)}
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all ml-2 shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Applied history */}
                {appliedJobs.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-white/5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Applied This Session</p>
                    {appliedJobs.slice(-5).reverse().map((a, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate">{a.job_data?.title ?? 'Job'}</p>
                          <p className="text-[10px] text-zinc-500">{a.job_data?.company} · {a.mode}</p>
                        </div>
                        <span className="text-[10px] text-zinc-600 whitespace-nowrap shrink-0">
                          {a.applied_at ? new Date(a.applied_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>{/* end two-column grid */}
      </div>

      {/* ── Supervised Review Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {supervisedJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) setSupervisedJob(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{supervisedJob.title}</h2>
                  <p className="text-sm text-zinc-400">{supervisedJob.company} · {supervisedJob.location}</p>
                </div>
                <a
                  href={supervisedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Open Job
                </a>
              </div>

              {/* Resume badge */}
              {resumes.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <FileText className="w-3 h-3" />
                  Using:
                  <span className="text-zinc-300 font-medium">
                    {resumes.find(r => r.id === selectedResumeId)?.name ?? 'My Resume'}
                  </span>
                </div>
              )}

              {/* AI Cover Letter */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold text-zinc-300">AI-Generated Cover Letter</span>
                  {coverLoading && <Loader2 className="w-3 h-3 text-zinc-500 animate-spin" />}
                </div>
                <textarea
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  rows={10}
                  placeholder={coverLoading ? 'Generating cover letter…' : 'Cover letter will appear here…'}
                  className="w-full bg-zinc-900/60 border border-white/8 rounded-xl p-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 resize-none font-mono leading-relaxed"
                />
                <p className="text-[11px] text-zinc-500">You can edit this before applying.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSupervisedJob(null)}
                  className="flex-1 py-2.5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 text-sm font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSupervised}
                  disabled={!!applyingJobId || coverLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
                >
                  {applyingJobId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {applyingJobId ? 'Applying…' : 'Confirm & Apply'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CandidateLayout>
  );
}
