'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE, authHeader, jsonHeaders } from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft, Video, CheckCircle2, Clock, RefreshCw,
  ChevronRight, ChevronLeft, Send,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface InterviewData {
  questions: string[];
  jobTitle: string;
  company: string;
  mandatory: boolean;
  deadline: string;
  status: string;
}

interface CompletedData {
  status: 'completed';
  result: {
    completedAt: string;
    score: number;
    summary: string;
    responses: { question: string; answer: string; score: number; feedback: string }[];
  };
}

export default function CandidateInterviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [completed, setCompleted] = useState<CompletedData | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'candidate') { router.push('/'); return; }
    load();
  }, [isAuthenticated, user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/applications/${id}/interview`, {
        headers: await authHeader(getToken),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not load interview');
        router.push('/candidate/applications');
        return;
      }
      if (data.status === 'completed') {
        setCompleted(data as CompletedData);
      } else {
        setInterviewData(data as InterviewData);
        setAnswers(new Array(data.questions.length).fill(''));
      }
    } catch {
      toast.error('Failed to load interview');
      router.push('/candidate/applications');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!interviewData) return;
    const unanswered = answers.filter(a => !a.trim()).length;
    if (unanswered === interviewData.questions.length) {
      toast.error('Please answer at least one question before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const responses = interviewData.questions.map((q, i) => ({
        question: q,
        answer: answers[i] || '',
      }));
      const res = await fetch(`${API_BASE}/applications/${id}/interview/complete`, {
        method: 'POST',
        headers: await jsonHeaders(getToken),
        body: JSON.stringify({ responses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      toast.success('Interview submitted! Your responses have been recorded.');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit interview');
    } finally {
      setSubmitting(false);
    }
  };

  const daysLeft = () => {
    if (!interviewData?.deadline) return null;
    const diff = new Date(interviewData.deadline).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (authLoading || loading) return (
    <CandidateLayout>
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin text-violet-400" />
        Loading interview…
      </div>
    </CandidateLayout>
  );

  // Already completed — show results
  if (completed) {
    const result = completed.result;
    const pct = result.score;
    const color = pct >= 70 ? 'text-emerald-400' : pct >= 45 ? 'text-yellow-400' : 'text-red-400';
    const ring = pct >= 70 ? 'stroke-emerald-500' : pct >= 45 ? 'stroke-yellow-500' : 'stroke-red-500';
    return (
      <CandidateLayout>
        <div className="max-w-2xl mx-auto space-y-6 text-white">
          <Link href="/candidate/applications" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" /> Back to Applications
          </Link>

          <div className="glass rounded-2xl p-8 border border-white/10 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
            <h1 className="text-2xl font-bold">Interview Complete</h1>
            <p className="text-zinc-400 text-sm">{interviewData?.jobTitle || ''} · {interviewData?.company || ''}</p>

            {/* Score ring */}
            <div className="flex justify-center">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none" className={ring}
                    strokeWidth="2.5" strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-2xl font-black ${color}`}>{pct}</span>
                  <span className="text-[9px] text-zinc-500 font-mono">/ 100</span>
                </div>
              </div>
            </div>

            {result.summary && (
              <p className="text-sm text-zinc-300 leading-relaxed max-w-md mx-auto bg-white/5 rounded-xl p-4">
                {result.summary}
              </p>
            )}
          </div>

          {/* Per-question breakdown */}
          {result.responses?.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Response Breakdown</h2>
              {result.responses.map((r, i) => (
                <div key={i} className="glass rounded-xl p-5 border border-white/10 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-200 flex-1">{i + 1}. {r.question}</p>
                    <span className={`text-sm font-black shrink-0 ${r.score >= 7 ? 'text-emerald-400' : r.score >= 4 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {r.score}/10
                    </span>
                  </div>
                  {r.answer && (
                    <p className="text-xs text-zinc-400 leading-relaxed bg-white/3 rounded-lg px-3 py-2 border border-white/8">
                      {r.answer}
                    </p>
                  )}
                  {r.feedback && (
                    <p className="text-[11px] text-zinc-500 italic">{r.feedback}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CandidateLayout>
    );
  }

  if (!interviewData) return null;

  const total = interviewData.questions.length;
  const dl = daysLeft();
  const expired = dl !== null && dl <= 0;

  if (expired) return (
    <CandidateLayout>
      <div className="max-w-xl mx-auto text-center space-y-6 pt-16 text-white">
        <Clock className="w-12 h-12 mx-auto text-red-400" />
        <h1 className="text-2xl font-bold">Interview Deadline Passed</h1>
        <p className="text-zinc-400 text-sm">The deadline for this interview was {interviewData.deadline}.</p>
        <Link href="/candidate/applications" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition">
          <ArrowLeft className="w-4 h-4" /> Back to Applications
        </Link>
      </div>
    </CandidateLayout>
  );

  const answeredCount = answers.filter(a => a.trim()).length;

  return (
    <CandidateLayout>
      <div className="max-w-2xl mx-auto space-y-6 text-white">
        <Link href="/candidate/applications" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Back to Applications
        </Link>

        {/* Header */}
        <div className="glass rounded-2xl p-6 border border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                <Video className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold">AI Interview</h1>
                <p className="text-sm text-zinc-400">{interviewData.jobTitle} · {interviewData.company}</p>
              </div>
            </div>
            <div className="text-right shrink-0 space-y-1">
              {dl !== null && (
                <p className={`text-xs font-mono font-bold ${dl <= 2 ? 'text-red-400' : 'text-zinc-400'}`}>
                  {dl}d remaining
                </p>
              )}
              {interviewData.mandatory && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 font-bold">
                  Required
                </span>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Question {currentQ + 1} of {total}</span>
              <span>{answeredCount} answered</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
                style={{ width: `${((currentQ + 1) / total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question + answer */}
        <AnimatePresence mode="wait">
          <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="glass rounded-2xl p-6 border border-white/10 space-y-4">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center text-xs font-black text-violet-400">
                  {currentQ + 1}
                </span>
                <p className="text-base font-semibold text-zinc-100 leading-snug flex-1">
                  {interviewData.questions[currentQ]}
                </p>
              </div>
              <textarea
                rows={6}
                value={answers[currentQ] || ''}
                onChange={e => {
                  const updated = [...answers];
                  updated[currentQ] = e.target.value;
                  setAnswers(updated);
                }}
                placeholder="Type your answer here…"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
              />
              <div className="flex justify-between gap-3">
                <button
                  onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
                  disabled={currentQ === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold text-zinc-300 transition disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                {currentQ < total - 1 ? (
                  <button
                    onClick={() => setCurrentQ(q => q + 1)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-xl text-sm font-semibold text-white transition"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={submit}
                    disabled={submitting || answeredCount === 0}
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition"
                  >
                    {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting…</> : <><Send className="w-4 h-4" /> Submit Interview</>}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Question navigator */}
        <div className="flex flex-wrap gap-2">
          {interviewData.questions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentQ(i)}
              className={`w-8 h-8 rounded-lg text-xs font-bold border transition ${
                i === currentQ ? 'bg-violet-600 border-violet-500 text-white' :
                answers[i]?.trim() ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                'bg-white/5 border-white/10 text-zinc-500 hover:text-white hover:bg-white/10'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Submit from anywhere */}
        {answeredCount > 0 && currentQ < total - 1 && (
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting…</> : <><Send className="w-4 h-4" /> Submit {answeredCount}/{total} answered</>}
            </button>
          </div>
        )}
      </div>
    </CandidateLayout>
  );
}
