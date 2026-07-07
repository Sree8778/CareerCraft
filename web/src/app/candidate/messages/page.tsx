// src/app/candidate/messages/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { API_BASE, authHeader } from '@/lib/api';
import { db } from '@/lib/firebase';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  Send, MessageSquare, Briefcase, RefreshCw,
  CheckCheck, Check, Sparkles,
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
  'from-indigo-600 to-purple-600', 'from-pink-600 to-rose-600',
  'from-cyan-600 to-blue-600',    'from-emerald-600 to-teal-600',
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function CandidateMessagesPage() {
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();
  const router = useRouter();

  const [chats,       setChats]       = useState<any[]>([]);
  const [activeChat,  setActiveChat]  = useState<any | null>(null);
  const [messages,    setMessages]    = useState<any[]>([]);
  const [inputText,   setInputText]   = useState('');
  const [sending,     setSending]     = useState(false);
  const [chatsReady,  setChatsReady]  = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);

  // ── Auth guard ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'candidate') router.push('/');
  }, [authLoading, isAuthenticated, user, router]);

  // ── Real-time chat list ────────────────────────────────────────────────────
  // Firestore: listen to chats where candidateId == uid OR recruiterId == uid
  // (same-role direct messages land in the "wrong" field)

  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const q1 = query(collection(db, 'chats'), where('candidateId', '==', uid));
    const q2 = query(collection(db, 'chats'), where('recruiterId', '==', uid));

    const seen = new Map<string, any>();
    const merge = (docs: any[]) => {
      docs.forEach(d => seen.set(d.id, d));
      const sorted = [...seen.values()].sort(
        (a, b) => tsToMs(b.lastMessageTimestamp) - tsToMs(a.lastMessageTimestamp)
      );
      setChats(sorted);
      setChatsReady(true);
    };

    const unsub1 = onSnapshot(q1, snap => {
      snap.docs.forEach(d => seen.set(d.id, { id: d.id, ...d.data() }));
      merge([]);
    }, () => {});

    const unsub2 = onSnapshot(q2, snap => {
      snap.docs.forEach(d => seen.set(d.id, { id: d.id, ...d.data() }));
      merge([]);
    }, () => {});

    return () => { unsub1(); unsub2(); };
  }, [user?.id]);

  // ── Real-time message thread ───────────────────────────────────────────────

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

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !activeChat?.id || !user || sending) return;

    setSending(true);
    setInputText('');

    try {
      // Optimistic local add
      const optimistic = { id: `opt-${Date.now()}`, text, senderId: user.id, senderName: user.name, timestamp: { _seconds: Date.now() / 1000 }, optimistic: true };
      setMessages(prev => [...prev, optimistic]);

      // Write directly to Firestore subcollection (mirrors what the REST API does)
      const chatRef  = doc(db, 'chats', activeChat.id);
      const msgsRef  = collection(db, 'chats', activeChat.id, 'messages');
      const msgDoc   = await addDoc(msgsRef, {
        text,
        senderId:   user.id,
        senderName: user.name,
        timestamp:  serverTimestamp(),
      });

      // Update chat's lastMessage
      await updateDoc(chatRef, {
        lastMessage:          text,
        lastMessageTimestamp: serverTimestamp(),
      });

      // Remove optimistic, real doc will arrive via onSnapshot
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      void msgDoc;

    } catch {
      toast.error('Failed to send message');
      setInputText(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [inputText, activeChat?.id, user, sending]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <CandidateLayout>
      <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
        {/* Header */}
        <div className="mb-4 shrink-0">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" /> Messages
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Real-time chat with recruiters</p>
        </div>

        {/* Chat frame */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 rounded-2xl border border-white/10 overflow-hidden bg-zinc-950/50 backdrop-blur">

          {/* Sidebar */}
          <div className="border-r border-white/8 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Conversations</span>
              <span className="text-[10px] font-mono bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 px-2 py-0.5 rounded-full">
                {chats.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {!chatsReady ? (
                <div className="p-8 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> Loading…
                </div>
              ) : chats.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <MessageSquare className="w-10 h-10 mx-auto text-zinc-800" />
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    No conversations yet. Once a recruiter opens a chat from your application, it will appear here.
                  </p>
                </div>
              ) : (
                chats.map((c, i) => {
                  const isActive  = activeChat?.id === c.id;
                  const contact   = c.candidateId === user?.id ? c.recruiterName : c.candidateName;
                  const gradient  = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
                  return (
                    <button key={c.id} onClick={() => setActiveChat(c)}
                      className={`w-full text-left p-4 flex items-start gap-3 transition-all ${
                        isActive ? 'bg-indigo-600/10 border-l-2 border-indigo-500' : 'hover:bg-white/3'
                      }`}>
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-black text-white shrink-0`}>
                        {getInitials(contact)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="text-xs font-semibold text-white truncate">{contact}</span>
                          <span className="text-[9px] text-zinc-600 font-mono shrink-0">{relativeTime(c.lastMessageTimestamp)}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Briefcase className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{c.jobTitle}</span>
                        </p>
                        <p className="text-[10px] text-zinc-600 truncate mt-0.5 italic">{c.lastMessage || 'Chat started'}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Message thread */}
          <div className="md:col-span-2 flex flex-col overflow-hidden">
            {!activeChat ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600">
                <MessageSquare className="w-12 h-12" />
                <p className="text-sm font-semibold">Select a conversation</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-3 shrink-0 bg-zinc-950/40">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-black text-white">
                    {getInitials(activeChat.candidateId === user?.id ? activeChat.recruiterName : activeChat.candidateName)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {activeChat.candidateId === user?.id ? activeChat.recruiterName : activeChat.candidateName}
                    </p>
                    <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <Briefcase className="w-2.5 h-2.5" /> {activeChat.jobTitle}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-mono">Live</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <AnimatePresence initial={false}>
                    {messages.map(msg => {
                      const isMine = msg.senderId === user?.id;
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2`}
                        >
                          {!isMine && (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-[9px] font-black text-white shrink-0 mb-0.5">
                              {getInitials(msg.senderName)}
                            </div>
                          )}
                          <div className={`max-w-[70%] space-y-0.5 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isMine
                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                : 'bg-white/8 text-zinc-200 rounded-bl-sm'
                            } ${msg.optimistic ? 'opacity-60' : ''}`}>
                              {msg.text}
                            </div>
                            <div className={`flex items-center gap-1 text-[9px] text-zinc-600 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              {msgTime(msg.timestamp)}
                              {isMine && (msg.optimistic
                                ? <Check className="w-2.5 h-2.5" />
                                : <CheckCheck className="w-2.5 h-2.5 text-indigo-400" />)}
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
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    placeholder="Type a message… (Enter to send)"
                    rows={1}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none max-h-32 overflow-y-auto"
                    style={{ fieldSizing: 'content' } as any}
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shrink-0"
                  >
                    {sending
                      ? <RefreshCw className="w-4 h-4 text-white animate-spin" />
                      : <Send className="w-4 h-4 text-white" />}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </CandidateLayout>
  );
}
