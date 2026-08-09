'use client';

export const dynamic = 'force-dynamic';

// src/app/candidate/interview/page.tsx
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, FileCheck, ShieldAlert, Volume2, Mic,
  AlertTriangle, CheckCircle, Award, Clock, ArrowRight, UserCheck
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { doc, setDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { API_BASE } from '@/lib/api';

type InterviewResponse = {
  questionText: string;
  transcript: string;
  aiScore: number;
  aiFeedback: string;
};

class InterviewApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'InterviewApiError';
  }
}

async function readInterviewResponse(response: Response): Promise<Record<string, any>> {
  const body = await response.text();
  let payload: Record<string, any> = {};

  if (body) {
    try {
      payload = JSON.parse(body);
    } catch {
      throw new InterviewApiError(
        response.ok ? 'The interview service returned an invalid response.' : `The interview service is unavailable (${response.status}).`,
        response.status,
      );
    }
  }

  if (!response.ok) {
    throw new InterviewApiError(payload.message || payload.error || `The interview service is unavailable (${response.status}).`, response.status);
  }
  return payload;
}

// --- UI Primitive Component ---
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'destructive', size?: 'default' | 'sm', as?: React.ElementType }>(({ children, variant, size, className, as: Component = 'button', ...props }, ref) => {
    const baseStyle = "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] disabled:opacity-50 disabled:pointer-events-none";
    const variantStyles = { default: "cc-btn-primary", outline: "cc-btn-ghost", destructive: "bg-rose-600 text-white hover:bg-rose-700" };
    const sizeStyles = { default: "h-10 py-2 px-4", sm: "h-9 px-3" };
    return <Component ref={ref} className={`${baseStyle} ${variantStyles[variant || 'default']} ${sizeStyles[size || 'default']} ${className}`} {...props}>{children}</Component>;
});
Button.displayName = 'Button';

function CandidateInterviewContent() {
  const { isAuthenticated, user, getToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('applicationId');

  // Job interview context (populated when applicationId is present)
  const [interviewContext, setInterviewContext] = useState<{
    applicationId: string;
    jobTitle: string;
    company: string;
    topics: string[];
    description: string;
    mode: string;
  } | null>(null);
  const [contextResume, setContextResume] = useState<any>(null);
  const [contextLoading, setContextLoading] = useState(!!applicationId);

  // State variables
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  
  // Verification uploads
  const [stateIdFile, setStateIdFile] = useState<File | null>(null);
  const [stateIdPreview, setStateIdPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [identityConsent, setIdentityConsent] = useState(false);
  
  // Proctoring States
  const [virtualAudioChecked, setVirtualAudioChecked] = useState(false);
  const [sysCheckPassed, setSysCheckPassed] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Voice Arena States
  const [conversation, setConversation] = useState<any[]>([]);
  const [responses, setResponses] = useState<InterviewResponse[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState("");
  const [timer, setTimer] = useState(1800); // 30 mins in seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [interviewId, setInterviewId] = useState("");
  
  // Scorecard / Assessment States
  const [scorecard, setScorecard] = useState<any>(null);
  
  // Webcam elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const fullscreenExitCountRef = useRef(0);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

  // 30-minute Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0 && isTimerRunning) {
      handleCompleteInterview();
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  useEffect(() => {
    const syncFullscreenState = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (step === 3 && !active) {
        const next = fullscreenExitCountRef.current + 1;
        fullscreenExitCountRef.current = next;
        toast.warning(`Fullscreen exited. This focus event has been logged. (${next})`);
        logProctoringEvent('fullscreen_exit', next);
      }
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, [step]);

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => () => {
    if (stateIdPreview) URL.revokeObjectURL(stateIdPreview);
  }, [stateIdPreview]);

  useEffect(() => () => {
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
  }, [selfiePreview]);

  // Tab switch detection (Proctoring)
  useEffect(() => {
    if (step === 3) {
      const handleVisibilityChange = async () => {
        if (document.hidden) {
          setTabSwitches(prev => {
            const newVal = prev + 1;
            toast.warning(`Tab switch detected! This violation has been logged. (${newVal}/3)`);
            logProctoringEvent('tab_switch', newVal);
            return newVal;
          });
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }, [step]);

  // Auth Protection
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router, authLoading]);

  // Load job context from applicationId query param
  useEffect(() => {
    if (!applicationId || authLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const [appResp, ] = await Promise.all([
          fetch(`${API_BASE}/applications/${applicationId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        if (!appResp.ok) throw new Error('Could not load application');
        const appData = await appResp.json();
        const app = appData.application ?? appData;

        // Fetch job details
        const jobId = app.jobId || app.job_id;
        let jobData: any = {};
        if (jobId) {
          const jobResp = await fetch(`${API_BASE}/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (jobResp.ok) {
            const jd = await jobResp.json();
            jobData = jd.job ?? jd;
          }
        }

        const cfg = jobData.aiInterview || {};
        if (!cancelled) {
          setInterviewContext({
            applicationId,
            jobTitle: jobData.title || 'Position',
            company: jobData.company || '',
            topics: cfg.topics || [],
            description: jobData.description || '',
            mode: cfg.mode || 'auto',
          });
          if (app.resumeSnapshot) setContextResume(app.resumeSnapshot);
        }
      } catch (err) {
        console.warn('[interview] context load failed:', err);
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applicationId, authLoading, isAuthenticated]);

  // Start Camera for Verification
  const startCamera = async () => {
    try {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera access failed", err);
      toast.error("Could not access camera. Please allow camera permissions.");
    }
  };

  // Stop Camera
  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
  };

  // Capture Selfie Snapshot
  const captureSelfie = () => {
    if (!videoRef.current || !cameraStreamRef.current) {
      toast.error('Enable your camera before capturing a selfie.');
      return;
    }
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            if (selfiePreview) URL.revokeObjectURL(selfiePreview);
            setSelfieBlob(blob);
            setSelfiePreview(URL.createObjectURL(blob));
            stopCamera();
            toast.success("Selfie captured!");
          }
        }, 'image/jpeg');
      }
    }
  };

  // Handle State ID Upload
  const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Upload a JPEG or PNG image of your ID.');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Your ID image must be 10 MB or smaller.');
      e.target.value = '';
      return;
    }

    if (stateIdPreview) URL.revokeObjectURL(stateIdPreview);
    setStateIdFile(file);
    setStateIdPreview(URL.createObjectURL(file));
    toast.success("ID image uploaded.");
  };

  // Run Biometric Verification
  const runIdentityVerification = async () => {
    if (!selfieBlob || !stateIdFile) {
      toast.error("Please capture your selfie and upload your State ID first.");
      return;
    }
    if (!identityConsent) {
      toast.error('Please confirm consent before starting identity verification.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Performing Biometric Face Comparison...");
    try {
      const formData = new FormData();
      formData.append('stateId', stateIdFile);
      formData.append('consent', 'true');
      
      const fileSelfie = new File([selfieBlob], "selfie.jpg", { type: "image/jpeg" });
      formData.append('selfie', fileSelfie);

      const response = await fetch(`${API_BASE_URL}/interviews/verify-identity`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getToken()}`
        },
        body: formData
      });

      const result = await readInterviewResponse(response);
      setVerificationResult(result);

      if (result.fraudDetected) {
        toast.error(`Verification Failed: ${result.fraudDetails || 'Spoofing detected.'}`, { id: toastId });
      } else if (!result.matched || Number(result.matchScore) < 75) {
        toast.error(`Identity could not be verified (${result.matchScore || 0}% likeness). Please retake your selfie and try again.`, { id: toastId });
      } else {
        toast.success(`Identity Verified successfully! Match Score: ${result.matchScore}%`, { id: toastId });
        setStep(2);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Verification Error: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Browser checks can confirm browser support, but cannot inspect the operating system.
  const runSystemChecks = () => {
    setLoading(true);
    const hasSpeechRecognition = Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    const supportsFullscreen = Boolean(document.documentElement.requestFullscreen);
    const supportsMicrophone = Boolean(navigator.mediaDevices?.getUserMedia);

    setVirtualAudioChecked(hasSpeechRecognition && supportsMicrophone);
    setSysCheckPassed(hasSpeechRecognition && supportsMicrophone && supportsFullscreen);
    setLoading(false);

    if (!hasSpeechRecognition || !supportsMicrophone || !supportsFullscreen) {
      toast.error('Use Chrome or Edge on a device with microphone and fullscreen support to continue.');
      return;
    }
    toast.success('Browser, microphone, and fullscreen support are ready.');
  };

  // Request fullscreen focus mode.
  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(Boolean(document.fullscreenElement));
      toast.success("Fullscreen focus mode enabled.");
    } catch {
      setIsFullscreen(false);
      toast.error('Fullscreen could not be enabled. Please allow it in your browser.');
    }
  };

  // Initialize and Start Turn-based Voice Arena
  const startVoiceArena = async () => {
    if (!sysCheckPassed || !isFullscreen) {
      toast.error("Run the browser checks and enable fullscreen before starting the interview.");
      return;
    }
    
    setLoading(true);
    try {
      fullscreenExitCountRef.current = 0;
      const uniquePart = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const generatedId = `${user?.id || 'candidate'}_${uniquePart}`;

      // Use resume snapshot from application if in job-interview mode; fall back to Firestore
      let resumeData: any = contextResume || {};
      if (!contextResume) {
        try {
          const resumeSnap = await getDoc(doc(db, 'resumes', user?.id || 'mock_uid'));
          resumeData = resumeSnap.exists() ? resumeSnap.data().resumeData : {};
        } catch (error) {
          console.warn('Unable to load saved resume data for the interview.', error);
        }
      }

      // Get first opening question
      const response = await fetch(`${API_BASE_URL}/interviews/get-next-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          resumeData,
          conversationHistory: [],
          latestTranscript: '',
          elapsedSeconds: 0,
          ...(interviewContext ? { interviewContext } : {})
        })
      });

      const data = await readInterviewResponse(response);
      if (response.status === 402 && data.error === 'no_api_keys') {
        toast.warning('Add your API keys in Profile → Settings to start an AI interview.', { duration: 6000 });
        setLoading(false); return;
      }
      const firstQuestion = typeof data.nextQuestion === 'string' ? data.nextQuestion.trim() : '';
      if (!firstQuestion) throw new Error('The interview service did not return an opening question.');
      
      
      // Save initial interview document
      const sessionRecord: Record<string, any> = {
        candidateId: user?.id || 'mock_uid',
        candidateName: user?.name || 'Candidate',
        jobId: interviewContext ? undefined : 'ai_eval_role',
        jobTitle: interviewContext ? interviewContext.jobTitle : 'AI Core Technical Assessor',
        ...(interviewContext ? {
          company: interviewContext.company,
          applicationId: interviewContext.applicationId,
          interviewMode: 'job_specific',
        } : {}),
        status: 'in_progress',
        startedAt: Timestamp.now(),
        conversationHistory: [{ speaker: 'ai', text: firstQuestion, timestamp: Timestamp.now() }],
        proctoringViolations: {
          tabSwitchesCount: 0,
          fullscreenExitsCount: 0,
          browserReadinessConfirmed: true,
          cheatingFlags: []
        },
        verification: {
          faceMatchScore: verificationResult?.matchScore ?? null,
          matched: verificationResult?.matched === true,
          confidence: verificationResult?.confidence ?? 'low',
          verificationLogs: verificationResult?.analysis ? [verificationResult.analysis] : [],
          imagesRetained: false,
          consentCapturedAt: Timestamp.now(),
          verifiedAt: Timestamp.now(),
        }
      };

      try {
        await setDoc(doc(db, 'interviews', generatedId), sessionRecord);
      } catch (error) {
        console.warn('Cloud interview session could not be saved.', error);
        sessionStorage.setItem(`careercraft_interview_${generatedId}`, JSON.stringify({
          ...sessionRecord,
          startedAt: new Date().toISOString(),
        }));
        toast.warning('Cloud sync is unavailable. This interview will run locally and will not be available to a recruiter.');
      }

      setInterviewId(generatedId);
      setCurrentQuestion(firstQuestion);
      setConversation([{ speaker: 'ai', text: firstQuestion, timestamp: new Date() }]);
      setResponses([]);
      setStep(3);
      setIsTimerRunning(true);

      // TTS synthesis of opening question
      speakText(firstQuestion);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not establish the interview session.');
    } finally {
      setLoading(false);
    }
  };

  // TTS Reader
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.onstart = () => setIsAiSpeaking(true);
      utterance.onend = () => setIsAiSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Browser speech recognition provides the candidate's actual transcript.
  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      if (transcriptRef.current.trim()) {
        toast.success("Voice answer captured.");
      } else {
        toast.warning('No speech was detected. Try recording again.');
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition requires Chrome or Edge.');
      return;
    }

    transcriptRef.current = '';
    setSpeechTranscript('');
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || '')
        .join('')
        .trim();
      transcriptRef.current = transcript;
      setSpeechTranscript(transcript);
    };
    recognition.onerror = (event: any) => {
      recognitionRef.current = null;
      setIsRecording(false);
      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        toast.error(`Microphone error: ${event.error}.`);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsRecording(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      toast.info('Recording your answer. Speak clearly, then select Stop Recording.');
    } catch {
      toast.error('The microphone could not start. Check your browser permission and try again.');
    }
  };

  // Submit response & Fetch next dynamic follow-up question
  const handleSubmitResponse = async () => {
    if (!speechTranscript.trim()) {
      toast.error("Please record your vocal response before submitting.");
      return;
    }

    setLoading(true);
    const updatedHistory = [
      ...conversation,
      { speaker: 'candidate', text: speechTranscript, timestamp: new Date() }
    ];

    try {
      // 1. Evaluate this turn
      const evalResp = await fetch(`${API_BASE_URL}/interviews/evaluate-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          question: currentQuestion,
          transcript: speechTranscript
        })
      });
      const evalData = await readInterviewResponse(evalResp);
      if (evalResp.status === 402 && evalData.error === 'no_api_keys') {
        toast.warning('Add your API keys in Profile → Settings to use AI interview evaluation.', { duration: 6000 });
        setLoading(false); return;
      }

      // 2. Use cached resume (from application snapshot or Firestore)
      let resumeData: any = contextResume || {};
      if (!contextResume) {
        try {
          const resumeSnap = await getDoc(doc(db, 'resumes', user?.id || 'mock_uid'));
          resumeData = resumeSnap.exists() ? resumeSnap.data().resumeData : {};
        } catch (error) {
          console.warn('Unable to load saved resume data for the follow-up question.', error);
        }
      }

      // 3. Request next dynamic question
      const elapsedSeconds = 1800 - timer;
      const nextResp = await fetch(`${API_BASE_URL}/interviews/get-next-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({
          resumeData,
          conversationHistory: updatedHistory,
          latestTranscript: speechTranscript,
          elapsedSeconds,
          ...(interviewContext ? { interviewContext } : {})
        })
      });
      const nextData = await readInterviewResponse(nextResp);
      const followUp = typeof nextData.nextQuestion === 'string' ? nextData.nextQuestion.trim() : '';
      if (!followUp) throw new Error('The interview service did not return a follow-up question.');

      // Update local states
      setCurrentQuestion(followUp);
      const nextHistory = [
        ...updatedHistory,
        { speaker: 'ai', text: followUp, timestamp: new Date() }
      ];
      setConversation(nextHistory);
      setSpeechTranscript("");

      const evaluatedResponse: InterviewResponse = {
        questionText: currentQuestion,
        transcript: speechTranscript,
        aiScore: Number.isFinite(Number(evalData.score)) ? Math.max(0, Math.min(100, Math.round(Number(evalData.score)))) : 0,
        aiFeedback: typeof evalData.feedback === 'string' ? evalData.feedback : 'No written feedback was returned.',
      };
      setResponses((current) => [...current, evaluatedResponse]);

      try {
        await setDoc(doc(db, 'interviews', interviewId), {
          conversationHistory: nextHistory.map(turn => ({
            speaker: turn.speaker,
            text: turn.text,
            timestamp: Timestamp.fromDate(turn.timestamp)
          })),
          responses: arrayUnion(evaluatedResponse),
        }, { merge: true });
      } catch (error) {
        console.warn('Unable to synchronise the interview response to the cloud.', error);
        toast.warning('Your response is saved for this browser session, but cloud sync is unavailable.');
      }

      speakText(followUp);
      toast.success("Answer analyzed, loading follow-up...");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Could not analyse this response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Browser-detectable focus events only. This does not claim to detect
  // virtual audio devices or activity in other applications.
  async function logProctoringEvent(event: 'tab_switch' | 'fullscreen_exit', count: number) {
    if (!interviewId) return;
    const field = event === 'tab_switch' ? 'tabSwitchesCount' : 'fullscreenExitsCount';
    const label = event === 'tab_switch'
      ? 'Tab switched out of the active interview window'
      : 'Fullscreen exited during the interview';
    try {
      await setDoc(doc(db, 'interviews', interviewId), {
        proctoringViolations: {
          [field]: count,
          cheatingFlags: arrayUnion(label),
          lastViolationRecordedAt: Timestamp.now(),
        },
      }, { merge: true });
    } catch (err) {
      console.error("Failed to log focus event", err);
    }
  }

  // Complete Interview and Generate Scorecard
  const handleCompleteInterview = async () => {
    setLoading(true);
    setIsTimerRunning(false);
    
    try {
      const totalScore = responses.reduce((acc: number, cur: any) => acc + cur.aiScore, 0);
      const averageScore = responses.length > 0 ? Math.round(totalScore / responses.length) : 0;

      const finalFeedback = responses.length === 0
        ? 'No answers were submitted, so there is not enough information to score this interview.'
        : averageScore >= 75
          ? 'The submitted answers showed strong communication and technical understanding.'
          : 'The submitted answers show a foundation to build on; add more specific examples and technical detail.';

      const status = tabSwitches > 3 ? 'flagged' : 'completed';

      try {
        await setDoc(doc(db, 'interviews', interviewId), {
          status,
          completedAt: Timestamp.now(),
          overallScore: averageScore,
          overallFeedback: finalFeedback,
          elapsedSeconds: 1800 - timer,
        }, { merge: true });
      } catch (error) {
        console.warn('Unable to save the final interview scorecard to the cloud.', error);
        toast.warning('The scorecard is available in this browser, but cloud sync is unavailable.');
      }

      // Save result to application when in job-interview mode
      if (interviewContext?.applicationId) {
        try {
          const token = await getToken();
          await fetch(`${API_BASE}/applications/${interviewContext.applicationId}/interview/complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              overallScore: averageScore,
              overallFeedback: finalFeedback,
              responses: responses.map(r => ({
                question: r.questionText,
                answer: r.transcript,
                score: r.aiScore,
                feedback: r.aiFeedback,
              })),
              interviewId,
              status,
            }),
          });
        } catch (err) {
          console.warn('[interview] could not save result to application:', err);
        }
      }

      setScorecard({
        overallScore: averageScore,
        overallFeedback: finalFeedback,
        status,
        totalQuestions: responses.length,
        violations: tabSwitches
      });

      setStep(4);
      toast.success("AI interview assessment successfully generated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to compile final scorecard.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (authLoading || !isAuthenticated) return null;
  if (contextLoading) {
    return (
      <CandidateLayout>
        <div className="flex min-h-[60vh] items-center justify-center text-[var(--cc-text-muted)]">
          Loading interview…
        </div>
      </CandidateLayout>
    );
  }

  return (
    <CandidateLayout>
      <section className="relative -m-4 min-h-[calc(100vh-2rem)] overflow-hidden bg-[var(--cc-bg)] p-4 text-[var(--cc-text)] md:-m-6 md:min-h-[calc(100vh-3rem)] md:p-6">
        <div className="cc-aurora-blob cc-aurora-1 pointer-events-none" />
        <div className="cc-aurora-blob cc-aurora-2 pointer-events-none" />
        <div className="cc-page relative z-10 max-w-5xl">
          {/* Workspace header */}
          <div className="cc-card mb-5 flex flex-col gap-4 p-5 md:mb-6 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--cc-accent)] to-[var(--cc-accent-2)] text-white shadow-lg shadow-[var(--cc-glow)]">
                <Mic className="h-5 w-5" />
              </div>
              <div>
                {interviewContext ? (
                  <>
                    <p className="cc-eyebrow mb-1">Job interview screening</p>
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{interviewContext.jobTitle}</h1>
                    <p className="mt-1 text-sm text-[var(--cc-text-muted)]">{interviewContext.company} · AI-powered voice interview</p>
                  </>
                ) : (
                  <>
                    <p className="cc-eyebrow mb-1">Interview practice</p>
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI Voice Interview</h1>
                    <p className="mt-1 text-sm text-[var(--cc-text-muted)]">A structured practice session with tailored AI follow-up questions.</p>
                  </>
                )}
              </div>
            </div>
          
          {step === 3 && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2 font-mono text-lg text-rose-500 max-sm:text-sm">
              <Clock className="w-5 h-5 max-sm:w-4 max-sm:h-4" />
              <span>{formatTime(timer)}</span>
            </div>
          )}
        </div>

        {/* Interview workflow */}
        <div className="cc-card relative w-full overflow-hidden p-5 md:p-8">
          
          {/* Progress Indicators */}
          <div className="mb-8 grid grid-cols-2 gap-2 border-b border-[var(--cc-border)] pb-5 sm:grid-cols-4 md:gap-3 md:pb-6">
            {[
              { id: 1, label: 'Identity Check' },
              { id: 2, label: 'Browser Check' },
              { id: 3, label: 'Voice Interview' },
              { id: 4, label: 'Results Card' }
            ].map((s) => (
              <div key={s.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${
                step === s.id
                  ? 'border-[var(--cc-accent)] bg-[color-mix(in_srgb,var(--cc-accent)_12%,transparent)] shadow-[0_6px_20px_var(--cc-glow)]'
                  : step > s.id
                    ? 'border-emerald-500/35 bg-emerald-500/5'
                    : 'border-[var(--cc-border)] bg-[color-mix(in_srgb,var(--cc-surface)_62%,transparent)]'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  step === s.id 
                    ? 'bg-[var(--cc-accent)] text-white shadow-lg shadow-[var(--cc-glow)]'
                    : step > s.id 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-[var(--cc-surface)] text-[var(--cc-text-muted)]'
                }`}>
                  {s.id}
                </div>
                <span className={`text-xs leading-tight sm:text-sm ${step === s.id ? 'font-semibold text-[var(--cc-text)]' : 'text-[var(--cc-text-muted)]'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            
            {/* STEP 1: BIOMETRIC FACE VERIFICATION */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="text-center max-w-xl mx-auto mb-6">
                  <h2 className="text-2xl font-bold">Step 1: Identity check</h2>
                  <p className="text-zinc-400 text-sm mt-2">
                    Compare your government ID photo with a live selfie before the interview. CareerCraft does not retain these images after the comparison.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Live Selfie Camera */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Camera className="w-5 h-5 text-purple-400" />
                      Live Selfie Webcam
                    </h3>
                    
                    <div className="w-full aspect-video rounded-xl bg-black border border-white/10 overflow-hidden relative mb-4">
                      {selfiePreview ? (
                        <img src={selfiePreview} alt="Selfie Capture" className="w-full h-full object-cover" />
                      ) : (
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      )}
                    </div>

                    <div className="flex gap-3">
                      {!selfiePreview ? (
                        <>
                          <Button onClick={startCamera} variant="outline" size="sm">
                            Enable Camera
                          </Button>
                          <Button onClick={captureSelfie} size="sm" disabled={!isCameraActive}>
                            Capture Selfie
                          </Button>
                        </>
                      ) : (
                        <Button onClick={() => { setSelfieBlob(null); setSelfiePreview(null); startCamera(); }} variant="outline" size="sm">
                          Retake Selfie
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: ID Upload */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-between">
                    <div className="w-full text-center">
                      <h3 className="text-lg font-semibold mb-4 flex items-center justify-center gap-2">
                        <UserCheck className="w-5 h-5 text-indigo-400" />
                        Government ID image
                      </h3>
                      
                      <div className="w-full aspect-video rounded-xl bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center overflow-hidden relative mb-4">
                        {stateIdPreview ? (
                          <img src={stateIdPreview} alt="State ID Uploaded" className="w-full h-full object-cover" />
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center justify-center p-6 text-zinc-400 hover:text-white transition">
                            <FileCheck className="w-10 h-10 mb-2 text-indigo-400" />
                            <span className="text-sm font-semibold">Click to select ID photo</span>
                            <span className="text-xs mt-1 text-zinc-500">JPG or PNG • up to 10 MB</span>
                            <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleIdUpload} />
                          </label>
                        )}
                      </div>
                    </div>

                    {stateIdPreview && (
                      <label className="cursor-pointer">
                        <Button as="span" variant="outline" size="sm">Change File</Button>
                        <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleIdUpload} />
                      </label>
                    )}
                  </div>
                </div>

                <label className="mx-auto flex max-w-2xl cursor-pointer items-start gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-4 text-left text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={identityConsent}
                    onChange={event => setIdentityConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-indigo-500"
                  />
                  <span>
                    I consent to this one-time identity comparison. My ID image and selfie are sent to the configured AI verification provider for this check and are not retained by CareerCraft.
                  </span>
                </label>

                <div className="flex justify-center pt-6">
                  <Button 
                    onClick={runIdentityVerification} 
                    disabled={loading || !identityConsent}
                    className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold hover:shadow-purple-500/30 shadow-lg rounded-xl transition"
                  >
                    {loading ? "Analyzing biometric matching..." : "Verify & Proceed"}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: BROWSER READINESS */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 max-w-xl mx-auto"
              >
                <div className="text-center">
                  <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
                  <h2 className="text-2xl font-bold">Step 2: Browser readiness</h2>
                  <p className="text-zinc-400 text-sm mt-2">
                    Confirm that your browser can use speech recognition, your microphone, and fullscreen mode. This browser check cannot inspect other applications on your device.
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-300">Biometric Verification:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Passed ({verificationResult?.matchScore ?? 0}% match)
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-300">Microphone and voice support:</span>
                    {virtualAudioChecked ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Ready
                      </span>
                    ) : (
                      <span className="text-yellow-500 font-semibold">Unscanned</span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-300">Fullscreen Focus Mode:</span>
                    {isFullscreen ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Focus Locked
                      </span>
                    ) : (
                      <button onClick={enterFullscreen} className="text-purple-400 hover:text-purple-300 text-sm font-semibold underline">
                        Activate Fullscreen
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 justify-center pt-4">
                  <Button onClick={runSystemChecks} variant="outline" disabled={loading} className="px-6">
                    {loading ? "Checking browser..." : "Run browser check"}
                  </Button>
                  <Button 
                    onClick={startVoiceArena} 
                    disabled={!sysCheckPassed || !isFullscreen} 
                    className="px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                  >
                    Start AI Voice Interview <ArrowRight className="w-4 h-4 ml-2 inline" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: VOICE INTERVIEW ARENA */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-8"
              >
                {/* Voice Pulsing Indicator */}
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-28 h-28 rounded-full bg-purple-600/10 border border-purple-500/30 flex items-center justify-center relative">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isAiSpeaking ? 'bg-purple-600/20' : isRecording ? 'bg-red-500/20 animate-pulse' : 'bg-white/5'}`}>
                      {isAiSpeaking ? (
                        <Volume2 className="w-10 h-10 text-purple-400 animate-bounce" />
                      ) : (
                        <Mic className={`w-10 h-10 ${isRecording ? 'text-red-400' : 'text-zinc-400'}`} />
                      )}
                    </div>
                    {/* Ring waveforms */}
                    {(isAiSpeaking || isRecording) && (
                      <>
                        <div className="absolute inset-0 rounded-full border border-purple-500/30 animate-ping" />
                        <div className="absolute -inset-4 rounded-full border border-indigo-500/20 animate-pulse" />
                      </>
                    )}
                  </div>

                  <span className="text-sm font-semibold mt-4 text-zinc-300">
                    {isAiSpeaking ? "AI Interviewer is speaking..." : isRecording ? "Microphone active - record your response" : "Turn Ready - speak when ready"}
                  </span>
                </div>

                {/* Turn Dialogue Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 min-h-[140px] flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-purple-400 font-bold mb-2">Interviewer Question</h4>
                    <p className="text-lg leading-relaxed">{currentQuestion}</p>
                  </div>
                </div>

                {/* Speech Transcript Output */}
                {speechTranscript && (
                  <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-5">
                    <h4 className="text-xs uppercase tracking-wider text-zinc-400 font-bold mb-2">Speech-to-Text Transcription</h4>
                    <p className="text-sm text-zinc-300 italic">"{speechTranscript}"</p>
                  </div>
                )}

                {/* Active Proctoring Warning */}
                {tabSwitches > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-red-400 text-xs">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <div>
                    <span className="font-semibold block">Focus event logged:</span>
                      You have switched windows or tabs {tabSwitches} time(s). This browser-detectable activity is recorded with this interview session.
                    </div>
                  </div>
                )}

                {/* Action Controller */}
                <div className="flex justify-center gap-4 pt-4">
                  <Button 
                    onClick={toggleRecording} 
                    disabled={isAiSpeaking || loading} 
                    className={`px-6 py-3 font-semibold rounded-xl transition ${isRecording ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                  >
                    {isRecording ? "Stop Recording" : "Record Answer"}
                  </Button>
                  
                  <Button 
                    onClick={handleSubmitResponse} 
                    disabled={!speechTranscript || isRecording || loading}
                    className="px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                  >
                    {loading ? "Analyzing..." : "Submit Answer"}
                  </Button>

                  <Button 
                    onClick={handleCompleteInterview} 
                    variant="outline" 
                    className="px-6 border-zinc-700 hover:bg-white/5"
                  >
                    Wrap-up & Finish
                  </Button>
                </div>
              </motion.div>
            )}

            {/* STEP 4: INTERVIEW COMPLETED RESULTS CARD */}
            {step === 4 && scorecard && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6 max-w-xl mx-auto text-center"
              >
                <Award className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-3xl font-extrabold text-white">Interview Complete!</h2>
                <p className="text-zinc-400 text-sm">
                  Your initial AI interview evaluation report is ready.
                </p>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-sm text-zinc-400">Technical Score:</span>
                    <span className="text-2xl font-black text-purple-400">{scorecard.overallScore}%</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-sm text-zinc-400">Interview Status:</span>
                    <span className={`text-sm font-semibold capitalize ${
                      scorecard.status === 'completed' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {scorecard.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-sm text-zinc-400">Total Questions Responded:</span>
                    <span className="text-sm font-semibold text-white">{scorecard.totalQuestions}</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <span className="text-sm text-zinc-400">Focus events logged:</span>
                    <span className="text-sm font-semibold text-zinc-300">{scorecard.violations}</span>
                  </div>

                  <div className="pt-2">
                    <span className="text-xs uppercase tracking-wider text-purple-400 font-bold block mb-1">AI Evaluator Commentary</span>
                    <p className="text-sm text-zinc-300 italic">"{scorecard.overallFeedback}"</p>
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={() => { document.exitFullscreen(); router.push('/candidate/dashboard'); }}
                    className="px-8 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl"
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
        </div>
      </section>
    </CandidateLayout>
  );
}

export default function CandidateInterviewPage() {
  return (
    <Suspense fallback={null}>
      <CandidateInterviewContent />
    </Suspense>
  );
}
