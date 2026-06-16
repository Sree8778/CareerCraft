'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, PhoneOff, Volume2, VolumeX, ArrowLeft,
  Trophy, CheckCircle, Target, BarChart2, RotateCcw,
  Home, ChevronRight, Loader2, Brain, Users, Briefcase,
  Shuffle, Settings2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';
const SILENCE_MS = 2500; // auto-submit after 2.5s silence

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

const TYPE_CONFIG: Record<InterviewType, { icon: React.ReactNode; color: string; border: string; desc: string }> = {
  Technical:  { icon: <Brain className="w-5 h-5" />,    color: 'text-indigo-300',  border: 'border-indigo-500',  desc: 'Algorithms, system design & coding' },
  Behavioral: { icon: <Users className="w-5 h-5" />,    color: 'text-purple-300',  border: 'border-purple-500',  desc: 'STAR situations & leadership' },
  HR:         { icon: <Briefcase className="w-5 h-5" />, color: 'text-cyan-300',    border: 'border-cyan-500',    desc: 'Culture fit, goals & motivation' },
  Mixed:      { icon: <Shuffle className="w-5 h-5" />,   color: 'text-emerald-300', border: 'border-emerald-500', desc: 'All types combined' },
};

const SCORE_COLOR = (s: number) =>
  s >= 8 ? 'text-emerald-400' : s >= 6 ? 'text-yellow-400' : s >= 4 ? 'text-orange-400' : 'text-red-400';

// ── Animated waveform bars ─────────────────────────────────────────────────────
function Waveform({ active, color = '#6366f1' }: { active: boolean; color?: string }) {
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
  const speaking = state === 'ai-speaking';
  const processing = state === 'processing' || state === 'loading';
  return (
    <div className="relative flex items-center justify-center w-36 h-36 md:w-44 md:h-44">
      {/* Outer pulse rings when speaking */}
      {speaking && <>
        <motion.div className="absolute inset-0 rounded-full border-2 border-indigo-500/30"
          animate={{ scale: [1, 1.25], opacity: [0.6, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} />
        <motion.div className="absolute inset-0 rounded-full border border-indigo-400/20"
          animate={{ scale: [1, 1.45], opacity: [0.4, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }} />
      </>}
      {/* Avatar circle */}
      <motion.div
        className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 flex items-center justify-center shadow-2xl shadow-indigo-900/60"
        animate={speaking ? { scale: [1, 1.03, 1] } : {}}
        transition={{ repeat: Infinity, duration: 0.8 }}>
        {processing
          ? <Loader2 className="w-12 h-12 text-white/80 animate-spin" />
          : <span className="text-5xl select-none">🤖</span>}
        {/* Speaking indicator */}
        <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-zinc-950 flex items-center justify-center text-[10px] font-bold shadow
          ${speaking ? 'bg-indigo-500 text-white' : state === 'listening' ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
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
      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-colors
        ${listening ? 'border-emerald-500 bg-emerald-900/40' : 'border-zinc-700 bg-zinc-800'}`}>
        {name?.charAt(0)?.toUpperCase() ?? 'Y'}
      </div>
    </div>
  );
}

export default function PracticeInterviewPage() {
  const { user } = useAuth();
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

  // Refs — avoid stale closures in async callbacks
  const recognitionRef  = useRef<any>(null);
  const silenceTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptRef   = useRef('');
  const transcriptEl    = useRef<HTMLDivElement>(null);
  const isMountedRef    = useRef(true);
  const convRef         = useRef<Turn[]>([]);       // always mirrors conversation state
  const turnRef         = useRef(0);                // current answered-question count
  const ttsEnabledRef     = useRef(ttsEnabled);
  const mutedRef          = useRef(muted);
  const selectedVoiceRef  = useRef(selectedVoiceName);
  const submitRef         = useRef<() => void>(() => {}); // avoids stale closure in silence timer

  // Keep refs in sync with state
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { selectedVoiceRef.current = selectedVoiceName; }, [selectedVoiceName]);

  const authHeader = () => ({ 'Authorization': `Bearer mock_token_for_${user?.id || 'mock_uid'}` });

  // ── Load voices & pick a good default ─────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      // Only show English voices, exclude 'compact' (low quality on macOS)
      const eng = all.filter(v => v.lang.startsWith('en') && !v.name.toLowerCase().includes('compact'));
      setAvailableVoices(eng);
      if (eng.length > 0 && !selectedVoiceName) {
        // Pick best default: prefer Google/Microsoft/named voices
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

  // ── Chrome TTS workaround — synthesis pauses after ~14s ───────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = setInterval(() => {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
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
      // Use the user-selected voice if available, otherwise fall back to first en-US
      const chosen = voices.find(v => v.name === selectedVoiceRef.current)
        ?? voices.find(v => v.lang === 'en-US' && !v.name.toLowerCase().includes('compact'))
        ?? voices[0];
      if (chosen) utt.voice = chosen;
      utt.rate = 0.88; utt.pitch = 1.0; utt.volume = 1.0;
      utt.onend   = () => onEnd?.();
      utt.onerror = (e) => {
        if (e.error !== 'interrupted') console.warn('TTS error:', e.error);
        onEnd?.();
      };
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
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      transcriptRef.current = t;
      setLiveTranscript(t);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      // Use submitRef so we always call the latest version — no stale closure
      silenceTimer.current = setTimeout(() => {
        if (transcriptRef.current.trim()) submitRef.current();
      }, SILENCE_MS);
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') toast.error(`Mic error: ${e.error}`);
    };

    rec.onend = () => {
      // Auto-restart if we're still supposed to be listening
      if (isMountedRef.current && recognitionRef.current === rec) {
        try { rec.start(); } catch (_) {}
      }
    };

    rec.start();
    recognitionRef.current = rec;
    setRoomState('listening');
  }, []);

  // ── AI Turn — uses refs, no stale closure risk ─────────────────────────────
  const fetchAITurn = useCallback(async (conv: Turn[], turnNum: number) => {
    if (!isMountedRef.current) return;
    setRoomState('loading');
    try {
      const res = await fetch(`${API_BASE}/practice-interview/ai-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          conversation: conv,
          role, interviewType, difficulty,
          jobDescription,
          turnNumber: turnNum,
          totalTurns,
        }),
      });
      const data = await res.json();
      if (res.status === 402 && data.error === 'no_api_keys') {
        toast.warning(data.message || 'Add your API keys in Profile → Settings.', { duration: 8000 });
        setAppPhase('setup'); return;
      }
      if (!res.ok) throw new Error(data.error || 'AI error');

      const aiText: string = data.text;
      const newConv: Turn[] = [...conv, { role: 'ai', text: aiText }];
      convRef.current = newConv;
      setConversation(newConv);
      setRoomState('ai-speaking');

      const isLast = turnNum > totalTurns;
      speak(aiText, () => {
        if (!isMountedRef.current) return;
        if (isLast) { doEndInterview(newConv); }
        else { startListening(); }
      });
    } catch (e: any) {
      toast.error(e.message);
      setRoomState('listening');
      startListening();
    }
  }, [role, interviewType, difficulty, totalTurns, speak, startListening]);

  // ── Submit user answer — defined as plain function, stored in ref ──────────
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

  // Keep submitRef current — this is what the silence timer calls
  submitRef.current = submitUserAnswer;

  // ── End Interview ──────────────────────────────────────────────────────────
  const doEndInterview = useCallback(async (conv: Turn[]) => {
    stopListening(); stopSpeech();
    setRoomState('done');
    try {
      const res = await fetch(`${API_BASE}/practice-interview/final-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ conversation: conv, role, interviewType }),
      });
      const data = await res.json();
      if (res.ok) setFeedback(data);
    } catch (_) {}
    if (isMountedRef.current) setAppPhase('results');
  }, [role, interviewType]);

  // ── Start interview ────────────────────────────────────────────────────────
  const startInterview = async () => {
    if (!role.trim()) { toast.error('Enter a target role.'); return; }
    if (typeof window !== 'undefined' && window.speechSynthesis.getVoices().length === 0) {
      await new Promise<void>(r => {
        window.speechSynthesis.onvoiceschanged = () => r();
        setTimeout(r, 1500);
      });
    }
    convRef.current = [];
    turnRef.current = 0;
    setConversation([]);
    setLiveTranscript('');
    setFeedback(null);
    setAppPhase('room');
    fetchAITurn([], 1);
  };

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; stopListening(); stopSpeech(); };
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptEl.current) transcriptEl.current.scrollTop = transcriptEl.current.scrollHeight;
  }, [conversation, liveTranscript]);

  // ── SETUP SCREEN ───────────────────────────────────────────────────────────
  if (appPhase === 'setup') return (
    <div className="min-h-screen bg-[#050810] text-white p-4 md:p-10">
      <Toaster richColors position="top-right" />
      <div className="max-w-xl mx-auto space-y-8">

        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/candidate/dashboard')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition border border-white/10">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Voice Interview</h1>
            <p className="text-sm text-zinc-500">Powered by your API key · Real-time conversational AI</p>
          </div>
        </div>

        {/* Type */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Interview Type</label>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(TYPE_CONFIG) as InterviewType[]).map(t => (
              <button key={t} onClick={() => setInterviewType(t)}
                className={`p-4 rounded-2xl border text-left transition-all ${interviewType === t
                  ? `${TYPE_CONFIG[t].border} bg-white/5 ${TYPE_CONFIG[t].color}`
                  : 'border-white/8 bg-white/3 text-zinc-500 hover:border-white/15'}`}>
                <div className="flex items-center gap-2 font-semibold text-sm mb-1">{TYPE_CONFIG[t].icon} {t}</div>
                <div className="text-xs opacity-60">{TYPE_CONFIG[t].desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Role */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Target Role</label>
          <input value={role} onChange={e => setRole(e.target.value)}
            placeholder="e.g. Senior Frontend Engineer, Data Scientist…"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600" />
        </div>

        {/* Job Description */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Job Description <span className="normal-case text-zinc-600 font-normal">(optional — paste to get targeted questions)</span>
          </label>
          <textarea
            value={jobDescription}
            onChange={e => setJobDescription(e.target.value)}
            placeholder="Paste the job description here. The AI interviewer will tailor its questions to match the specific skills, technologies, and requirements mentioned."
            rows={5}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-zinc-600 resize-none leading-relaxed"
          />
          {jobDescription.trim() && (
            <p className="text-[10px] text-indigo-400 flex items-center gap-1">
              <span>✓</span> Alex will focus on skills and requirements from this job description
            </p>
          )}
        </div>

        {/* Difficulty */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Experience Level</label>
          <div className="flex gap-3">
            {(['Junior', 'Mid', 'Senior'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${difficulty === d
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-white/8 bg-white/3 text-zinc-500 hover:border-white/15'}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Number of Questions</label>
          <div className="flex gap-3">
            {[3, 5, 8].map(n => (
              <button key={n} onClick={() => setTotalTurns(n)}
                className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${totalTurns === n
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                  : 'border-white/8 bg-white/3 text-zinc-500 hover:border-white/15'}`}>
                {n} <span className="text-xs opacity-50">Q</span>
              </button>
            ))}
          </div>
        </div>

        {/* TTS toggle + voice picker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-white/3 border border-white/8 rounded-xl">
            <div>
              <div className="text-sm font-medium">AI Voice (Text-to-Speech)</div>
              <div className="text-xs text-zinc-500">AI interviewer speaks questions aloud</div>
            </div>
            <button onClick={() => setTtsEnabled(p => !p)}
              className={`w-11 h-6 rounded-full transition-colors relative ${ttsEnabled ? 'bg-indigo-600' : 'bg-zinc-700'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${ttsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {ttsEnabled && availableVoices.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
                <Volume2 className="w-3 h-3" /> Interviewer Voice
              </label>
              <select
                value={selectedVoiceName}
                onChange={e => setSelectedVoiceName(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {availableVoices.map(v => (
                  <option key={v.name} value={v.name} className="bg-zinc-900 text-white">
                    {v.name} {v.localService ? '(offline)' : '(online)'}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-600">
                Available voices depend on your OS and browser. Microsoft/Google voices sound most natural.
              </p>
            </div>
          )}
        </div>

        <button onClick={startInterview}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-2xl font-bold text-base transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/40">
          <Mic className="w-5 h-5" /> Start Voice Interview
        </button>

        <p className="text-center text-xs text-zinc-600">
          Allow microphone access when prompted · Best in Chrome or Edge
        </p>
      </div>
    </div>
  );

  // ── RESULTS SCREEN ─────────────────────────────────────────────────────────
  if (appPhase === 'results') {
    const score = feedback?.overallScore ?? 0;
    const userTurns = conversation.filter(t => t.role === 'user');
    const aiTurns   = conversation.filter(t => t.role === 'ai');
    return (
      <div className="min-h-screen bg-[#050810] text-white p-4 md:p-8">
        <Toaster richColors position="top-right" />
        <div className="max-w-2xl mx-auto space-y-6">

          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="text-center py-6 space-y-2">
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
            <h1 className="text-3xl font-bold">Interview Complete</h1>
            <p className="text-zinc-500 text-sm">{totalTurns} questions · {interviewType} · {difficulty} · {role}</p>
          </motion.div>

          {/* Score */}
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-6 text-center">
            <div className={`text-6xl font-black mb-1 ${SCORE_COLOR(score)}`}>
              {score.toFixed(1)}<span className="text-2xl font-normal text-zinc-500">/10</span>
            </div>
            <div className="text-sm text-zinc-400 mb-4">{feedback?.rating ?? 'Evaluated'}</div>
            <div className="flex justify-center gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-full ${i < Math.round(score) ? SCORE_COLOR(score).replace('text-', 'bg-') : 'bg-white/10'}`} />
              ))}
            </div>
            {feedback?.summary && <p className="mt-4 text-sm text-zinc-400 italic">"{feedback.summary}"</p>}
          </motion.div>

          {/* Per-question scores */}
          {feedback?.questionScores && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-zinc-300">
                <BarChart2 className="w-4 h-4 text-indigo-400" /> Question Breakdown
              </h3>
              {feedback.questionScores.map((s, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span className="truncate max-w-xs">{aiTurns[i]?.text?.slice(0, 70)}…</span>
                    <span className={`font-bold ml-2 ${SCORE_COLOR(s)}`}>{s}/10</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${SCORE_COLOR(s).replace('text-', 'bg-')}`} style={{ width: `${s * 10}%` }} />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Strengths / Improvements */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
              className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Strengths</div>
              {(feedback?.strengths ?? []).map((s, i) => <p key={i} className="text-xs text-zinc-300">• {s}</p>)}
            </motion.div>
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
              className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 space-y-2">
              <div className="text-xs font-bold text-orange-400 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Improve</div>
              {(feedback?.improvements ?? []).map((s, i) => <p key={i} className="text-xs text-zinc-300">• {s}</p>)}
            </motion.div>
          </div>

          {/* Transcript */}
          <motion.details initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
            <summary className="text-sm font-semibold cursor-pointer text-zinc-300 select-none">Full Transcript</summary>
            <div className="mt-3 space-y-3 max-h-60 overflow-y-auto pr-1">
              {conversation.map((t, i) => (
                <div key={i} className={`text-xs ${t.role === 'ai' ? 'text-indigo-300' : 'text-zinc-300'}`}>
                  <span className="font-bold">{t.role === 'ai' ? 'Alex: ' : 'You: '}</span>{t.text}
                </div>
              ))}
            </div>
          </motion.details>

          <div className="flex gap-3">
            <button onClick={() => { stopSpeech(); setAppPhase('setup'); setConversation([]); }}
              className="flex-1 py-3 border border-white/10 hover:border-white/20 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition">
              <RotateCcw className="w-4 h-4" /> Practice Again
            </button>
            <button onClick={() => router.push('/candidate/dashboard')}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition">
              <Home className="w-4 h-4" /> Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── INTERVIEW ROOM ─────────────────────────────────────────────────────────
  const userTurnsCount = conversation.filter(t => t.role === 'user').length;
  const progress = Math.min((userTurnsCount / totalTurns) * 100, 100);

  return (
    <div className="fixed inset-0 bg-[#050810] text-white flex flex-col overflow-hidden">
      <Toaster richColors position="top-right" />

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-black/30 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Live Interview</span>
        </div>
        <div className="text-xs text-zinc-500 font-medium">{role} · {difficulty} · {interviewType}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setTtsEnabled(p => !p); stopSpeech(); }}
            className={`p-2 rounded-lg text-xs transition ${ttsEnabled ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-zinc-500'}`}>
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => doEndInterview(conversation)}
            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition">
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="h-0.5 bg-white/5">
        <motion.div className="h-full bg-indigo-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
      </div>
      <div className="px-5 py-1.5 text-[10px] text-zinc-600 font-mono">
        Q {userTurnsCount}/{totalTurns}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — interview stage */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">

          {/* AI Avatar */}
          <AIAvatar state={roomState} />

          {/* Status label */}
          <div className="text-center space-y-1">
            <div className="text-sm font-semibold text-zinc-300">
              {roomState === 'loading'     && 'Alex is thinking…'}
              {roomState === 'ai-speaking' && 'Alex is speaking…'}
              {roomState === 'listening'   && 'Your turn — speak now'}
              {roomState === 'processing'  && 'Processing your answer…'}
              {roomState === 'done'        && 'Interview complete'}
            </div>
            <div className="flex justify-center">
              <Waveform
                active={roomState === 'ai-speaking' || roomState === 'listening'}
                color={roomState === 'listening' ? '#10b981' : '#6366f1'}
              />
            </div>
          </div>

          {/* Current AI message */}
          <AnimatePresence mode="wait">
            {conversation.length > 0 && (
              <motion.div key={conversation.length}
                initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
                className="max-w-lg text-center text-sm text-zinc-300 bg-white/3 border border-white/8 rounded-2xl px-6 py-4">
                {conversation[conversation.length - 1]?.role === 'ai'
                  ? conversation[conversation.length - 1]?.text
                  : conversation.slice().reverse().find(t => t.role === 'ai')?.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live transcript while speaking */}
          <AnimatePresence>
            {roomState === 'listening' && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="w-full max-w-lg">
                <div className="flex items-center gap-2 mb-2">
                  <UserAvatar listening={true} name={user?.name ?? 'Y'} />
                  <div className="flex-1">
                    <div className="text-xs text-emerald-400 font-medium mb-1">
                      {liveTranscript ? 'Listening…' : 'Waiting for you to speak…'}
                    </div>
                    <div className="min-h-[40px] text-sm text-zinc-300 bg-emerald-900/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                      {liveTranscript || <span className="text-zinc-600 italic">Start speaking — auto-submits after 2.5s silence</span>}
                    </div>
                  </div>
                </div>
                {/* Manual controls */}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { setMuted(p => !p); if (!muted) stopListening(); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition border ${muted ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
                    {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {muted ? 'Unmute' : 'Mute'}
                  </button>
                  <button onClick={submitUserAnswer} disabled={!liveTranscript.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <ChevronRight className="w-3.5 h-3.5" /> Submit Now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right — transcript panel */}
        <div className="hidden lg:flex flex-col w-72 border-l border-white/8 bg-black/20">
          <div className="px-4 py-3 border-b border-white/8 text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Transcript
          </div>
          <div ref={transcriptEl} className="flex-1 overflow-y-auto p-4 space-y-3">
            {conversation.map((t, i) => (
              <div key={i} className={`text-xs rounded-xl px-3 py-2 ${t.role === 'ai'
                ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-200'
                : 'bg-white/5 border border-white/8 text-zinc-300 ml-4'}`}>
                <div className="font-bold mb-0.5 text-[9px] uppercase tracking-wider opacity-60">
                  {t.role === 'ai' ? '🤖 Alex' : `👤 ${user?.name?.split(' ')[0] ?? 'You'}`}
                </div>
                {t.text}
              </div>
            ))}
            {liveTranscript && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs text-emerald-200 ml-4 italic">
                {liveTranscript}…
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-white/8">
            <button onClick={() => doEndInterview(conversation)}
              className="w-full py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5">
              <PhoneOff className="w-3.5 h-3.5" /> End Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
