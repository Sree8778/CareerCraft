// src/app/recruiter/messages/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { API_BASE, authHeader } from '@/lib/api';
import { db } from '@/lib/firebase';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  Send, MessageSquare, Briefcase, RefreshCw,
  CheckCheck, Check, User, FileText, GraduationCap,
  Award, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ── Helpers ────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  (name ?? '').split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || '?';

function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'string') return Date.parse(ts) || 0;
  if (ts._seconds)            return ts._seconds * 1000;
  return 0;
}

function relativeTime(ts: any): string {
  const ms = tsToMs(ts);
  if (!ms) return '';
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60)    return `${diff}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function msgTime(ts: any): string {
  const ms = tsToMs(ts);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const AVATAR_GRADIENTS = [
  'from-purple-600 to-indigo-600', 'from-pink-600 to-rose-600',
  'from-cyan-600 to-blue-600',     'from-amber-600 to-orange-600',
];

// ── Resume side panel ──────────────────────────────────────────────────────

function ResumePanel({ candidateId, getToken }: { candidateId: string; getToken: () => Promise<string> }) {
  const [resumeData,    setResumeData]    = useState<any>(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    setResumeData(null);
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/candidates/${candidateId}/resume`, {
          headers: await authHeader(getToken),
        });
        if (res.ok) setResumeData((await res.json()).resumeData);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    load();
  }, [candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="flex items-center justify-center h-full text-zinc-500 text-xs gap-2">
      <RefreshCw className="w-4 h-4 animate-spin" /> Loading profile…
    </div>
  );

  if (!resumeData) return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
      <User className="w-8 h-8" />
      <p className="text-xs">No resume on file</p>
    </div>
  );

  const personal   = resumeData?.personal    ?? {};
  const skills     = resumeData?.skills      ?? [];
  const experience = resumeData?.experience  ?? [];
  const education  = resumeData?.education   ?? [];

  const flatSkills: string[] = skills.flatMap((s: any) =>
    typeof s === 'string' ? [s]
    : String(s.skills_list ?? '').split(',').map((x: string) => x.trim()).filter(Boolean)
  );

  return (
    <div className="overflow-y-auto h-full p-4 space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-black text-white shrink-0">
          {getInitials(personal.name)}
        </div>
        <div>
          <p className="text-sm font-bold">{personal.name || 'Candidate'}</p>
          <p className="text-[10px] text-zinc-500">{personal.email}</p>
        </div>
      </div>

      {/* Summary */}
      {resumeData.summary && (
        <div className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Summary</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-4">{resumeData.summary}</p>
        </div>
      )}

      {/* Skills */}
      {flatSkills.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
            <Award className="w-3 h-3" /> Skills
          </p>
          <div className="flex flex-wrap gap-1">
            {flatSkills.slice(0, 12).map(skill => (
              <span key={skill} className="text-[9px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-1.5 py-0.5 rounded-full">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {experience.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> Experience
          </p>
          {experience.slice(0, 3).map((e: any, i: number) => (
            <div key={i} className="space-y-0.5">
              <p className="text-[11px] font-semibold text-white">{e.title}</p>
              <p className="text-[10px] text-zinc-400">{e.company} · {e.startDate} – {e.endDate || 'Present'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {education.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
            <GraduationCap className="w-3 h-3" /> Education
          </p>
          {education.slice(0, 2).map((e: any, i: number) => (
            <div key={i} className="space-y-0.5">
              <p className="text-[11px] font-semibold text-white">{e.degree}</p>
              <p className="text-[10px] text-zinc-400">{e.institution}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function RecruiterMessagesPage() {
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();
  const router = useRouter();

  const [chats,       setChats]       = useState<any[]>([]);
  const [activeChat,  setActiveChat]  = useState<any | null>(null);
  const [messages,    setMessages]    = useState<any[]>([]);
  const [inputText,   setInputText]   = useState('');
  const [sending,     setSending]     = useState(false);
  const [chatsReady,  setChatsReady]  = useState(false);
  const [showResume,  setShowResume]  = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'recruiter') router.push('/');
  }, [authLoading, isAuthenticated, user, router]);

  // ── Real-time chat list ────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const seen = new Map<string, any>();

    const merge = () => {
      const sorted = [...seen.values()].sort(
        (a, b) => tsToMs(b.lastMessageTimestamp) - tsToMs(a.lastMessageTimestamp)
      );
      setChats(sorted);
      setChatsReady(true);
    };

    const q1 = query(collection(db, 'chats'), where('recruiterId',  '==', uid));
    const q2 = query(collection(db, 'chats'), where('candidateId',  '==', uid));

    const u1 = onSnapshot(q1, snap => { snap.docs.forEach(d => seen.set(d.id, { id: d.id, ...d.data() })); merge(); }, () => {});
    const u2 = onSnapshot(q2, snap => { snap.docs.forEach(d => seen.set(d.id, { id: d.id, ...d.data() })); merge(); }, () => {});

    return () => { u1(); u2(); };
  }, [user?.id]);

  // ── Real-time messages ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeChat?.id) { setMessages([]); return; }
    const q = query(
      collection(db, 'chats', activeChat.id, 'messages'),
      orderBy('timestamp', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => unsub();
  }, [activeChat?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Send ──────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !activeChat?.id || !user || sending) return;

    setSending(true);
    setInputText('');

    try {
      const opt = { id: `opt-${Date.now()}`, text, senderId: user.id, senderName: user.name, timestamp: { _seconds: Date.now() / 1000 }, optimistic: true };
      setMessages(prev => [...prev, opt]);

      const msgsRef = collection(db, 'chats', activeChat.id, 'messages');
      await addDoc(msgsRef, { text, senderId: user.id, senderName: user.name, timestamp: serverTimestamp() });
      await updateDoc(doc(db, 'chats', activeChat.id), { lastMessage: text, lastMessageTimestamp: serverTimestamp() });

      setMessages(prev => prev.filter(m => m.id !== opt.id));
    } catch {
      toast.error('Failed to send');
      setInputText(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [inputText, activeChat?.id, user, sending]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <RecruiterLayout>
      <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
        {/* Header */}
        <div className="mb-4 shrink-0">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" /> Messages
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Real-time conversations with candidates</p>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-12 rounded-2xl border border-white/10 overflow-hidden bg-zinc-950/50">

          {/* Chat list */}
          <div className="col-span-3 border-r border-white/8 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Chats</span>
              <span className="text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/25 px-2 py-0.5 rounded-full">
                {chats.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {!chatsReady ? (
                <div className="p-8 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              ) : chats.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-600">
                  Open a chat from an application to start.
                </div>
              ) : (
                chats.map((c, i) => {
                  const isActive = activeChat?.id === c.id;
                  const contact  = c.recruiterId === user?.id ? c.candidateName : c.recruiterName;
                  return (
                    <button key={c.id} onClick={() => { setActiveChat(c); setShowResume(false); }}
                      className={`w-full text-left p-3.5 flex items-start gap-2.5 transition ${
                        isActive ? 'bg-purple-600/10 border-l-2 border-purple-500' : 'hover:bg-white/3'
                      }`}>
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} flex items-center justify-center text-[10px] font-black text-white shrink-0`}>
                        {getInitials(contact)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-xs font-semibold text-white truncate">{contact}</span>
                          <span className="text-[9px] text-zinc-600 shrink-0">{relativeTime(c.lastMessageTimestamp)}</span>
                        </div>
                        <p className="text-[9px] text-zinc-500 truncate">{c.jobTitle}</p>
                        <p className="text-[9px] text-zinc-600 truncate italic">{c.lastMessage || 'Chat started'}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Thread */}
          <div className={`flex flex-col overflow-hidden ${showResume && activeChat ? 'col-span-6' : 'col-span-9'}`}>
            {!activeChat ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600">
                <MessageSquare className="w-12 h-12" />
                <p className="text-sm">Select a conversation</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-3 bg-zinc-950/40 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-black text-white shrink-0">
                    {getInitials(activeChat.recruiterId === user?.id ? activeChat.candidateName : activeChat.recruiterName)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {activeChat.recruiterId === user?.id ? activeChat.candidateName : activeChat.recruiterName}
                    </p>
                    <p className="text-[10px] text-zinc-500">{activeChat.jobTitle}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <button onClick={() => setShowResume(v => !v)}
                      className="flex items-center gap-1 text-[10px] font-semibold text-purple-400 hover:text-purple-300 border border-purple-500/25 px-2.5 py-1 rounded-lg transition">
                      <FileText className="w-3 h-3" /> {showResume ? 'Hide' : 'Resume'}
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {messages.map(msg => {
                      const isMine = msg.senderId === user?.id;
                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                          {!isMine && (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-[9px] font-black text-white shrink-0 mb-0.5">
                              {getInitials(msg.senderName)}
                            </div>
                          )}
                          <div className={`max-w-[70%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isMine ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-white/8 text-zinc-200 rounded-bl-sm'
                            } ${msg.optimistic ? 'opacity-60' : ''}`}>
                              {msg.text}
                            </div>
                            <div className={`flex items-center gap-1 text-[9px] text-zinc-600 px-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              {msgTime(msg.timestamp)}
                              {isMine && (msg.optimistic ? <Check className="w-2.5 h-2.5" /> : <CheckCheck className="w-2.5 h-2.5 text-purple-400" />)}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 border-t border-white/8 flex items-end gap-3 shrink-0">
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Message… (Enter to send)"
                    rows={1}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none max-h-32"
                    style={{ fieldSizing: 'content' } as any}
                  />
                  <button type="submit" disabled={!inputText.trim() || sending}
                    className="w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 flex items-center justify-center transition shrink-0">
                    {sending ? <RefreshCw className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Resume panel */}
          {showResume && activeChat && (
            <div className="col-span-3 border-l border-white/8 bg-zinc-950/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Candidate Profile</span>
                <button onClick={() => setShowResume(false)} className="text-zinc-600 hover:text-white transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <ResumePanel candidateId={activeChat.candidateId} getToken={getToken} />
            </div>
          )}

        </div>
      </div>
    </RecruiterLayout>
  );
}
