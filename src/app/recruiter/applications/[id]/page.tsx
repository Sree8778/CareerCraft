// src/app/recruiter/applications/[id]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Calendar, FileText, Briefcase, GraduationCap,
  Zap, ChevronRight, ArrowLeft, CheckCircle, XCircle, Clock,
  MapPin, Phone, Award, TrendingUp, Save, RefreshCw, ExternalLink
} from 'lucide-react';

const API = 'http://127.0.0.1:5000/api';

const STATUS_FLOW = ['Applied', 'In Review', 'Interviewed', 'Shortlisted', 'Hired'];

const STATUS_COLORS: Record<string, string> = {
  Applied: 'bg-blue-600',
  'In Review': 'bg-yellow-600',
  Interviewed: 'bg-indigo-600',
  Shortlisted: 'bg-cyan-600',
  Hired: 'bg-green-600',
  Rejected: 'bg-red-600',
};

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || 'U';
};

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [activeTab, setActiveTab] = useState<'resume' | 'cover-letter' | 'pipeline'>('resume');
  const [resumeData, setResumeData] = useState<any>(null);
  const [loadingResume, setLoadingResume] = useState(false);

  const authHeader = { 'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}` };

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/applications/${id}`, { headers: authHeader });
        if (!res.ok) { router.push('/recruiter/applications'); return; }
        const data = await res.json();
        setApp(data);
        setNotes(data.recruiterNotes || '');
      } catch { toast.error('Failed to load application.'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!app?.candidateId) return;
    const fetchResume = async () => {
      setLoadingResume(true);
      try {
        const res = await fetch(`${API}/candidates/${app.candidateId}/resume`, { headers: authHeader });
        if (res.ok) {
          const data = await res.json();
          setResumeData(data.resumeData);
        }
      } catch {}
      finally { setLoadingResume(false); }
    };
    fetchResume();
  }, [app?.candidateId]);

  const updateStatus = async (status: string) => {
    setActioning(true);
    try {
      await fetch(`${API}/applications/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ status }),
      });
      setApp((prev: any) => ({ ...prev, status }));
      toast.success(`Status updated to "${status}"`);
    } catch { toast.error('Failed to update status.'); }
    finally { setActioning(false); }
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/applications/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ recruiterNotes: notes }),
      });
      toast.success('Notes saved.');
    } catch { toast.error('Failed to save notes.'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <RecruiterLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    </RecruiterLayout>
  );
  if (!app) return null;

  const statusIdx = STATUS_FLOW.indexOf(app.status);
  const skills: any[] = resumeData?.skills || [];
  const experience: any[] = resumeData?.experience || [];
  const education: any[] = resumeData?.education || [];
  const summary: string = resumeData?.summary || '';
  const personal: any = resumeData?.personal || {};

  const flatSkills: string[] = skills.flatMap((s: any) => {
    if (typeof s === 'string') return [s];
    if (s.skills_list) return String(s.skills_list).split(',').map((x: string) => x.trim()).filter(Boolean);
    return [];
  });

  return (
    <RecruiterLayout>
      <div className="max-w-6xl mx-auto text-white space-y-6">

        {/* Back */}
        <Link href="/recruiter/applications" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition">
          <ArrowLeft className="w-4 h-4" /> Back to Applications
        </Link>

        {/* Header card */}
        <div className="glass rounded-2xl p-6 border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xl font-black shadow-lg">
              {getInitials(app.candidateName)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{app.candidateName}</h1>
              <p className="text-zinc-400 text-sm">{app.jobTitle} · {app.company}</p>
              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{app.candidateEmail}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Applied {app.appliedDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${STATUS_COLORS[app.status] || 'bg-zinc-700'}`}>
              {app.status}
            </span>
            <Link href={`/recruiter/candidates/${app.candidateId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition">
              Full Profile <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Pipeline progress bar */}
        <div className="glass rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between">
            {STATUS_FLOW.map((stage, i) => {
              const done = i < statusIdx;
              const active = i === statusIdx;
              const future = i > statusIdx;
              return (
                <React.Fragment key={stage}>
                  <div className="flex flex-col items-center gap-1.5 flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                      active ? 'bg-purple-600 border-purple-400 scale-110' :
                      done ? 'bg-green-600 border-green-400' :
                      'bg-zinc-800 border-zinc-600'
                    }`}>
                      {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight ${
                      active ? 'text-purple-300' : done ? 'text-green-400' : 'text-zinc-500'
                    }`}>{stage}</span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 rounded ${i < statusIdx ? 'bg-green-600' : 'bg-zinc-700'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Main content: left tabs + right sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT — tabs */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tab bar */}
            <div className="glass p-1.5 rounded-xl border border-white/10 flex gap-1.5">
              {[
                { id: 'resume', label: 'Resume', icon: FileText },
                { id: 'cover-letter', label: 'Cover Letter', icon: Mail },
                { id: 'pipeline', label: 'Move Stage', icon: TrendingUp },
              ].map(({ id: tid, label, icon: Icon }) => (
                <button key={tid} onClick={() => setActiveTab(tid as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tid ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">

              {/* RESUME TAB */}
              {activeTab === 'resume' && (
                <motion.div key="resume" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-4">
                  {loadingResume ? (
                    <div className="glass rounded-xl p-8 border border-white/10 flex items-center justify-center gap-3 text-zinc-400">
                      <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                      Loading candidate resume...
                    </div>
                  ) : !resumeData ? (
                    <div className="glass rounded-xl p-8 border border-white/10 text-center text-zinc-400">
                      <FileText className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
                      <p className="font-semibold">No parsed resume found</p>
                      <p className="text-sm mt-1">The candidate hasn't uploaded and parsed a resume yet.</p>
                    </div>
                  ) : (
                    <>
                      {/* Summary */}
                      {summary && (
                        <div className="glass rounded-xl p-5 border border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2 flex items-center gap-2">
                            <User className="w-3.5 h-3.5" />Professional Summary
                          </h3>
                          <p className="text-sm text-zinc-300 leading-relaxed">{summary}</p>
                        </div>
                      )}

                      {/* Personal info from resume */}
                      {(personal.phone || personal.location) && (
                        <div className="glass rounded-xl p-5 border border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3 flex items-center gap-2">
                            <User className="w-3.5 h-3.5" />Contact Details
                          </h3>
                          <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
                            {personal.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-zinc-500" />{personal.phone}</span>}
                            {personal.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-zinc-500" />{personal.location}</span>}
                          </div>
                        </div>
                      )}

                      {/* Skills */}
                      {flatSkills.length > 0 && (
                        <div className="glass rounded-xl p-5 border border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3 flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5" />Skills
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {flatSkills.map((skill, i) => (
                              <span key={i} className="px-2.5 py-1 text-xs font-mono bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-lg">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Experience */}
                      {experience.length > 0 && (
                        <div className="glass rounded-xl p-5 border border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                            <Briefcase className="w-3.5 h-3.5" />Work Experience
                          </h3>
                          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                            {experience.map((exp: any, i: number) => (
                              <div key={i} className="pl-8 relative">
                                <div className="absolute left-2.5 top-1.5 w-2 h-2 rounded-full bg-purple-500 -translate-x-1/2" />
                                <div className="flex flex-wrap justify-between gap-2 mb-1">
                                  <div>
                                    <p className="font-semibold text-sm text-white">{exp.jobTitle || exp.title}</p>
                                    <p className="text-xs text-purple-300">{exp.company}</p>
                                  </div>
                                  {exp.dates && <span className="text-xs text-zinc-500 font-mono">{exp.dates}</span>}
                                </div>
                                {exp.description && <p className="text-xs text-zinc-400 leading-relaxed mt-1">{exp.description}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Education */}
                      {education.length > 0 && (
                        <div className="glass rounded-xl p-5 border border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                            <GraduationCap className="w-3.5 h-3.5" />Education
                          </h3>
                          <div className="space-y-3">
                            {education.map((edu: any, i: number) => (
                              <div key={i} className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold text-sm">{edu.degree}</p>
                                  <p className="text-xs text-purple-300">{edu.institution || edu.school}</p>
                                </div>
                                {(edu.graduationYear || edu.year) && (
                                  <span className="text-xs text-zinc-500 font-mono">{edu.graduationYear || edu.year}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* COVER LETTER TAB */}
              {activeTab === 'cover-letter' && (
                <motion.div key="cover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="glass rounded-xl p-6 border border-white/10">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />Cover Letter
                    </h3>
                    {app.coverLetter ? (
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed bg-white/5 rounded-lg p-4">
                        {app.coverLetter}
                      </p>
                    ) : (
                      <div className="text-center py-8 text-zinc-500">
                        <Mail className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                        <p>No cover letter submitted.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* PIPELINE TAB */}
              {activeTab === 'pipeline' && (
                <motion.div key="pipeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="glass rounded-xl p-6 border border-white/10 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" />Advance Application Stage
                  </h3>
                  <p className="text-xs text-zinc-400">Move this candidate to the next stage in your hiring pipeline.</p>
                  <div className="grid grid-cols-1 gap-2">
                    {STATUS_FLOW.map(s => (
                      <button key={s} disabled={actioning || app.status === s} onClick={() => updateStatus(s)}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold transition ${
                          app.status === s
                            ? 'bg-purple-700 text-white cursor-default'
                            : 'bg-white/5 hover:bg-purple-600/30 border border-white/10 hover:border-purple-500/50 text-zinc-300 hover:text-white'
                        } disabled:opacity-50`}>
                        <span className="flex items-center gap-2">
                          {app.status === s && <CheckCircle className="w-4 h-4 text-purple-300" />}
                          {s}
                        </span>
                        {app.status !== s && <ChevronRight className="w-4 h-4 text-zinc-500" />}
                      </button>
                    ))}
                    <button disabled={actioning} onClick={() => updateStatus('Rejected')}
                      className="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold bg-red-700/20 hover:bg-red-700 border border-red-700/40 hover:border-red-600 text-red-400 hover:text-white transition disabled:opacity-50">
                      <span className="flex items-center gap-2">
                        {app.status === 'Rejected' && <XCircle className="w-4 h-4" />}
                        Reject
                      </span>
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-4">

            {/* Quick actions */}
            <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {['In Review', 'Shortlisted', 'Hired'].map(s => (
                  <button key={s} disabled={actioning || app.status === s} onClick={() => updateStatus(s)}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition truncate ${
                      app.status === s ? 'bg-purple-700 text-white' : 'bg-white/5 hover:bg-purple-600/30 border border-white/10 text-zinc-300'
                    } disabled:opacity-40`}>
                    {s}
                  </button>
                ))}
                <button disabled={actioning} onClick={() => updateStatus('Rejected')}
                  className="py-2 px-2 rounded-lg text-xs font-semibold bg-red-700/20 hover:bg-red-700 border border-red-700/40 text-red-400 hover:text-white transition disabled:opacity-40">
                  Reject
                </button>
              </div>
            </div>

            {/* Job info */}
            <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Applied For</h3>
              <div className="space-y-1.5 text-sm">
                <p className="font-semibold">{app.jobTitle}</p>
                <p className="text-zinc-400 text-xs">{app.company}</p>
                {app.jobId && (
                  <Link href={`/recruiter/requisitions/${app.jobId}`}
                    className="inline-flex items-center gap-1 text-xs text-purple-400 hover:underline mt-1">
                    View Job Posting <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* Recruiter notes */}
            <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-purple-400" />Recruiter Notes
              </h3>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                placeholder="Add private notes about this candidate..."
                className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none" />
              <button onClick={saveNotes} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition">
                {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Saving...</> : <><Save className="w-3.5 h-3.5" />Save Notes</>}
              </button>
            </div>

            {/* Link to full candidate profile */}
            <Link href={`/recruiter/candidates/${app.candidateId}`}
              className="glass rounded-xl p-4 border border-white/10 hover:border-purple-500/40 transition flex items-center justify-between group">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Full Candidate Profile</p>
                <p className="text-sm font-semibold group-hover:text-purple-300 transition">View Interview & Biometrics</p>
              </div>
              <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 transition" />
            </Link>

          </div>
        </div>
      </div>
    </RecruiterLayout>
  );
}
