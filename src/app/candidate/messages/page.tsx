// src/app/candidate/messages/page.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { 
  Send, RefreshCw, MessageSquare, Briefcase, 
  User as UserIcon, Calendar, Check, ExternalLink, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const API = 'http://127.0.0.1:5000/api';

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || 'U';
};

const formatTime = (ts: string) => {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
};

export default function CandidateMessagesPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (user?.role !== 'candidate') {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  // Load chat channels
  useEffect(() => {
    if (!user?.id) return;

    const loadChats = async () => {
      try {
        const res = await fetch(`${API}/chats?role=candidate`, {
          headers: { 'Authorization': `Bearer mock_token_for_${user.id}` }
        });
        if (res.ok) {
          const data = await res.json();
          setChats(data.chats || []);
        }
      } catch (err) {
        console.error('Failed to load chats:', err);
      } finally {
        setLoadingChats(false);
      }
    };

    loadChats();
    // Poll for new chat updates
    const interval = setInterval(loadChats, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Load messages for active chat
  useEffect(() => {
    if (!activeChat?.id || !user?.id) return;

    const loadMessages = async (silent = false) => {
      if (!silent) setLoadingMessages(true);
      try {
        const res = await fetch(`${API}/chats/${activeChat.id}/messages`, {
          headers: { 'Authorization': `Bearer mock_token_for_${user.id}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    };

    loadMessages();
    // Polling for real-time messages
    const interval = setInterval(() => loadMessages(true), 3000);
    return () => clearInterval(interval);
  }, [activeChat, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat?.id || !user || sending) return;

    setSending(true);
    const sentText = inputText;
    setInputText('');

    try {
      const res = await fetch(`${API}/chats/${activeChat.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock_token_for_${user.id}`
        },
        body: JSON.stringify({
          text: sentText,
          senderId: user.id,
          senderName: user.name
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
      } else {
        toast.error('Failed to send message.');
        setInputText(sentText);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to connect to chat server.');
      setInputText(sentText);
    } finally {
      setSending(false);
    }
  };

  return (
    <CandidateLayout>
      <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-10rem)] space-y-4">
        
        {/* Header Title */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-indigo-400" />
              Message Center
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Connect in real-time with recruiters reviewing your active applications.</p>
          </div>
        </div>

        {/* Dashboard Frame */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/5 border border-white/10 rounded-3xl overflow-hidden glass shadow-2xl">
          
          {/* LEFT SIDEBAR: ACTIVE CHATS LIST */}
          <div className="border-r border-white/10 flex flex-col h-full bg-slate-950/20">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-950/40">
              <span className="text-xs font-bold font-mono tracking-wider text-zinc-400 uppercase">Conversations</span>
              <span className="text-[10px] font-mono font-bold bg-indigo-500/20 px-2 py-0.5 rounded text-indigo-300">
                {chats.length} Active
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
              {loadingChats ? (
                <div className="p-8 flex items-center justify-center gap-2 text-zinc-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  Loading your chats...
                </div>
              ) : chats.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <MessageSquare className="w-10 h-10 mx-auto text-zinc-700" />
                  <p className="text-xs text-zinc-400 leading-normal">
                    No active chats yet. Once a recruiter initiates review or requests an interview, channels will appear here automatically!
                  </p>
                </div>
              ) : (
                chats.map((c) => {
                  const isSelected = activeChat?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveChat(c)}
                      className={`w-full text-left p-4 transition-all duration-300 flex items-start gap-3 hover:bg-white/5 ${
                        isSelected ? 'bg-indigo-600/10 border-l-4 border-indigo-500' : ''
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-black text-white shrink-0 shadow-lg text-xs">
                        {getInitials(c.recruiterName)}
                      </div>
                      <div className="flex-1 truncate space-y-1">
                        <div className="flex justify-between items-baseline">
                          <h4 className="text-xs font-bold text-white truncate">{c.recruiterName}</h4>
                          <span className="text-[8px] text-zinc-500 font-mono">
                            {formatTime(c.lastMessageTimestamp)}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-medium truncate flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-zinc-500 shrink-0" /> {c.jobTitle}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate italic">
                          {c.lastMessage || 'Channel initialized. Speak with recruiter...'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR: ACTIVE THREAD */}
          <div className="md:col-span-2 flex flex-col h-full bg-slate-950/10">
            {activeChat ? (
              <>
                {/* Active chat header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/40">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center font-black text-white shrink-0 shadow-lg text-xs">
                      {getInitials(activeChat.recruiterName)}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">{activeChat.recruiterName}</h3>
                      <p className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium mt-0.5">
                        <Briefcase className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> {activeChat.jobTitle}
                      </p>
                    </div>
                  </div>

                  {/* Calendar Quick action */}
                  <Link href={`/candidate/jobs/${activeChat.jobId}`} passHref>
                    <button className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider font-bold py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-zinc-300 transition duration-300 active:scale-95 cursor-pointer">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Book Interview
                    </button>
                  </Link>
                </div>

                {/* Messages log */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 scrollbar-thin">
                  {loadingMessages ? (
                    <div className="flex justify-center py-12 text-zinc-400 text-xs items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> Loading message stream...
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isCandidate = msg.senderId === user?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isCandidate ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs md:max-w-md p-3.5 rounded-2xl text-xs leading-relaxed border relative ${
                              isCandidate
                                ? 'bg-gradient-to-br from-indigo-600 to-purple-600 border-indigo-400/20 text-white rounded-br-none shadow shadow-indigo-500/10'
                                : 'bg-white/5 border-white/10 text-zinc-200 rounded-bl-none'
                            }`}
                          >
                            <p>{msg.text}</p>
                            <span className="text-[8px] font-mono text-zinc-400 block text-right mt-1.5 select-none">
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat input box */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-slate-950/40">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type your message here..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || sending}
                      className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center shrink-0 transition disabled:opacity-50 active:scale-95 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                <MessageSquare className="w-12 h-12 text-zinc-800" />
                <h3 className="font-bold text-zinc-400">Select a Conversation</h3>
                <p className="text-xs text-zinc-500 max-w-sm leading-normal">
                  Choose a recruiter from the left panel to display the conversation log and reply inline.
                </p>
              </div>
            )}
          </div>

        </div>

      </div>
    </CandidateLayout>
  );
}
