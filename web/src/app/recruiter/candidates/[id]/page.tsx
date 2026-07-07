// src/app/recruiter/candidates/[id]/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import RecruiterLayout from "@/components/layout/RecruiterLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Mail, Phone, MapPin, Sparkles, Clock,
  AlertTriangle, ShieldAlert, CheckCircle, Award,
  Play, Pause, Volume2, UserCheck, FileText, Calendar,
  FileCheck, Shield, AlertCircle, Save, RefreshCw,
  XCircle, MessageSquare, ExternalLink
} from "lucide-react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast, Toaster } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE } from "@/lib/api";

export default function CandidateDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();

  const [candidate, setCandidate] = useState<any>(null);
  const [resumeData, setResumeData] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"resume" | "interview" | "verification" | "proctoring">("resume");
  const [recruiterNotes, setRecruiterNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        // Candidate profile from Firestore
        const userSnap = await getDoc(doc(db, "users", id as string));
        if (userSnap.exists()) {
          const d = userSnap.data();
          setCandidate({ id: id as string, ...d });
          setRecruiterNotes(d.recruiterNotes || "");
        }

        // Resume from backend
        const resumeRes = await fetch(`${API_BASE}/candidates/${id}/resume`, {
          headers: { Authorization: `Bearer ${await getToken()}` },
        });
        if (resumeRes.ok) {
          const rd = await resumeRes.json();
          setResumeData(rd.resumeData || null);
        }

        // Interview session
        const ivSnap = await getDoc(doc(db, "interviews", `${id}_ai_voice_round`));
        if (ivSnap.exists()) {
          const iv = ivSnap.data();
          setInterview({
            ...iv,
            startedAt: iv.startedAt?.toDate?.() || null,
            completedAt: iv.completedAt?.toDate?.() || null,
          });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load candidate data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateDoc(doc(db, "users", id as string), { recruiterNotes });
      toast.success("Notes saved.");
    } catch {
      toast.error("Failed to save notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  const shortlistAll = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/applications?candidateId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      await Promise.all((data.applications || []).map((a: any) =>
        fetch(`${API_BASE}/applications/${a.id}/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: "Shortlisted" }),
        })
      ));
      toast.success("Candidate shortlisted across all applications.");
    } catch {
      toast.error("Failed to update status.");
    }
  };

  const toggleAudio = (index: number, url: string) => {
    const audio = audioRefs.current[index];
    if (!audio) return;
    if (playingIndex === index) {
      audio.pause();
      setPlayingIndex(null);
    } else {
      if (playingIndex !== null && audioRefs.current[playingIndex]) {
        audioRefs.current[playingIndex]!.pause();
      }
      audio.play().catch(() => toast.error("Audio playback failed."));
      setPlayingIndex(index);
      audio.onended = () => setPlayingIndex(null);
    }
  };

  if (loading) return (
    <RecruiterLayout>
      <div className="flex items-center justify-center min-h-[70vh] flex-col gap-4 text-white">
        <RefreshCw className="w-10 h-10 animate-spin text-purple-400" />
        <p className="text-zinc-400 text-sm font-semibold animate-pulse">Loading candidate profile…</p>
      </div>
    </RecruiterLayout>
  );

  if (!candidate) return (
    <RecruiterLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-zinc-400">
        <AlertCircle className="w-10 h-10 text-zinc-600" />
        <p className="font-semibold">Candidate not found.</p>
        <Link href="/recruiter/candidates" className="text-purple-400 hover:underline text-sm">Back to Candidates</Link>
      </div>
    </RecruiterLayout>
  );

  const flatSkills: string[] = (() => {
    const skills = resumeData?.skills || [];
    return skills.flatMap((s: any) => {
      if (typeof s === "string") return [s];
      if (s.skills_list) return String(s.skills_list).split(",").map((x: string) => x.trim()).filter(Boolean);
      return [];
    });
  })();

  const experience: any[] = resumeData?.experience || [];
  const education: any[] = resumeData?.education || [];
  const summary: string = resumeData?.summary || "";
  const ivStatus: string = interview?.status || "";

  return (
    <RecruiterLayout>
      <Toaster position="top-right" richColors />
      <div className="min-h-screen pb-12 text-white space-y-6">

        <Link href="/recruiter/candidates" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition font-semibold">
          <ArrowLeft className="w-4 h-4" /> Back to Candidates
        </Link>

        {/* Header */}
        <div className="glass p-6 rounded-2xl border border-white/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-xl shadow-xl">
              {candidate.name?.split(" ").map((n: string) => n[0]).join("") || "C"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold">{candidate.name || "Candidate"}</h1>
                {ivStatus && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-md border font-bold ${
                    ivStatus === "flagged" ? "bg-rose-500/10 border-rose-500/30 text-rose-400" :
                    ivStatus === "completed" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                    "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                  }`}>
                    {ivStatus === "flagged" ? "⚠ Flagged" : ivStatus === "completed" ? "✔ Interview Done" : ivStatus}
                  </span>
                )}
              </div>
              <p className="text-zinc-300 text-sm">{candidate.targetRole || resumeData?.personal?.headline || "Candidate"}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-zinc-400">
                {candidate.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{candidate.email}</span>}
                {(candidate.phone || resumeData?.personal?.phone) && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{candidate.phone || resumeData.personal.phone}</span>}
                {(candidate.location || resumeData?.personal?.location) && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{candidate.location || resumeData.personal.location}</span>}
              </div>
            </div>
          </div>

          {interview?.overallScore != null && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 shrink-0">
              <div className="text-center">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block mb-1">AI Interview Score</span>
                <span className="text-3xl font-black text-purple-400">{interview.overallScore}%</span>
              </div>
              {interview.elapsedSeconds != null && (
                <>
                  <div className="h-10 w-px bg-white/10" />
                  <div>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block">Duration</span>
                    <span className="text-sm font-semibold">{Math.round(interview.elapsedSeconds / 60)} mins</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tabs + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">

            {/* Tab bar */}
            <div className="glass p-1.5 rounded-xl border border-white/10 flex gap-1.5 flex-wrap">
              {[
                { id: "resume", label: "Resume", icon: FileText },
                ...(interview ? [
                  { id: "interview", label: "AI Interview", icon: Volume2 },
                  { id: "verification", label: "Biometrics", icon: UserCheck },
                  { id: "proctoring", label: "Proctoring", icon: ShieldAlert },
                ] : []),
              ].map(({ id: tid, label, icon: Icon }) => (
                <button key={tid} onClick={() => setActiveTab(tid as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tid ? "bg-purple-600 text-white shadow" : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">

              {/* RESUME TAB */}
              {activeTab === "resume" && (
                <motion.div key="resume" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  {!resumeData ? (
                    <div className="glass rounded-xl p-10 border border-white/10 text-center text-zinc-400 space-y-3">
                      <FileText className="w-10 h-10 mx-auto text-zinc-600" />
                      <p className="font-semibold">No resume on file</p>
                      <p className="text-sm">This candidate hasn't uploaded and parsed a resume yet.</p>
                    </div>
                  ) : (
                    <>
                      {summary && (
                        <div className="glass rounded-xl p-5 border border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Summary</h3>
                          <p className="text-sm text-zinc-300 leading-relaxed">{summary}</p>
                        </div>
                      )}
                      {flatSkills.length > 0 && (
                        <div className="glass rounded-xl p-5 border border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {flatSkills.map((s, i) => (
                              <span key={i} className="px-2.5 py-1 text-xs font-mono bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-lg">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {experience.length > 0 && (
                        <div className="glass rounded-xl p-5 border border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-4">Experience</h3>
                          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                            {experience.map((exp: any, i: number) => (
                              <div key={i} className="pl-8 relative">
                                <div className="absolute left-2.5 top-1.5 w-2 h-2 rounded-full bg-purple-500 -translate-x-1/2" />
                                <p className="font-semibold text-sm">{exp.jobTitle || exp.title}</p>
                                <p className="text-xs text-purple-300">{exp.company}</p>
                                {exp.dates && <p className="text-xs text-zinc-500 font-mono">{exp.dates}</p>}
                                {exp.description && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{exp.description}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {education.length > 0 && (
                        <div className="glass rounded-xl p-5 border border-white/10">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-3">Education</h3>
                          <div className="space-y-3">
                            {education.map((edu: any, i: number) => (
                              <div key={i} className="flex justify-between items-start">
                                <div>
                                  <p className="font-semibold text-sm">{edu.degree}</p>
                                  <p className="text-xs text-purple-300">{edu.institution || edu.school}</p>
                                </div>
                                {(edu.graduationYear || edu.year) && <span className="text-xs text-zinc-500 font-mono">{edu.graduationYear || edu.year}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* INTERVIEW TAB */}
              {activeTab === "interview" && interview && (
                <motion.div key="interview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  {interview.overallFeedback && (
                    <div className="glass p-5 rounded-xl border border-purple-500/20 bg-purple-500/5">
                      <div className="flex gap-3">
                        <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-1">AI Executive Summary</h3>
                          <p className="text-sm text-purple-100 italic leading-relaxed">"{interview.overallFeedback}"</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-4">
                    {(interview.responses || interview.conversationHistory || []).map((turn: any, i: number) => (
                      <div key={i} className="space-y-3">
                        {turn.questionText && (
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-w-[85%] text-sm text-zinc-200">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">AI Question</span>
                            {turn.questionText}
                          </div>
                        )}
                        {turn.transcript && (
                          <div className="ml-auto bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 max-w-[85%]">
                            <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-white/5">
                              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Candidate Answer</span>
                              <div className="flex items-center gap-2">
                                {turn.audioUrl ? (
                                  <>
                                    <audio ref={el => { audioRefs.current[i] = el; }} src={turn.audioUrl} preload="none" />
                                    <button onClick={() => toggleAudio(i, turn.audioUrl)}
                                      className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-md py-0.5 px-2 text-[10px] hover:bg-white/10 transition text-zinc-300 font-mono">
                                      {playingIndex === i ? <><Pause className="w-2.5 h-2.5 text-red-400 animate-pulse" />Pause</> : <><Play className="w-2.5 h-2.5 text-purple-400" />Listen</>}
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[9px] text-zinc-600 font-mono">No audio</span>
                                )}
                                {turn.durationSeconds && <span className="text-[9px] text-zinc-500 font-mono">{turn.durationSeconds}s</span>}
                              </div>
                            </div>
                            <p className="text-sm text-purple-100 italic leading-relaxed">"{turn.transcript}"</p>
                            {(turn.aiScore != null || turn.aiFeedback) && (
                              <div className="mt-3 bg-zinc-950/40 border border-white/5 rounded-xl p-3 space-y-1">
                                {turn.aiScore != null && (
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-400">Response Score</span>
                                    <span className={`font-mono font-bold ${turn.aiScore >= 85 ? "text-emerald-400" : "text-yellow-400"}`}>{turn.aiScore}/100</span>
                                  </div>
                                )}
                                {turn.aiFeedback && <p className="text-xs text-zinc-300 leading-relaxed"><strong className="text-purple-300">Critique:</strong> {turn.aiFeedback}</p>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* VERIFICATION TAB */}
              {activeTab === "verification" && interview && (
                <motion.div key="verification" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  {!interview.verification ? (
                    <div className="glass rounded-xl p-10 border border-white/10 text-center text-zinc-400">
                      <UserCheck className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
                      <p>No biometric verification data found.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {interview.verification.stateIdUrl && (
                          <div className="glass rounded-2xl overflow-hidden border border-white/10">
                            <div className="bg-white/5 py-2 px-4 border-b border-white/10 text-xs font-mono text-zinc-300 flex items-center justify-between">
                              Government ID <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                            </div>
                            <img src={interview.verification.stateIdUrl} alt="ID" className="w-full object-cover aspect-video" />
                          </div>
                        )}
                        {interview.verification.selfieUrl && (
                          <div className="glass rounded-2xl overflow-hidden border border-white/10">
                            <div className="bg-white/5 py-2 px-4 border-b border-white/10 text-xs font-mono text-zinc-300 flex items-center justify-between">
                              Webcam Selfie <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                            </div>
                            <img src={interview.verification.selfieUrl} alt="Selfie" className="w-full object-cover aspect-video" />
                          </div>
                        )}
                      </div>
                      <div className="glass p-5 rounded-xl border border-white/10">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="text-center">
                            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Face Match Score</p>
                            <p className="text-3xl font-black text-purple-400">{interview.verification.faceMatchScore ?? '—'}%</p>
                          </div>
                          <div className="flex-1 space-y-2">
                            {(interview.verification.verificationLogs || []).map((log: string, i: number) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{log}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* PROCTORING TAB */}
              {activeTab === "proctoring" && interview && (
                <motion.div key="proctoring" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  {!interview.proctoringViolations ? (
                    <div className="glass rounded-xl p-10 border border-white/10 text-center text-zinc-400">
                      <Shield className="w-10 h-10 mx-auto text-zinc-600 mb-3" />
                      <p>No proctoring data recorded.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="glass p-4 rounded-xl border border-white/10 text-center">
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Tab Switches</p>
                          <p className={`text-4xl font-extrabold font-mono ${(interview.proctoringViolations.tabSwitchesCount || 0) > 2 ? "text-rose-400" : "text-zinc-200"}`}>
                            {interview.proctoringViolations.tabSwitchesCount || 0}
                          </p>
                          <p className="text-[9px] text-zinc-500 font-mono mt-1">Max Allowed: 2</p>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/10 text-center">
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Fullscreen Exits</p>
                          <p className="text-4xl font-extrabold font-mono text-zinc-200">{interview.proctoringViolations.fullscreenExitsCount || 0}</p>
                        </div>
                        <div className="glass p-4 rounded-xl border border-white/10 text-center">
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Audio Loopbacks</p>
                          <p className={`text-sm font-extrabold uppercase py-3 ${interview.proctoringViolations.virtualAudioDetected ? "text-rose-400" : "text-emerald-400"}`}>
                            {interview.proctoringViolations.virtualAudioDetected ? "⚠ Detected" : "✔ Clean"}
                          </p>
                        </div>
                      </div>
                      {(interview.proctoringViolations.cheatingFlags?.length > 0) && (
                        <div className="glass p-5 rounded-xl border border-rose-500/20 bg-rose-500/5">
                          <h4 className="text-sm font-bold text-rose-400 mb-3 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Violation Logs</h4>
                          <ul className="space-y-2">
                            {interview.proctoringViolations.cheatingFlags.map((flag: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 bg-black/30 border border-white/5 p-2 rounded-lg text-xs text-zinc-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />{flag}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Recruiting decision */}
            <div className="glass p-5 rounded-2xl border border-white/10 space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Recruiting Decision</h4>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={shortlistAll}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition">
                  Approve / Shortlist
                </button>
                <Link href={`/recruiter/applications`}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2 px-3 rounded-lg text-xs transition border border-white/10 text-center">
                  View Applications
                </Link>
              </div>
            </div>

            {/* Links */}
            <div className="glass p-5 rounded-2xl border border-white/10 space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Quick Links</h4>
              <Link href={`/profile/${id}`} className="flex items-center justify-between text-sm text-purple-300 hover:text-purple-200 transition py-1">
                Public Profile <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Link href={`/recruiter/messages`} className="flex items-center justify-between text-sm text-indigo-300 hover:text-indigo-200 transition py-1">
                Send Message <MessageSquare className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Recruiter notes */}
            <div className="glass p-5 rounded-2xl border border-white/10 space-y-3">
              <h4 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-purple-400" /> Recruiter Notes
              </h4>
              <textarea
                value={recruiterNotes}
                onChange={e => setRecruiterNotes(e.target.value)}
                placeholder="Add private notes about this candidate…"
                rows={5}
                className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              />
              <button onClick={saveNotes} disabled={savingNotes}
                className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition">
                {savingNotes ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Saving…</> : <><Save className="w-3.5 h-3.5" />Save Notes</>}
              </button>
            </div>

          </div>
        </div>
      </div>
    </RecruiterLayout>
  );
}
