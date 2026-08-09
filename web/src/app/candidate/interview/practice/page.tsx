'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, PhoneOff, Volume2, VolumeX, ArrowLeft,
  Trophy, CheckCircle, Target, BarChart2, RotateCcw,
  Home, ChevronRight, Loader2, Brain, Users, Briefcase,
  Shuffle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { API_BASE } from '@/lib/api';
import CandidateLayout from '@/components/layout/CandidateLayout';

const SILENCE_MS = 2500;

type InterviewType = 'Technical' | 'Behavioral' | 'HR' | 'Mixed';
type Difficulty    = 'Junior' | 'Mid' | 'Senior';
type AppPhase      = 'setup' | 'room' | 'results';
type RoomState     = 'loading' | 'ai-speaking' | 'listening' | 'processing' | 'done';

interface Turn { role: 'ai' | 'user'; text: string; }
interface FeedbackResult {
  overallScore: number; rating: string;
  strengths: string[]; improvements: string[];
  questionScores: number[]; summary: string;
}

class PracticeApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PracticeApiError';
  }
}

async function readPracticeResponse(response: Response): Promise<Record<string, any>> {
  const body = await response.text();
  let data: Record<string, any> = {};
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      throw new PracticeApiError(
        response.ok ? 'The interview service returned an invalid response.' : `The interview service is unavailable (${response.status}).`,
        response.status,
      );
    }
  }
  if (!response.ok) throw new PracticeApiError(data.message || data.error || `The interview service is unavailable (${response.status}).`, response.status);
  return data;
}

const TYPE_CONFIG: Record<InterviewType, { icon: React.ReactNode; color: string; border: string; desc: string }> = {
  Technical:  { icon: <Brain className="w-5 h-5" />,    color: 'text-indigo-500 dark:text-indigo-300',  border: 'border-indigo-500',  desc: 'Algorithms, system design & coding' },
  Behavioral: { icon: <Users className="w-5 h-5" />,    color: 'text-purple-500 dark:text-purple-300',  border: 'border-purple-500',  desc: 'STAR situations & leadership' },
  HR:         { icon: <Briefcase className="w-5 h-5" />, color: 'text-cyan-600 dark:text-cyan-300',      border: 'border-cyan-500',    desc: 'Culture fit, goals & motivation' },
  Mixed:      { icon: <Shuffle className="w-5 h-5" />,   color: 'text-emerald-600 dark:text-emerald-300',border: 'border-emerald-500', desc: 'All types combined' },
};

const SCORE_COLOR = (s: number) =>
  s >= 8 ? 'text-emerald-500' : s >= 6 ? 'text-yellow-500' : s >= 4 ? 'text-orange-500' : 'text-red-500';

const SCORE_BG = (s: number) =>
  s >= 8 ? 'bg-emerald-500' : s >= 6 ? 'bg-yellow-500' : s >= 4 ? 'bg-orange-500' : 'bg-red-500';

// ── Animated waveform bars ─────────────────────────────────────────────────────
function Waveform({ active, color = 'var(--cc-accent)' }: { active: boolean; color?: string }) {
  return (
    <div className="flex items-center gap-[3px] h-8">
      {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.3, 0.7, 1, 0.4, 0.6].map((h, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ backgroundColor: color, opacity: active ? 1 : 0.2 }}
          animate={active ? { scaleY: [h * 0.3, h, h * 0.5, h * 0.8, h * 0.2, h] } : { scaleY: 0.15 }}
          transition={{ repeat: Infinity, duration: 0.6 + i * 0.07, ease: 'easeInOut', delay: i * 0.04 }}
        />
      ))}
    </div>
  );
}

// ── AI Avatar ──────────────────────────────────────────────────────────────────
function AIAvatar({ state }: { state: RoomState }) {
  const speaking   = state === 'ai-speaking';
  const processing = state === 'processing' || state === 'loading';
  return (
    <div className="relative flex items-center justify-center w-36 h-36 md:w-44 md:h-44">
      {speaking && <>
        <motion.div className="absolute inset-0 rounded-full border-2 border-indigo-500/30"
          animate={{ scale: [1, 1.25], opacity: [0.6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} />
        <motion.div className="absolute inset-0 rounded-full border border-indigo-400/20"
          animate={{ scale: [1, 1.45], opacity: [0.4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }} />
      </>}
      <motion.div
        className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 flex items-center justify-center shadow-2xl shadow-indigo-900/60"
        animate={speaking ? { scale: [1, 1.03, 1] } : {}}
        transition={{ repeat: Infinity, duration: 0.8 }}>
        {processing
          ? <Loader2 className="w-12 h-12 text-white/80 animate-spin" />
          : <span className="text-5xl select-none">🤖</span>}
        <div
          className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shadow
            ${speaking ? 'bg-indigo-500 text-white' : state === 'listening' ? 'bg-emerald-500 text-white' : 'bg-zinc-400 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-400'}`}
          style={{ borderColor: 'var(--cc-bg)' }}>
          {speaking ? '🔊' : state === 'listening' ? '👂' : '⏸'}
        </div>
      </motion.div>
    </div>
  );
}

// ── User Avatar ────────────────────────────────────────────────────────────────
function UserAvatar({ listening, name }: { listening: boolean; name: string }) {
  return (
    <div className="relative w-16 h-16">
      {listening && (
        <motion.div className="absolute inset-0 rounded-full border-2 border-emerald-500/50"
          animate={{ scale: [1, 1.3], opacity: [0.8, 0] }} transition={{ repeat: Infinity, duration: 1 }} />
      )}
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-colors
          ${listening ? 'border-emerald-500 bg-emerald-500/10' : ''}`}
        style={listening ? {} : { borderColor: 'var(--cc-border)', background: 'var(--cc-surface)' }}>
        {name?.charAt(0)?.toUpperCase() ?? 'Y'}
      </div>
    </div>
  );
}

export default function PracticeInterviewPage() {
  const { user, getToken } = useAuth();
  const router = useRouter();

  // ── Setup ──────────────────────────────────────────────────────────────────
  const [appPhase, setAppPhase]           = useState<AppPhase>('setup');
  const [interviewType, setInterviewType] = useState<InterviewType>('Technical');
  const [role, setRole]                   = useState('Software Engineer');
  const [difficulty, setDifficulty]       = useState<Difficulty>('Mid');
  const [totalTurns, setTotalTurns]       = useState(5);
  const [jobDescription, setJobDescription]       = useState('');
  const [availableVoices, setAvailableVoices]     = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');

  // ── Room ───────────────────────────────────────────────────────────────────
  const [roomState, setRoomState]           = useState<RoomState>('loading');
  const [conversation, setConversation]     = useState<Turn[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [muted, setMuted]                   = useState(false);
  const [ttsEnabled, setTtsEnabled]         = useState(true);
  const [feedback, setFeedback]             = useState<FeedbackResult | null>(null);
  const [feedbackUnavailable, setFeedbackUnavailable] = useState(false);

  const recognitionRef  = useRef<any>(null);
  const silenceTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef   = useRef('');
  const transcriptEl    = useRef<HTMLDivElement>(null);
  const isMountedRef    = useRef(true);
  const convRef         = useRef<Turn[]>([]);
  const turnRef         = useRef(0);
  const ttsEnabledRef     = useRef(ttsEnabled);
  const mutedRef          = useRef(muted);
  const selectedVoiceRef  = useRef(selectedVoiceName);
  const submitRef         = useRef<() => void>(() => {});

  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { selectedVoiceRef.current = selectedVoiceName; }, [selectedVoiceName]);

  const getAuthHeader = async () => ({ 'Authorization': `Bearer ${await getToken()}` });

  // ── Load voices ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const eng = all.filter(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('compact'));
      setAvailableVoices(eng);
      if (eng.length > 0 && !selectedVoiceName) {
        const best = eng.find(v =>
          v.name.includes('Google US English') ||
          v.name.includes('Microsoft David') ||
          v.name.includes('Microsoft Mark') ||
          v.name.includes('Microsoft Guy') ||
          v.name.includes('Alex')
        ) ?? eng.find(v => v.lang === 'en-US') ?? eng[0];
        setSelectedVoiceName(best.name);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
  }, []);

  // ── Chrome TTS workaround ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = setInterval(() => {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused)
        window.speechSynthesis.resume();
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    if (!ttsEnabledRef.current) { setTimeout(() => onEnd?.(), 50); return; }
    setTimeout(() => {
      const utt = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const chosen = voices.find(v => v.name === selectedVoiceRef.current)
        ?? voices.find(v => v.lang === 'en-US' && !v.name.toLowerCase().includes('compact'))
        ?? voices[0];
      if (chosen) utt.voice = chosen;
      utt.rate = 0.88; utt.pitch = 1.0; utt.volume = 1.0;
      utt.onend   = () => onEnd?.();
      utt.onerror = (e) => { if (e.error !== 'interrupted') console.warn('TTS error:', e.error); onEnd?.(); };
      window.speechSynthesis.speak(utt);
    }, 120);
  }, []);

  const stopSpeech = () => { if (typeof window !== 'undefined') window.speechSynthesis.cancel(); };

  // ── Speech Recognition ─────────────────────────────────────────────────────
  const stopListening = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  };

  const startListening = useCallback(() => {
    if (mutedRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error('Speech recognition requires Chrome or Edge.'); return; }
    stopListening();
    transcriptRef.current = '';
    setLiveTranscript('');
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      transcriptRef.current = t;
      setLiveTranscript(t);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        if (transcriptRef.current.trim()) submitRef.current();
      }, SILENCE_MS);
    };
    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') toast.error(`Mic error: ${e.error}`);
    };
    rec.onend = () => {
      if (isMountedRef.current && recognitionRef.current === rec) {
        try { rec.start(); } catch (_) {}
      }
    };
    rec.start();
    recognitionRef.current = rec;
    setRoomState('listening');
  }, []);

  // ── AI Turn ────────────────────────────────────────────────────────────────
  const fetchAITurn = useCallback(async (conv: Turn[], turnNum: number) => {
    if (!isMountedRef.current) return;
    setRoomState('loading');
    try {
      const res = await fetch(`${API_BASE}/practice-interview/ai-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
        body: JSON.stringify({ conversation: conv, role, interviewType, difficulty, jobDescription, turnNumber: turnNum, totalTurns }),
      });
      const data = await readPracticeResponse(res);
      if (res.status === 402 && data.error === 'no_api_keys') {
        toast.warning(data.message || 'Add your API keys in Profile → Settings.', { duration: 8000 });
        setAppPhase('setup'); return;
      }
      const aiText = typeof data.text === 'string' ? data.text.trim() : '';
      if (!aiText) throw new Error('The interview service did not return a question.');
      const newConv: Turn[] = [...conv, { role: 'ai', text: aiText }];
      convRef.current = newConv;
      setConversation(newConv);
      setRoomState('ai-speaking');
      const isLast = turnNum > totalTurns;
      speak(aiText, () => {
        if (!isMountedRef.current) return;
        if (isLast) doEndInterview(newConv);
        else startListening();
      });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : 'Could not load the next question.');
      setRoomState('done');
    }
  }, [role, interviewType, difficulty, totalTurns, speak, startListening]);

  // ── Submit user answer ─────────────────────────────────────────────────────
  const submitUserAnswer = () => {
    const text = transcriptRef.current.trim();
    stopListening();
    if (!text) { startListening(); return; }
    setRoomState('processing');
    setLiveTranscript('');
    transcriptRef.current = '';
    const updatedConv: Turn[] = [...convRef.current, { role: 'user', text }];
    convRef.current = updatedConv;
    const nextTurn = turnRef.current + 1;
    turnRef.current = nextTurn;
    setConversation(updatedConv);
    fetchAITurn(updatedConv, nextTurn + 1);
  };
  submitRef.current = submitUserAnswer;

  // ── End Interview ──────────────────────────────────────────────────────────
  const doEndInterview = useCallback(async (conv: Turn[]) => {
    stopListening(); stopSpeech();
    setRoomState('done');
    try {
      const res = await fetch(`${API_BASE}/practice-interview/final-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await getAuthHeader() },
        body: JSON.stringify({ conversation: conv, role, interviewType }),
      });
      const data = await readPracticeResponse(res);
      setFeedback(data as FeedbackResult);
    } catch (error) {
      console.warn('Unable to generate final interview feedback.', error);
      setFeedbackUnavailable(true);
      toast.warning('Your interview ended, but final feedback could not be generated.');
    }
    if (isMountedRef.current) setAppPhase('results');
  }, [role, interviewType]);

  // ── Start interview ────────────────────────────────────────────────────────
  const startInterview = async () => {
    if (!role.trim()) { toast.error('Enter a target role.'); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Voice practice requires Chrome or Edge speech recognition.'); return; }
    if (typeof window !== 'undefined' && window.speechSynthesis.getVoices().length === 0) {
      await new Promise<void>(r => { window.speechSynthesis.onvoiceschanged = () => r(); setTimeout(r, 1500); });
    }
    convRef.current = []; turnRef.current = 0;
    setConversation([]); setLiveTranscript(''); setFeedback(null); setFeedbackUnavailable(false);
    setAppPhase('room');
    fetchAITurn([], 1);
  };

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; stopListening(); stopSpeech(); };
  }, []);

  useEffect(() => {
    if (transcriptEl.current) transcriptEl.current.scrollTop = transcriptEl.current.scrollHeight;
  }, [conversation, liveTranscript]);

  // ── SETUP SCREEN ───────────────────────────────────────────────────────────
  if (appPhase === 'setup') return (
    <CandidateLayout>
      <div className="max-w-xl mx-auto py-8 px-4 md:px-6 space-y-8">

        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/candidate/dashboard')} className="cc-btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight cc-gradient-text">AI Voice Interview</h1>
            <p className="text-sm text-muted">Powered by your API key · Real-time conversational AI</p>
          </div>
        </div>

        {/* Type */}
        <div className="space-y-3">
          <label className="cc-eyebrow">Interview Type</label>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(TYPE_CONFIG) as InterviewType[]).map(t => (
              <button key={t} onClick={() => setInterviewType(t)}
                className={`cc-card p-4 text-left transition-all hover:scale-[1.01] ${interviewType === t
                  ? `${TYPE_CONFIG[t].border} ${TYPE_CONFIG[t].color}`
                  : 'opacity-60 hover:opacity-90'}`}>
                <div className="flex items-center gap-2 font-semibold text-sm mb-1">{TYPE_CONFIG[t].icon} {t}</div>
                <div className="text-xs text-muted">{TYPE_CONFIG[t].desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Role */}
        <div className="space-y-2">
          <label className="cc-eyebrow">Target Role</label>
          <input value={role} onChange={e => setRole(e.target.value)}
            placeholder="e.g. Senior Frontend Engineer, Data Scientist…"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none border"
            style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)', color: 'var(--cc-text)' }} />
        </div>

        {/* Job Description */}
        <div className="space-y-2">
          <label className="cc-eyebrow">
            Job Description <span className="normal-case font-normal text-muted ml-1">(optional — paste for targeted questions)</span>
          </label>
          <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste the job description here. The AI interviewer will tailor its questions to match the specific skills, technologies, and requirements mentioned."
            rows={4}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none border resize-none leading-relaxed"
            style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)', color: 'var(--cc-text)' }} />
          {jobDescription.trim() && (
            <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--cc-accent)' }}>
              <span>✓</span> Alex will focus on skills from this job description
            </p>
          )}
        </div>

        {/* Difficulty */}
        <div className="space-y-3">
          <label className="cc-eyebrow">Experience Level</label>
          <div className="flex gap-3">
            {(['Junior', 'Mid', 'Senior'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className="flex-1 py-3 rounded-xl border text-sm font-medium transition-all cc-card"
                style={difficulty === d
                  ? { borderColor: 'var(--cc-accent)', color: 'var(--cc-accent)', background: 'color-mix(in srgb, var(--cc-accent) 8%, var(--cc-surface-solid))' }
                  : { color: 'var(--cc-text-muted)' }}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-3">
          <label className="cc-eyebrow">Number of Questions</label>
          <div className="flex gap-3">
            {[3, 5, 8].map(n => (
              <button key={n} onClick={() => setTotalTurns(n)}
                className="flex-1 py-3 rounded-xl border text-sm font-medium transition-all cc-card"
                style={totalTurns === n
                  ? { borderColor: 'var(--cc-accent)', color: 'var(--cc-accent)', background: 'color-mix(in srgb, var(--cc-accent) 8%, var(--cc-surface-solid))' }
                  : { color: 'var(--cc-text-muted)' }}>
                {n} <span className="text-xs opacity-50">Q</span>
              </button>
            ))}
          </div>
        </div>

        {/* TTS toggle + voice picker */}
        <div className="space-y-3">
          <div className="cc-card p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">AI Voice (Text-to-Speech)</div>
              <div className="text-xs text-muted mt-0.5">AI interviewer speaks questions aloud</div>
            </div>
            <button onClick={() => setTtsEnabled(p => !p)}
              className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
              style={{ background: ttsEnabled ? 'var(--cc-accent)' : 'var(--cc-border)' }}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${ttsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {ttsEnabled && availableVoices.length > 0 && (
            <div className="space-y-2">
              <label className="cc-eyebrow flex items-center gap-1.5">
                <Volume2 className="w-3 h-3" /> Interviewer Voice
              </label>
              <select value={selectedVoiceName} onChange={e => setSelectedVoiceName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none border cursor-pointer"
                style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)', color: 'var(--cc-text)' }}>
                {availableVoices.map(v => (
                  <option key={v.name} value={v.name}>
                    {v.name} {v.localService ? '(offline)' : '(online)'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                Microsoft/Google voices sound most natural. Available voices depend on your OS and browser.
              </p>
            </div>
          )}
        </div>

        <button onClick={startInterview} className="cc-btn-primary w-full py-4 text-base rounded-2xl">
          <Mic className="w-5 h-5" /> Start Voice Interview
        </button>

        <p className="text-center text-xs text-muted pb-4">
          Allow microphone access when prompted · Best in Chrome or Edge
        </p>
      </div>
    </CandidateLayout>
  );

  // ── RESULTS SCREEN ─────────────────────────────────────────────────────────
  if (appPhase === 'results') {
    const score     = feedback?.overallScore ?? 0;
    const aiTurns   = conversation.filter(t => t.role === 'ai');
    return (
      <CandidateLayout>
        <div className="max-w-2xl mx-auto py-8 px-4 md:px-6 space-y-6">

          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="text-center py-6 space-y-2">
            <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <h1 className="text-3xl font-bold cc-gradient-text">Interview Complete</h1>
            <p className="text-muted text-sm">{totalTurns} questions · {interviewType} · {difficulty} · {role}</p>
          </motion.div>

          {/* Score */}
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="cc-card p-6 text-center">
            {feedbackUnavailable ? (
              <>
                <div className="text-xl font-bold mb-2" style={{ color: 'var(--cc-text)' }}>Feedback unavailable</div>
                <p className="text-sm text-muted">Your answers were recorded, but the feedback service did not respond. Try again later for an evaluated score.</p>
              </>
            ) : (
              <>
                <div className={`text-6xl font-black mb-1 ${SCORE_COLOR(score)}`}>
                  {score.toFixed(1)}<span className="text-2xl font-normal text-muted">/10</span>
                </div>
                <div className="text-sm text-muted mb-4">{feedback?.rating ?? 'Evaluated'}</div>
                <div className="flex justify-center gap-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className={`h-2 flex-1 rounded-full ${i < Math.round(score) ? SCORE_BG(score) : ''}`}
                      style={i < Math.round(score) ? {} : { background: 'var(--cc-border)' }} />
                  ))}
                </div>
              </>
            )}
            {feedback?.summary && (
              <p className="mt-4 text-sm text-muted italic">"{feedback.summary}"</p>
            )}
          </motion.div>

          {/* Per-question scores */}
          {feedback?.questionScores && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
              className="cc-card p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-muted">
                <BarChart2 className="w-4 h-4" style={{ color: 'var(--cc-accent)' }} /> Question Breakdown
              </h3>
              {feedback.questionScores.map((s, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted">
                    <span className="truncate max-w-xs">{aiTurns[i]?.text?.slice(0, 70)}…</span>
                    <span className={`font-bold ml-2 ${SCORE_COLOR(s)}`}>{s}/10</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--cc-border)' }}>
                    <div className={`h-full rounded-full ${SCORE_BG(s)}`} style={{ width: `${s * 10}%` }} />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Strengths / Improvements */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
              className="cc-card p-4 space-y-2 border-emerald-500/30 bg-emerald-500/5">
              <div className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Strengths
              </div>
              {(feedback?.strengths ?? []).map((s, i) => (
                <p key={i} className="text-xs text-muted">• {s}</p>
              ))}
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
              className="cc-card p-4 space-y-2 border-orange-500/30 bg-orange-500/5">
              <div className="text-xs font-bold text-orange-500 flex items-center gap-1">
                <Target className="w-3.5 h-3.5" /> Improve
              </div>
              {(feedback?.improvements ?? []).map((s, i) => (
                <p key={i} className="text-xs text-muted">• {s}</p>
              ))}
            </motion.div>
          </div>

          {/* Transcript */}
          <motion.details initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="cc-card p-4">
            <summary className="text-sm font-semibold cursor-pointer select-none">Full Transcript</summary>
            <div className="mt-3 space-y-3 max-h-60 overflow-y-auto pr-1">
              {conversation.map((t, i) => (
                <div key={i} className={`text-xs ${t.role === 'ai' ? '' : 'text-muted'}`}
                  style={t.role === 'ai' ? { color: 'var(--cc-accent)' } : {}}>
                  <span className="font-bold">{t.role === 'ai' ? 'Alex: ' : 'You: '}</span>{t.text}
                </div>
              ))}
            </div>
          </motion.details>

          <div className="flex gap-3 pb-8">
            <button onClick={() => { stopSpeech(); setAppPhase('setup'); setConversation([]); }}
              className="cc-btn-ghost flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" /> Practice Again
            </button>
            <button onClick={() => router.push('/candidate/dashboard')}
              className="cc-btn-primary flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
              <Home className="w-4 h-4" /> Dashboard
            </button>
          </div>
        </div>
      </CandidateLayout>
    );
  }

  // ── INTERVIEW ROOM ─────────────────────────────────────────────────────────
  const userTurnsCount = conversation.filter(t => t.role === 'user').length;
  const progress = Math.min((userTurnsCount / totalTurns) * 100, 100);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: 'var(--cc-bg)', color: 'var(--cc-text)' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b backdrop-blur"
        style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono text-muted uppercase tracking-widest">Live Interview</span>
        </div>
        <div className="text-xs text-muted font-medium">{role} · {difficulty} · {interviewType}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setTtsEnabled(p => !p); stopSpeech(); }}
            className="p-2 rounded-lg text-xs transition border"
            style={ttsEnabled
              ? { background: 'color-mix(in srgb, var(--cc-accent) 15%, transparent)', color: 'var(--cc-accent)', borderColor: 'color-mix(in srgb, var(--cc-accent) 30%, transparent)' }
              : { background: 'var(--cc-surface)', color: 'var(--cc-text-muted)', borderColor: 'var(--cc-border)' }}>
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => doEndInterview(conversation)}
            className="p-2 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition border border-red-500/30">
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="h-0.5" style={{ background: 'var(--cc-border)' }}>
        <motion.div className="h-full" style={{ background: 'var(--cc-accent)' }}
          animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
      </div>
      <div className="px-5 py-1.5 text-[10px] text-muted font-mono">
        Q {userTurnsCount}/{totalTurns}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — interview stage */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">

          <AIAvatar state={roomState} />

          <div className="text-center space-y-1">
            <div className="text-sm font-semibold">
              {roomState === 'loading'     && 'Alex is thinking…'}
              {roomState === 'ai-speaking' && 'Alex is speaking…'}
              {roomState === 'listening'   && 'Your turn — speak now'}
              {roomState === 'processing'  && 'Processing your answer…'}
              {roomState === 'done'        && 'Interview complete'}
            </div>
            <div className="flex justify-center">
              <Waveform
                active={roomState === 'ai-speaking' || roomState === 'listening'}
                color={roomState === 'listening' ? '#10b981' : 'var(--cc-accent)'}
              />
            </div>
          </div>

          {/* Current AI message */}
          <AnimatePresence mode="wait">
            {conversation.length > 0 && (
              <motion.div key={conversation.length}
                initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
                className="max-w-lg text-center text-sm rounded-2xl px-6 py-4 border"
                style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
                {conversation[conversation.length - 1]?.role === 'ai'
                  ? conversation[conversation.length - 1]?.text
                  : conversation.slice().reverse().find(t => t.role === 'ai')?.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live transcript while listening */}
          <AnimatePresence>
            {roomState === 'listening' && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="w-full max-w-lg">
                <div className="flex items-center gap-2 mb-2">
                  <UserAvatar listening={true} name={user?.name ?? 'Y'} />
                  <div className="flex-1">
                    <div className="text-xs text-emerald-500 font-medium mb-1">
                      {liveTranscript ? 'Listening…' : 'Waiting for you to speak…'}
                    </div>
                    <div className="min-h-[40px] text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2"
                      style={{ color: 'var(--cc-text)' }}>
                      {liveTranscript || <span className="text-muted italic">Start speaking — auto-submits after 2.5s silence</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setMuted(p => !p); if (!muted) stopListening(); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition border
                      ${muted ? 'bg-red-500/20 border-red-500/40 text-red-500' : ''}`}
                    style={muted ? {} : { background: 'var(--cc-surface)', borderColor: 'var(--cc-border)', color: 'var(--cc-text-muted)' }}>
                    {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {muted ? 'Unmute' : 'Mute'}
                  </button>
                  <button onClick={submitUserAnswer} disabled={!liveTranscript.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronRight className="w-3.5 h-3.5" /> Submit Now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right — transcript panel */}
        <div className="hidden lg:flex flex-col w-72 border-l"
          style={{ borderColor: 'var(--cc-border)', background: 'var(--cc-surface)' }}>
          <div className="px-4 py-3 border-b text-xs font-bold uppercase tracking-widest text-muted"
            style={{ borderColor: 'var(--cc-border)' }}>
            Transcript
          </div>
          <div ref={transcriptEl} className="flex-1 overflow-y-auto p-4 space-y-3">
            {conversation.map((t, i) => (
              <div key={i} className="text-xs rounded-xl px-3 py-2 border"
                style={t.role === 'ai'
                  ? { background: 'color-mix(in srgb, var(--cc-accent) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--cc-accent) 25%, transparent)', color: 'var(--cc-text)' }
                  : { background: 'var(--cc-surface-solid)', borderColor: 'var(--cc-border)', color: 'var(--cc-text-muted)', marginLeft: '1rem' }}>
                <div className="font-bold mb-0.5 text-[9px] uppercase tracking-wider opacity-60">
                  {t.role === 'ai' ? '🤖 Alex' : `👤 ${user?.name?.split(' ')[0] ?? 'You'}`}
                </div>
                {t.text}
              </div>
            ))}
            {liveTranscript && (
              <div className="text-xs rounded-xl px-3 py-2 border italic ml-4 bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-300">
                {liveTranscript}…
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--cc-border)' }}>
            <button onClick={() => doEndInterview(conversation)}
              className="w-full py-2 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5">
              <PhoneOff className="w-3.5 h-3.5" /> End Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
