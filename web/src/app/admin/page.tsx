'use client';

// Super Admin console — feature flags, platform stats, user & job management.
// Access: backend email allowlist (SUPER_ADMIN_EMAILS). The UI guard here is
// convenience; every admin endpoint re-checks the allowlist server-side.
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags, FeatureFlags } from '@/contexts/FeatureFlagsContext';
import { toast } from 'sonner';
import { API_BASE as API } from '@/lib/api';
import {
  ShieldCheck, Users, Briefcase, ToggleLeft, RefreshCw, BarChart3,
  Ban, CheckCircle2, FileText, MessageSquare, Link2,
} from 'lucide-react';

type Tab = 'overview' | 'features' | 'users' | 'jobs';

const FLAG_META: { key: keyof FeatureFlags; label: string; desc: string }[] = [
  { key: 'signups',       label: 'New Signups',        desc: 'Allow new accounts to be created.' },
  { key: 'feed',          label: 'Social Feed',        desc: 'LinkedIn-style posts, likes and comments.' },
  { key: 'smartApply',    label: 'Smart Apply',        desc: 'Automated job scraping and one-click applications.' },
  { key: 'aiInterview',   label: 'AI Interview',       desc: 'Proctored voice interview with identity check.' },
  { key: 'practiceMode',  label: 'Practice Interviews',desc: 'Unproctored voice practice sessions.' },
  { key: 'resumeBuilder', label: 'Resume Builder',     desc: 'AI resume builder and cover letters.' },
  { key: 'network',       label: 'Ecosystem Network',  desc: 'User directory and connection requests.' },
  { key: 'messages',      label: 'Messaging',          desc: 'Direct chat between connected users.' },
  { key: 'sourcing',      label: 'Passive Sourcing',   desc: 'Recruiter external job board search.' },
  { key: 'webhooks',      label: 'Webhooks',           desc: 'Recruiter ATS webhook integrations.' },
  { key: 'companies',     label: 'Company Directory',  desc: 'Public company explorer pages.' },
];

export default function AdminPage() {
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();
  const { isAdmin, flagsLoaded, refreshFlags } = useFeatureFlags();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<any>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [usersList, setUsersList] = useState<any[]>([]);
  const [jobsList, setJobsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const authed = useCallback(async () => ({ Authorization: `Bearer ${await getToken()}` }), [getToken]);

  // Guard: bounce non-admins once flags are known
  useEffect(() => {
    if (authLoading || !flagsLoaded) return;
    if (!isAuthenticated) { router.push('/'); return; }
    if (!isAdmin) { toast.error('Admin access required.'); router.push('/'); }
  }, [authLoading, flagsLoaded, isAuthenticated, isAdmin, router]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const h = await authed();
      const [sRes, fRes, uRes, jRes] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers: h }),
        fetch(`${API}/platform/config`, { headers: h }),
        fetch(`${API}/admin/users`, { headers: h }),
        fetch(`${API}/admin/jobs`, { headers: h }),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (fRes.ok) setFeatures((await fRes.json()).features || {});
      if (uRes.ok) setUsersList((await uRes.json()).users || []);
      if (jRes.ok) setJobsList((await jRes.json()).jobs || []);
    } catch { toast.error('Failed to load admin data — is the backend running?'); }
    finally { setLoading(false); }
  }, [authed]);

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin, loadAll]);

  const toggleFeature = async (key: string) => {
    const next = { ...features, [key]: !features[key] };
    setFeatures(next); // optimistic
    setBusy(key);
    try {
      const res = await fetch(`${API}/admin/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...await authed() },
        body: JSON.stringify({ features: { [key]: next[key] } }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${FLAG_META.find(f => f.key === key)?.label || key} ${next[key] ? 'enabled' : 'disabled'} platform-wide.`);
      refreshFlags();
    } catch {
      setFeatures(features); // rollback
      toast.error('Failed to update feature flag.');
    } finally { setBusy(null); }
  };

  const toggleSuspend = async (uid: string, suspended: boolean) => {
    setBusy(uid);
    try {
      const res = await fetch(`${API}/admin/users/${uid}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authed() },
        body: JSON.stringify({ suspended }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setUsersList(usersList.map(u => u.uid === uid ? { ...u, suspended } : u));
      toast.success(suspended ? 'User suspended.' : 'User reinstated.');
    } catch (e: any) { toast.error(e.message || 'Failed.'); }
    finally { setBusy(null); }
  };

  const setJobStatus = async (id: string, status: string) => {
    setBusy(id);
    try {
      const res = await fetch(`${API}/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...await authed() },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setJobsList(jobsList.map(j => j.id === id ? { ...j, status } : j));
      toast.success(`Job status → ${status}`);
    } catch { toast.error('Failed to update job.'); }
    finally { setBusy(null); }
  };

  if (authLoading || !flagsLoaded || !isAdmin) return (
    <div className="min-h-[70vh] flex items-center justify-center"><RefreshCw className="w-8 h-8 animate-spin text-purple-400" /></div>
  );

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview',      icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'features', label: 'Feature Flags', icon: <ToggleLeft className="w-4 h-4" /> },
    { id: 'users',    label: 'Users',         icon: <Users className="w-4 h-4" /> },
    { id: 'jobs',     label: 'Jobs',          icon: <Briefcase className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 text-white space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold">Super Admin</h1>
            <p className="text-xs text-muted">Signed in as {user?.email}</p>
          </div>
        </div>
        <button onClick={loadAll} className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
              tab === t.id ? 'border-purple-500 text-white' : 'border-transparent text-zinc-400 hover:text-white'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 animate-spin text-purple-400" /></div>
      ) : (
        <>
          {/* ── Overview ── */}
          {tab === 'overview' && stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: stats.users?.total ?? 0, sub: `${stats.users?.byRole?.candidate ?? 0} candidates · ${stats.users?.byRole?.recruiter ?? 0} recruiters`, icon: <Users className="w-5 h-5 text-cyan-400" /> },
                { label: 'Jobs', value: stats.jobs?.total ?? 0, sub: Object.entries(stats.jobs?.byStatus || {}).map(([k, v]) => `${v} ${k}`).join(' · ') || '—', icon: <Briefcase className="w-5 h-5 text-purple-400" /> },
                { label: 'Applications', value: stats.applications ?? 0, sub: 'all time', icon: <FileText className="w-5 h-5 text-emerald-400" /> },
                { label: 'Connections', value: stats.connections ?? 0, sub: `${stats.posts ?? 0} feed posts`, icon: <Link2 className="w-5 h-5 text-pink-400" /> },
              ].map(c => (
                <div key={c.label} className="cc-card p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-muted">{c.label}</span>
                    {c.icon}
                  </div>
                  <p className="text-3xl font-black">{c.value}</p>
                  <p className="text-[11px] text-muted">{c.sub}</p>
                </div>
              ))}
              {stats.users?.suspended > 0 && (
                <div className="col-span-2 lg:col-span-4 cc-card p-4 border-red-500/30 text-sm text-red-300 flex items-center gap-2">
                  <Ban className="w-4 h-4" /> {stats.users.suspended} suspended account{stats.users.suspended !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {/* ── Feature flags ── */}
          {tab === 'features' && (
            <div className="space-y-3">
              <p className="text-xs text-muted">Changes apply platform-wide within a minute (backend cache). Disabled features are hidden in the UI and rejected by the API.</p>
              {FLAG_META.map(f => (
                <div key={f.key} className="cc-card p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold">{f.label}</p>
                    <p className="text-xs text-muted">{f.desc}</p>
                  </div>
                  <button onClick={() => toggleFeature(f.key)} disabled={busy === f.key}
                    className={`relative w-12 h-6 rounded-full transition shrink-0 ${features[f.key] ? 'bg-emerald-500' : 'bg-zinc-700'} ${busy === f.key ? 'opacity-50' : ''}`}
                    aria-label={`Toggle ${f.label}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${features[f.key] ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <div className="cc-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold font-mono uppercase tracking-widest text-muted border-b border-white/10">
                    <th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {usersList.map(u => (
                    <tr key={u.uid} className={u.suspended ? 'opacity-50' : ''}>
                      <td className="px-4 py-3 font-semibold">{u.fullName || '—'}</td>
                      <td className="px-4 py-3 text-muted">{u.email}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 uppercase">{u.role}</span></td>
                      <td className="px-4 py-3">
                        {u.suspended
                          ? <span className="text-red-400 text-xs font-bold flex items-center gap-1"><Ban className="w-3 h-3" />Suspended</span>
                          : <span className="text-emerald-400 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Active</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => toggleSuspend(u.uid, !u.suspended)} disabled={busy === u.uid}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition disabled:opacity-40 ${
                            u.suspended
                              ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                              : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                          }`}>
                          {u.suspended ? 'Reinstate' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Jobs ── */}
          {tab === 'jobs' && (
            <div className="cc-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold font-mono uppercase tracking-widest text-muted border-b border-white/10">
                    <th className="px-4 py-3">Title</th><th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Posted</th><th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {jobsList.map(j => (
                    <tr key={j.id}>
                      <td className="px-4 py-3 font-semibold">{j.title}</td>
                      <td className="px-4 py-3 text-muted">{j.company || '—'}</td>
                      <td className="px-4 py-3 text-muted">{j.postedDate || '—'}</td>
                      <td className="px-4 py-3">
                        <select value={j.status || 'Open'} onChange={e => setJobStatus(j.id, e.target.value)} disabled={busy === j.id}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-300 disabled:opacity-40">
                          {['Draft', 'Open', 'Paused', 'In Review', 'Closed', 'Archived'].map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <p className="text-[11px] text-zinc-600 flex items-center gap-1.5 pb-8">
        <MessageSquare className="w-3 h-3" /> Admin actions are logged with your email in the platform config document.
      </p>
    </div>
  );
}
