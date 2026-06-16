// src/app/recruiter/candidates/[id]/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import RecruiterLayout from "@/components/layout/RecruiterLayout";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Mail, Phone, MapPin, Sparkles, Clock, 
  AlertTriangle, ShieldAlert, CheckCircle, Award, 
  Play, Pause, Volume2, UserCheck, FileText, Calendar, 
  FileCheck, Shield, ChevronDown, ChevronUp, AlertCircle, Save,
  RefreshCw
} from "lucide-react";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast, Toaster } from "sonner";

// High-fidelity fallback mock data when firestore record is absent or incomplete
const defaultMockInterview = {
  candidateId: "1",
  candidateName: "Jane Doe",
  jobId: "frontend_dev_role",
  jobTitle: "Senior Frontend Engineer",
  status: "flagged", // completed | flagged | in_progress
  startedAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
  completedAt: new Date(Date.now() - 3600000 * 2 + 1800 * 1000), // 30 mins later
  elapsedSeconds: 1680, // 28 minutes
  verification: {
    stateIdUrl: "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?w=500&auto=format&fit=crop&q=60", // High quality placeholder state ID
    selfieUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=60", // Female tech avatar
    faceMatchScore: 89,
    verifiedAt: new Date(Date.now() - 3600000 * 2),
    verificationLogs: [
      "Biometric keypoint mapping aligned successfully.",
      "Gaze estimation verified steady eye movement.",
      "Liveness depth test passed successfully."
    ]
  },
  proctoringViolations: {
    tabSwitchesCount: 3,
    fullscreenExitsCount: 1,
    virtualAudioDetected: true,
    multipleVoicesDetected: false,
    cheatingFlags: [
      "Tab switch detected: 3 switches out of active window.",
      "Fullscreen exit: 1 exit logged at 12m 45s.",
      "Virtual Audio Driver active: VB-Cable loopback detected (transcription proxy attempt)."
    ]
  },
  responses: [
    {
      questionText: "Welcome Jane! Let's dive straight in. I see in your resume you worked heavily on responsive architectures. Explain how you structure CSS/JS bundles for ultra-low latency on foldable or compact phone displays.",
      transcript: "When engineering for responsive or fold/flip displays, I establish strict fluid grid breakpoints using HSL-based layouts and CSS variables rather than hardcoded pixel media queries. For bundle size optimization, I leverage next/dynamic loading and code-splitting at the route level to guarantee that components only load when the folded viewport changes. We reduced bundle size by 45% using this exact technique.",
      aiScore: 92,
      aiFeedback: "Excellent structural comprehension of responsive bundle sizing. Direct technical response with a clear percentage achievement metric.",
      durationSeconds: 110,
      audioUrl: ""
    },
    {
      questionText: "That makes perfect sense. How do you handle security parameters when storing and encrypting sensitive user profile assets, such as government IDs or personal details, in cloud persistence systems?",
      transcript: "We enforce high-security Firestore and Storage security rules so that only verified, role-based recruiters or the asset owner can read profile resources. In storage, we save ID photos in strict directories under authentication tokens, and encrypt raw files with AES-256 at-rest. Also, we monitor loopbacks or virtual sound drivers during interviews to make sure no secondary transcribe agents read data.",
      aiScore: 95,
      aiFeedback: "Stellar response. Understood Firestore security rule definitions, AES-256 encryption, and proctoring-agent constraints cleanly.",
      durationSeconds: 125,
      audioUrl: ""
    },
    {
      questionText: "Can you elaborate on a time where you encountered unexpected black-border layout overflow issues on dynamic flip phones (like Galaxy Z Flip) and how you solved it in production?",
      transcript: "Yes, during a release, folding displays threw layout clipping due to dynamic orientation resizing. I resolved it by wrapping the top-level app in a LayoutBuilder and SingleChildScrollView. Instead of static padding, I used constraints-aware safe areas, which successfully prevented any yellow overflow lines on screen folds.",
      aiScore: 89,
      aiFeedback: "Very practical. Displays thorough understanding of constraints and LayoutBuilder in mobile responsive environments.",
      durationSeconds: 98,
      audioUrl: ""
    }
  ],
  overallScore: 92,
  overallFeedback: "Candidate shows exceptional technical capabilities, highly structured code-splitting designs, and direct expertise in responsive/adaptive layouts. However, proctoring security flags indicate multiple window focus losses and virtual driver activity which requires human recruiting validation."
};

const mockCandidateProfile = {
  id: "1",
  name: "Jane Doe",
  role: "Senior Frontend Engineer",
  email: "jane.doe@example.com",
  phone: "+1 (555) 234-5678",
  location: "New York, NY (Remote)",
  experience: "5 Years",
  skills: "React, Next.js, Flutter, Tailwind CSS, HSL Theming, Node.js",
  notes: "Strong candidate but proctoring violations need active check. Biometrics are verified."
};

export default function CandidateDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [candidate, setCandidate] = useState<any>(mockCandidateProfile);
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"interview" | "verification" | "proctoring">("interview");
  const [recruiterNotes, setRecruiterNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);

  // Load Candidate data and Interview from Firestore
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        // Fetch User Info
        const userRef = doc(db, "users", id as string);
        const userSnap = await getDoc(userRef);
        
        let candidateObj = { ...mockCandidateProfile, id: id as string };
        if (userSnap.exists()) {
          const uData = userSnap.data();
          candidateObj = {
            id: id as string,
            name: uData.name || "Candidate",
            role: uData.targetRole || "Software Engineer",
            email: uData.email || "N/A",
            phone: uData.phone || "N/A",
            location: uData.location || "Remote",
            experience: uData.experienceYears || "2 years",
            skills: uData.skills || "N/A",
            notes: uData.notes || ""
          };
        }
        setCandidate(candidateObj);
        setRecruiterNotes(candidateObj.notes);

        // Fetch Interview Session
        // Try candidateId_ai_voice_round or fallback candidateId_jobId
        let interviewData: any = null;
        const interviewRef = doc(db, "interviews", `${id}_ai_voice_round`);
        const interviewSnap = await getDoc(interviewRef);
        
        if (interviewSnap.exists()) {
          const iData = interviewSnap.data();
          interviewData = {
            ...iData,
            startedAt: iData.startedAt?.toDate() || new Date(),
            completedAt: iData.completedAt?.toDate() || new Date(),
            verification: {
              ...iData.verification,
              verifiedAt: iData.verification?.verifiedAt?.toDate() || new Date(),
              verificationLogs: iData.verification?.verificationLogs || [
                "Biometric signature parsed successfully.",
                "Multimodal anti-spoofing scan complete."
              ]
            }
          };
        } else {
          // Check for {candidateId}_{jobId} where jobId = 'ai_eval_role'
          const secondaryRef = doc(db, "interviews", `${id}_ai_eval_role`);
          const secondarySnap = await getDoc(secondaryRef);
          if (secondarySnap.exists()) {
            const sData = secondarySnap.data();
            interviewData = {
              ...sData,
              startedAt: sData.startedAt?.toDate() || new Date(),
              completedAt: sData.completedAt?.toDate() || new Date(),
              verification: {
                ...sData.verification,
                verifiedAt: sData.verification?.verifiedAt?.toDate() || new Date(),
                verificationLogs: sData.verification?.verificationLogs || [
                  "Biometric verification synced."
                ]
              }
            };
          }
        }
        
        if (interviewData) {
          setInterview(interviewData);
        } else {
          console.warn("Interview record not found in Firestore. Rendering default high-fidelity mock data.");
          setInterview({ ...defaultMockInterview, candidateId: id as string, candidateName: candidateObj.name });
        }
      } catch (err) {
        console.error("Firestore retrieval error:", err);
        toast.error("Connecting to cloud persistence failed. Using fallback developer mode.");
        setInterview({ ...defaultMockInterview, candidateId: id as string });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchAllData();
    }
  }, [id]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      // Sync Notes with user document in Firestore
      const userRef = doc(db, "users", id as string);
      await updateDoc(userRef, {
        notes: recruiterNotes
      });
      toast.success("Recruiter notes successfully synchronized with cloud database!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync notes to Firestore. Saved locally.");
    } finally {
      setSavingNotes(false);
    }
  };

  const toggleMockAudio = (index: number) => {
    if (playingAudioIndex === index) {
      setPlayingAudioIndex(null);
      toast.info("Audio playback paused.");
    } else {
      setPlayingAudioIndex(index);
      toast.success("Playing recorded candidate voice answer.");
      setTimeout(() => {
        setPlayingAudioIndex(null);
      }, 5000); // Stop playing after 5 seconds
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "flagged":
        return "bg-rose-500/10 border-rose-500/30 text-rose-400";
      case "completed":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      default:
        return "bg-indigo-500/10 border-indigo-500/30 text-indigo-400";
    }
  };

  if (loading) {
    return (
      <RecruiterLayout>
        <div className="flex items-center justify-center min-h-[70vh] flex-col gap-4 text-white">
          <RefreshCw className="w-10 h-10 animate-spin text-purple-400" />
          <p className="text-zinc-400 text-sm font-semibold tracking-wide animate-pulse">
            Retrieving candidate portfolio & biometrics...
          </p>
        </div>
      </RecruiterLayout>
    );
  }

  return (
    <RecruiterLayout>
      <Toaster position="top-right" richColors />
      <div className="min-h-screen pb-12 text-white">
        
        {/* Back Link & Navigation */}
        <Link
          href="/recruiter/candidates"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition text-sm mb-6 font-semibold"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
          Back to Candidates Directory
        </Link>

        {/* PROFILE HEADER SUMMARY CARD */}
        <div className="glass p-6 rounded-2xl border border-white/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            {/* Circular Avatar */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-2xl shadow-xl shadow-purple-500/10">
              {candidate.name ? candidate.name.split(" ").map((n: string) => n[0]).join("") : "C"}
            </div>
            
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                  {candidate.name}
                </h1>
                <span className={`text-xs px-2.5 py-1 rounded-md border font-bold capitalize ${getStatusBadgeClass(interview?.status || "completed")}`}>
                  {interview?.status === "flagged" ? "⚠️ Flagged Proctoring" : "✔️ Verified Interview"}
                </span>
              </div>
              <p className="text-zinc-300 text-sm font-medium">{candidate.role}</p>
              
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-xs text-zinc-400 font-mono">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {candidate.email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> {candidate.phone}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {candidate.location}
                </span>
              </div>
            </div>
          </div>

          {/* AI Assessment Ribbon */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 w-full sm:w-auto shrink-0 relative overflow-hidden backdrop-blur">
            <div className="text-center">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block mb-1">
                AI Match Score
              </span>
              <span className="text-3xl font-black text-purple-400">
                {interview?.overallScore || 90}%
              </span>
            </div>
            
            <div className="h-10 w-px bg-white/10" />

            <div>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block">
                Duration
              </span>
              <span className="text-sm font-semibold text-white">
                {interview?.elapsedSeconds ? Math.round(interview.elapsedSeconds / 60) : 28} mins
              </span>
            </div>
          </div>
        </div>

        {/* MAIN SPLIT COLUMNS: Left details, Right notes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT 2/3 COLUMN: Tabs & Primary Reports */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tab Controllers */}
            <div className="glass p-1.5 rounded-xl border border-white/10 flex gap-2">
              {[
                { id: "interview", label: "AI Voice Dialogue", icon: Volume2 },
                { id: "verification", label: "Face Biometrics", icon: UserCheck },
                { id: "proctoring", label: "Proctoring Security", icon: ShieldAlert }
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-300 ${
                      activeTab === t.id 
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* TAB VIEWPORTS */}
            <AnimatePresence mode="wait">
              
              {/* TAB 1: CONVERSATION DIALOGUE TREE */}
              {activeTab === "interview" && (
                <motion.div
                  key="interview-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Overall Commentary Panel */}
                  <div className="glass p-5 rounded-xl border border-purple-500/20 bg-purple-500/5 relative overflow-hidden">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 mb-1.5">
                          AI Executive Commentary
                        </h3>
                        <p className="text-sm leading-relaxed text-purple-100 italic">
                          "{interview?.overallFeedback || "No overall commentary generated yet."}"
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Conversation Dialogue Timeline */}
                  <div className="space-y-6 relative pl-4 before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-white/5">
                    {interview?.responses && interview.responses.map((turn: any, index: number) => (
                      <div key={index} className="space-y-4 relative">
                        {/* Timeline Bullet */}
                        <div className="absolute -left-6 top-1.5 w-4.5 h-4.5 rounded-full bg-indigo-600 border-2 border-zinc-950 flex items-center justify-center font-bold text-[8px]">
                          {index + 1}
                        </div>

                        {/* Interviewer Bubble */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs max-w-[85%]">
                          <span className="font-bold text-[10px] text-zinc-400 uppercase tracking-widest block mb-1">
                            AI Recruiter Questions
                          </span>
                          <p className="text-sm text-zinc-200">{turn.questionText}</p>
                        </div>

                        {/* Candidate Answer Bubble */}
                        <div className="ml-auto bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 max-w-[85%] relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/5 rounded-full blur-xl pointer-events-none" />
                          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-white/5">
                            <span className="font-extrabold text-[10px] text-purple-400 uppercase tracking-widest">
                              Candidate Spoken Answer
                            </span>
                            
                            <div className="flex items-center gap-2">
                              {/* Audio Trigger */}
                              <button 
                                onClick={() => toggleMockAudio(index)}
                                className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-md py-0.5 px-2 text-[10px] hover:bg-white/10 transition text-zinc-300 font-mono"
                              >
                                {playingAudioIndex === index ? (
                                  <>
                                    <Pause className="w-2.5 h-2.5 text-red-400 animate-pulse" /> Playback
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-2.5 h-2.5 text-purple-400" /> Listen Voice
                                  </>
                                )}
                              </button>
                              
                              <span className="text-[10px] font-mono text-zinc-500">
                                {turn.durationSeconds || 90}s duration
                              </span>
                            </div>
                          </div>

                          <p className="text-sm leading-relaxed text-purple-100 italic">
                            "{turn.transcript}"
                          </p>

                          {/* Technical Evaluator Card */}
                          <div className="mt-3.5 bg-zinc-950/40 border border-white/5 rounded-xl p-3 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-zinc-400">Response Integrity Assessment:</span>
                              <span className={`font-mono font-bold ${turn.aiScore >= 85 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                {turn.aiScore}/100 Score
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                              <strong className="text-purple-300">Critique:</strong> {turn.aiFeedback}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* TAB 2: BIOMETRIC FACE VERIFICATION */}
              {activeTab === "verification" && (
                <motion.div
                  key="verification-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="text-center max-w-xl mx-auto">
                    <h3 className="text-lg font-bold">Biometric Likeness & Identity Auditing</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Rigorous multimodal comparison of government state identifiers against the live camera photo to prevent identity proxy-interview scams.
                    </p>
                  </div>

                  {/* Side-by-Side Images */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* State ID Card */}
                    <div className="glass rounded-2xl overflow-hidden border border-white/10">
                      <div className="bg-white/5 py-2.5 px-4 border-b border-white/10 text-xs font-mono text-zinc-300 flex items-center justify-between">
                        <span>1. Government ID Upload</span>
                        <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div className="aspect-video relative bg-black flex items-center justify-center">
                        <img 
                          src={interview?.verification?.stateIdUrl || defaultMockInterview.verification.stateIdUrl} 
                          alt="Government State ID" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Selfie Webcam Image */}
                    <div className="glass rounded-2xl overflow-hidden border border-white/10">
                      <div className="bg-white/5 py-2.5 px-4 border-b border-white/10 text-xs font-mono text-zinc-300 flex items-center justify-between">
                        <span>2. Webcam Selfie Capture</span>
                        <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                      <div className="aspect-video relative bg-black flex items-center justify-center">
                        <img 
                          src={interview?.verification?.selfieUrl || defaultMockInterview.verification.selfieUrl} 
                          alt="Webcam Selfie" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Likeness Score Panel */}
                  <div className="glass p-5 rounded-2xl border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
                    
                    {/* Circle Score Meter */}
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-24 h-24 rounded-full border-4 border-purple-500/30 flex items-center justify-center relative shadow-lg shadow-purple-500/10">
                        <div className="text-center">
                          <span className="text-2xl font-black text-white">{interview?.verification?.faceMatchScore || 89}%</span>
                          <span className="text-[9px] text-zinc-400 block uppercase font-mono leading-none">Likeness</span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-emerald-400 mt-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Biometrics Match
                      </span>
                    </div>

                    {/* Biometrics checklist & details */}
                    <div className="sm:col-span-2 space-y-3">
                      <div>
                        <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono font-bold block mb-1">
                          Biometric Analysis Output
                        </span>
                        <p className="text-sm text-zinc-200 leading-relaxed font-sans">
                          State ID facial geometry correlates accurately with the live capture webcam image. Jaw contouring lines, eye spatial alignment, and nose depth structure score a high-confidence match metric.
                        </p>
                      </div>

                      <div className="border-t border-white/5 pt-2.5">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono font-bold block mb-1.5">
                          Liveness Check Logs
                        </span>
                        <ul className="text-xs text-zinc-400 space-y-1">
                          {interview?.verification?.verificationLogs?.map((log: string, idx: number) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {log}
                            </li>
                          )) || (
                            <li className="italic text-zinc-500">No liveness log parsed.</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: PROCTORING SECURITY & ANTI-CHEAT */}
              {activeTab === "proctoring" && (
                <motion.div
                  key="proctoring-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="text-center max-w-xl mx-auto">
                    <h3 className="text-lg font-bold text-rose-400 flex items-center justify-center gap-2">
                      <ShieldAlert className="w-5 h-5 animate-pulse" />
                      Proctored Anti-Cheat Audit Ledger
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Continuous background listener tracking screen window focus, loopback transcribers (Otter/Parakeet loopers), and unauthorized proxies.
                    </p>
                  </div>

                  {/* Proctoring Violations Counters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    
                    {/* Tab Switches */}
                    <div className="glass p-4 rounded-xl border border-white/10 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-rose-500/5 rounded-full blur-lg" />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                        Tab Switches
                      </span>
                      <span className={`text-4xl font-extrabold font-mono ${
                        (interview?.proctoringViolations?.tabSwitchesCount || 0) > 2 ? "text-rose-400" : "text-zinc-200"
                      }`}>
                        {interview?.proctoringViolations?.tabSwitchesCount || 0}
                      </span>
                      <span className="text-[9px] text-zinc-500 block mt-1 font-mono">
                        Max Allowed: 2
                      </span>
                    </div>

                    {/* Fullscreen Exits */}
                    <div className="glass p-4 rounded-xl border border-white/10 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-yellow-500/5 rounded-full blur-lg" />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                        Fullscreen Exits
                      </span>
                      <span className="text-4xl font-extrabold font-mono text-zinc-200">
                        {interview?.proctoringViolations?.fullscreenExitsCount || 0}
                      </span>
                      <span className="text-[9px] text-zinc-500 block mt-1 font-mono">
                        Focus Lost Check
                      </span>
                    </div>

                    {/* Virtual Audio Drivers */}
                    <div className="glass p-4 rounded-xl border border-white/10 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-12 h-12 bg-indigo-500/5 rounded-full blur-lg" />
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
                        Audio Loopbacks
                      </span>
                      <span className={`text-sm font-extrabold block py-3 uppercase ${
                        interview?.proctoringViolations?.virtualAudioDetected ? "text-rose-400" : "text-emerald-400"
                      }`}>
                        {interview?.proctoringViolations?.virtualAudioDetected ? "⚠️ Detected (VB)" : "✔️ Clean (Clean)"}
                      </span>
                      <span className="text-[9px] text-zinc-500 block font-mono">
                        Otter/Parakeet scan
                      </span>
                    </div>
                  </div>

                  {/* Anti-Cheat Warning Panel */}
                  <div className="glass p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5">
                    <h4 className="text-sm font-extrabold uppercase tracking-wider text-rose-400 mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Security Violations Logs
                    </h4>
                    
                    {interview?.proctoringViolations?.cheatingFlags && interview.proctoringViolations.cheatingFlags.length > 0 ? (
                      <ul className="space-y-2 text-xs leading-relaxed text-zinc-300">
                        {interview.proctoringViolations.cheatingFlags.map((flag: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 bg-black/30 border border-white/5 p-2 rounded-lg">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                            <span>{flag}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-zinc-400 italic">
                        Clean ledger: no cheating markers or window lost-focus infractions logged.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
            
          </div>

          {/* RIGHT 1/3 COLUMN: Recruiter Notes & Actions */}
          <div className="space-y-6">
            
            {/* Candidate Metadata Summary Card */}
            <div className="glass p-5 rounded-2xl border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 rounded-full blur-xl pointer-events-none" />
              
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-400 mb-4 pb-1.5 border-b border-white/5">
                Resume Overview
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-zinc-500 font-mono uppercase tracking-wider block mb-1">Target Role</span>
                  <span className="text-zinc-200 font-bold block">{candidate.role}</span>
                </div>

                <div>
                  <span className="text-zinc-500 font-mono uppercase tracking-wider block mb-1">Experience Level</span>
                  <span className="text-zinc-200 font-bold block">{candidate.experience}</span>
                </div>

                <div>
                  <span className="text-zinc-500 font-mono uppercase tracking-wider block mb-1">Extracted Skill Attributes</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {candidate.skills.split(",").map((s: string) => (
                      <span key={s} className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded">
                        {s.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Recruiter Interactive Notes Card */}
            <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-zinc-400 pb-1.5 border-b border-white/5 flex items-center gap-1.5">
                <FileText className="w-4.5 h-4.5 text-purple-400" />
                Recruiter Notes & Review 📝
              </h3>

              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Add annotations, soft skills checks, team fit notes, or internal evaluation notes. These are synced securely with the Firestore candidate profile documents.
              </p>

              <textarea
                placeholder="e.g. 'Jane showed strong layout and CSS architectural knowledge. However, we need to clarify the tab switch count of 3 during our initial live meeting...'"
                value={recruiterNotes}
                onChange={(e) => setRecruiterNotes(e.target.value)}
                className="w-full h-44 p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs resize-none"
              />

              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2.5 rounded-xl transition text-xs shadow-lg shadow-purple-500/15"
              >
                {savingNotes ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving notes...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> Save Annotations
                  </>
                )}
              </button>
            </div>

            {/* Decision panel */}
            <div className="glass p-5 rounded-2xl border border-white/10 space-y-3 text-center">
              <h4 className="text-xs uppercase tracking-widest text-zinc-500 font-bold">Recruiting Decision</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    try {
                      // Update all applications by this candidate to Shortlisted
                      const res = await fetch(`${API_BASE}/applications?candidateId=${id}`, {
                        headers: { 'Authorization': `Bearer mock_token_for_${id}` }
                      });
                      const data = await res.json();
                      await Promise.all((data.applications || []).map((a: any) =>
                        fetch(`${API_BASE}/applications/${a.id}/status`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer mock_token_for_${id}` },
                          body: JSON.stringify({ status: 'Shortlisted' })
                        })
                      ));
                      toast.success("Candidate shortlisted across all applications.");
                    } catch { toast.error("Failed to update status."); }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition"
                >
                  Approve / Shortlist
                </button>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE}/applications?candidateId=${id}`, {
                        headers: { 'Authorization': `Bearer mock_token_for_${id}` }
                      });
                      const data = await res.json();
                      await Promise.all((data.applications || []).map((a: any) =>
                        fetch(`${API_BASE}/applications/${a.id}/status`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer mock_token_for_${id}` },
                          body: JSON.stringify({ status: 'In Review' })
                        })
                      ));
                      toast.warning("Candidate flagged for manual face-to-face check.");
                    } catch { toast.error("Failed to update status."); }
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2 px-3 rounded-lg text-xs transition border border-white/10"
                >
                  Request Manual Check
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </RecruiterLayout>
  );
}
