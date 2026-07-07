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
  MapPin, Phone, Award, TrendingUp, Save, RefreshCw, ExternalLink,
  Sparkles, Check, X as XIcon, MessageSquare, Video, Link2,
} from 'lucide-react';
import { API_BASE as API } from '@/lib/api';

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
  const { user, getToken } = useAuth();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);
  const [activeTab, setActiveTab] = useState<'resume' | 'cover-letter' | 'pipeline' | 'ai-screen' | 'schedule'>('resume');
  const [resumeData, setResumeData] = useState<any>(null);
  const [loadingResume, setLoadingResume] = useState(false);
  const [messagingLoading, setMessagingLoading] = useState(false);

  // AI screening state
  const [aiScreen, setAiScreen] = useState<any>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [screened, setScreened] = useState(false);

  // Interview scheduling state
  const [scheduledInterviews, setScheduledInterviews] = useState<any[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);
  const [schedulingInterview, setSchedulingInterview] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    scheduledAt: '',
    duration: '60',
    type: 'video',
    meetingLink: '',
    notes: '',
  });

  const getAuthHeader = async () => ({ 'Authorization': `Bearer ${await getToken()}` });

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/applications/${id}`, { headers: await getAuthHeader() });
        if (!res.ok) { router.push('/recruiter/applications'); return; }
        const data = await res.json();
        setApp(data);
        setNotes(data.recruiterNotes || '');
        // Pre-populate AI screen from analysis computed at apply time
        if (data.matchScore !== undefined) {
          setAiScreen({
            score: data.matchScore,
            matchedSkills: data.matchedSkills || [],
            missingSkills: data.missingSkills || [],
            strengths: data.strengths || [],
            concerns: data.concerns || [],
            recommendation: data.recommendation || (data.matchScore >= 80 ? 'Hire' : data.matchScore >= 55 ? 'Maybe' : 'Pass'),
            aiSummary: data.aiSummary || '',
            aiEnhanced: data.aiEnhanced || false,
            optimizationTips: data.concerns || [],
            analysisTimestamp: data.analysisTimestamp || '',
          });
          setScreened(true);
        }
      } catch { toast.error('Failed to load application.'); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'schedule' && id) loadInterviews();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!app?.candidateId) return;
    const fetchResume = async () => {
      setLoadingResume(true);
      try {
        const res = await fetch(`${API}/candidates/${app.candidateId}/resume`, { headers: await getAuthHeader() });
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
        headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
        body: JSON.stringify({ status }),
      });
      setApp((prev: any) => ({ ...prev, status }));
      toast.success(`Status updated to "${status}"`);
    } catch { toast.error('Failed to update status.'); }
    finally { setActioning(false); }
  };

  const runAiScreen = async () => {
    if (!id) return;
    setScreeningLoading(true);
    const toastId = toast.loading('AI is screening this candidate…');
    try {
      const res = await fetch(`${API}/applications/${id}/ai-screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Screening failed');
      setAiScreen(data);
      setScreened(true);
      toast.success('AI screening complete.', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Screening failed.', { id: toastId });
    } finally {
      setScreeningLoading(false);
    }
  };

  const openChat = async () => {
    if (!app || !user) return;
    setMessagingLoading(true);
    try {
      const res = await fetch(`${API}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
        body: JSON.stringify({
          candidateId: app.candidateId,
          recruiterId: user.id,
          jobId: app.jobId,
          jobTitle: app.jobTitle,
          candidateName: app.candidateName,
          recruiterName: user.name,
        }),
      });
      const data = await res.json();
      if (data.chatId || data.id) {
        router.push('/recruiter/messages');
      } else {
        toast.error('Could not open chat.');
      }
    } catch {
      toast.error('Failed to create chat.');
    } finally {
      setMessagingLoading(false);
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/applications/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
        body: JSON.stringify({ recruiterNotes: notes }),
      });
      toast.success('Notes saved.');
    } catch { toast.error('Failed to save notes.'); }
    finally { setSaving(false); }
  };

  const loadInterviews = async () => {
    setLoadingInterviews(true);
    try {
      const res = await fetch(`${API}/interviews?applicationId=${id}`, { headers: await getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        setScheduledInterviews(data.interviews ?? data ?? []);
      }
    } catch {}
    finally { setLoadingInterviews(false); }
  };

  const scheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewForm.scheduledAt) { toast.error('Pick a date and time'); return; }
    setSchedulingInterview(true);
    try {
      const res = await fetch(`${API}/interviews/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
        body: JSON.stringify({
          applicationId: id,
          candidateId: app.candidateId,
          jobId: app.jobId,
          scheduledAt: interviewForm.scheduledAt,
          duration: Number(interviewForm.duration),
          type: interviewForm.type,
          meetingLink: interviewForm.meetingLink,
          notes: interviewForm.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule');
      toast.success('Interview scheduled! Candidate has been notified.');
      setInterviewForm({ scheduledAt: '', duration: '60', type: 'video', meetingLink: '', notes: '' });
      setScheduledInterviews(prev => [data.interview ?? data, ...prev]);
      if (app.status === 'Applied' || app.status === 'In Review') {
        updateStatus('Interviewed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not schedule interview');
    } finally {
      setSchedulingInterview(false);
    }
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{app.candidateName}</h1>
                {app.candidateId && (
                  <Link href={`/profile/${app.candidateId}`}
                    className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-lg transition flex items-center gap-1">
                    View Profile
                  </Link>
                )}
              </div>
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
            <button onClick={openChat} disabled={messagingLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-lg text-sm transition disabled:opacity-50">
              {messagingLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
              Message
            </button>
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
                { id: 'ai-screen', label: 'AI Screen', icon: Sparkles },
                { id: 'schedule', label: 'Schedule', icon: Calendar },
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

              {/* AI SCREEN TAB */}
              {activeTab === 'ai-screen' && (
                <motion.div key="ai-screen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-4">

                  {!screened ? (
                    <div className="glass rounded-xl p-10 border border-white/10 flex flex-col items-center gap-5 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold mb-1">AI Candidate Screening</h3>
                        <p className="text-sm text-zinc-400 max-w-xs">Run an AI analysis of this candidate&apos;s resume against the job requirements. Get a match score, skill gap analysis, and suggested interview questions.</p>
                      </div>
                      <button onClick={runAiScreen} disabled={screeningLoading}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition">
                        {screeningLoading
                          ? <><RefreshCw className="w-4 h-4 animate-spin" />Analyzing…</>
                          : <><Sparkles className="w-4 h-4" />Run AI Screen</>}
                      </button>
                    </div>
                  ) : aiScreen && (
                    <>
                      {/* Score + recommendation */}
                      <div className="glass rounded-xl p-6 border border-white/10 flex items-center gap-6">
                        <div className="relative w-24 h-24 shrink-0">
                          <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                            <circle cx="18" cy="18" r="15.9" fill="none"
                              stroke={aiScreen.score >= 80 ? '#22c55e' : aiScreen.score >= 60 ? '#6366f1' : '#f43f5e'}
                              strokeWidth="3" strokeDasharray={`${aiScreen.score} 100`} strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl font-black">{aiScreen.score}</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Match Score</p>
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                              aiScreen.recommendation === 'Hire' ? 'bg-green-600/30 text-green-300 border border-green-500/40' :
                              aiScreen.recommendation === 'Maybe' ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/40' :
                              'bg-red-600/30 text-red-300 border border-red-500/40'
                            }`}>
                              {aiScreen.recommendation === 'Hire' ? '✓ Recommend Hire' :
                               aiScreen.recommendation === 'Maybe' ? '~ Consider' : '✗ Pass'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                            {aiScreen.aiEnhanced
                              ? <><Sparkles className="w-3 h-3 text-indigo-400" /><span className="text-indigo-400">AI-enhanced · computed at apply time</span></>
                              : <><span>ATS rule-based · computed at apply time</span></>
                            }
                          </p>
                        </div>
                        <button onClick={runAiScreen} disabled={screeningLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-zinc-400 hover:text-white transition">
                          {screeningLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Re-run
                        </button>
                      </div>

                      {/* AI Summary — recruiter executive brief */}
                      {aiScreen.aiSummary && (
                        <div className="glass rounded-xl p-5 border border-indigo-500/20 space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5" />Recruiter AI Brief
                          </h4>
                          <p className="text-sm text-zinc-200 leading-relaxed">{aiScreen.aiSummary}</p>
                        </div>
                      )}

                      {/* Matched + missing skills */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {aiScreen.matchedSkills?.length > 0 && (
                          <div className="glass rounded-xl p-5 border border-green-500/20">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-green-400 mb-3 flex items-center gap-2">
                              <Check className="w-3.5 h-3.5" />Matched Skills ({aiScreen.matchedSkills.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {aiScreen.matchedSkills.map((s: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 text-xs bg-green-500/10 border border-green-500/30 text-green-300 rounded-md font-mono">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {aiScreen.missingSkills?.length > 0 && (
                          <div className="glass rounded-xl p-5 border border-red-500/20">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-red-400 mb-3 flex items-center gap-2">
                              <XIcon className="w-3.5 h-3.5" />Skill Gaps ({aiScreen.missingSkills.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {aiScreen.missingSkills.map((s: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 text-xs bg-red-500/10 border border-red-500/30 text-red-300 rounded-md font-mono">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Strengths + Concerns */}
                      {(aiScreen.strengths?.length > 0 || aiScreen.concerns?.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {aiScreen.strengths?.length > 0 && (
                            <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5" />Strengths
                              </h4>
                              <ul className="space-y-2">
                                {aiScreen.strengths.map((s: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />{s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiScreen.concerns?.length > 0 && (
                            <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5" />Concerns
                              </h4>
                              <ul className="space-y-2">
                                {aiScreen.concerns.map((c: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                                    <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />{c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Optimization tips (from re-run AI screen, not pre-computed) */}
                      {aiScreen.optimizationTips?.length > 0 && !aiScreen.analysisTimestamp && (
                        <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5" />Recruiter Notes from AI
                          </h4>
                          <ul className="space-y-2">
                            {aiScreen.optimizationTips.map((tip: string, i: number) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300">
                                <ChevronRight className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Interview questions */}
                      {aiScreen.interviewQuestions?.length > 0 && (
                        <div className="glass rounded-xl p-5 border border-white/10 space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                            <MessageSquare className="w-3.5 h-3.5" />Suggested Interview Questions
                          </h4>
                          <div className="space-y-3">
                            {aiScreen.interviewQuestions.map((q: any, i: number) => (
                              <div key={i} className="p-3 bg-white/3 border border-white/8 rounded-lg">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wide">
                                    {q.category || `Q${i + 1}`}
                                  </span>
                                </div>
                                <p className="text-sm text-zinc-200">{q.question || q}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* SCHEDULE TAB */}
              {activeTab === 'schedule' && (
                <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="space-y-4">

                  {/* Schedule form */}
                  <div className="glass rounded-xl p-6 border border-white/10 space-y-5">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />Schedule Interview
                    </h3>
                    <form onSubmit={scheduleInterview} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Date + time */}
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-xs font-semibold text-zinc-400">Date & Time *</label>
                          <input type="datetime-local"
                            value={interviewForm.scheduledAt}
                            onChange={e => setInterviewForm(f => ({ ...f, scheduledAt: e.target.value }))}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 [color-scheme:dark]"
                            required />
                        </div>

                        {/* Duration */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-400">Duration</label>
                          <select value={interviewForm.duration}
                            onChange={e => setInterviewForm(f => ({ ...f, duration: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 [color-scheme:dark]">
                            <option value="30">30 minutes</option>
                            <option value="45">45 minutes</option>
                            <option value="60">60 minutes</option>
                            <option value="90">90 minutes</option>
                            <option value="120">2 hours</option>
                          </select>
                        </div>

                        {/* Type */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-400">Interview Type</label>
                          <select value={interviewForm.type}
                            onChange={e => setInterviewForm(f => ({ ...f, type: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 [color-scheme:dark]">
                            <option value="video">Video Call</option>
                            <option value="phone">Phone Screen</option>
                            <option value="technical">Technical Round</option>
                            <option value="onsite">On-site</option>
                            <option value="panel">Panel Interview</option>
                          </select>
                        </div>
                      </div>

                      {/* Meeting link */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                          <Link2 className="w-3 h-3" /> Meeting Link
                          <span className="text-zinc-600 font-normal">(optional)</span>
                        </label>
                        <input type="url"
                          value={interviewForm.meetingLink}
                          onChange={e => setInterviewForm(f => ({ ...f, meetingLink: e.target.value }))}
                          placeholder="https://meet.google.com/..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50" />
                      </div>

                      {/* Notes */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Notes for Candidate</label>
                        <textarea value={interviewForm.notes}
                          onChange={e => setInterviewForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Any preparation instructions or agenda…"
                          rows={3}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none" />
                      </div>

                      <button type="submit" disabled={schedulingInterview || !interviewForm.scheduledAt}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition">
                        {schedulingInterview
                          ? <><RefreshCw className="w-4 h-4 animate-spin" />Scheduling…</>
                          : <><Calendar className="w-4 h-4" />Schedule & Notify Candidate</>}
                      </button>
                    </form>
                  </div>

                  {/* Scheduled interviews list */}
                  <div className="glass rounded-xl p-6 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />Scheduled Interviews
                      </h3>
                      <button onClick={loadInterviews} className="text-zinc-500 hover:text-white transition">
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingInterviews ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    {loadingInterviews ? (
                      <div className="text-center py-6 text-zinc-500 text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" /> Loading…
                      </div>
                    ) : scheduledInterviews.length === 0 ? (
                      <div className="text-center py-8 text-zinc-600">
                        <Calendar className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">No interviews scheduled yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {scheduledInterviews.map((iv: any, i: number) => {
                          const dt = new Date(iv.scheduledAt ?? iv.scheduled_at ?? '');
                          const isPast = dt < new Date();
                          return (
                            <div key={iv.id ?? i} className={`p-4 rounded-lg border ${isPast ? 'border-white/8 bg-white/3' : 'border-purple-500/25 bg-purple-600/5'}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                      isPast ? 'bg-zinc-700 text-zinc-300' : 'bg-purple-600/30 text-purple-300 border border-purple-500/30'
                                    }`}>
                                      {iv.type || 'Interview'}
                                    </span>
                                    {isPast && <span className="text-[10px] text-zinc-500">Completed</span>}
                                  </div>
                                  <p className="text-sm font-semibold text-white">
                                    {dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  {iv.duration && <p className="text-xs text-zinc-500">{iv.duration} min</p>}
                                </div>
                                {iv.meetingLink && (
                                  <a href={iv.meetingLink} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg shrink-0 transition">
                                    <Video className="w-3 h-3" /> Join
                                  </a>
                                )}
                              </div>
                              {iv.notes && <p className="text-xs text-zinc-500 mt-2 leading-relaxed">{iv.notes}</p>}
                            </div>
                          );
                        })}
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
