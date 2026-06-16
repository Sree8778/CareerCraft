// src/app/recruiter/messages/page.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { 
  Send, RefreshCw, MessageSquare, Briefcase, 
  User as UserIcon, Calendar, Check, ExternalLink, Sparkles,
  Phone, Mail, MapPin, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || 'U';
};

const formatTime = (ts: string) => {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
};

export default function RecruiterMessagesPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  // Resume detail states for the side preview panel
  const [resumeData, setResumeData] = useState<any | null>(null);
  const [loadingResume, setLoadingResume] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    } else if (user?.role !== 'recruiter') {
      router.push('/');
    }
  }, [isAuthenticated, user, router]);

  // Load chat channels
  useEffect(() => {
    if (!user?.id) return;

    const loadChats = async () => {
      try {
        const res = await fetch(`${API}/chats?role=recruiter`, {
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
    const interval = setInterval(() => loadMessages(true), 3000);
    return () => clearInterval(interval);
  }, [activeChat, user]);

  // Load candidate resume preview details on chat selection
  useEffect(() => {
    if (!activeChat?.candidateId || !user?.id) return;
    
    const fetchResume = async () => {
      setLoadingResume(true);
      setResumeData(null);
      try {
        const res = await fetch(`${API}/candidates/${activeChat.candidateId}/resume`, {
          headers: { 'Authorization': `Bearer mock_token_for_${user.id}` }
        });
        if (res.ok) {
          const data = await res.json();
          setResumeData(data.resumeData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingResume(false);
      }
    };

    fetchResume();
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
    <RecruiterLayout>
      <div className="max-w-7xl mx-auto flex flex-col h-[calc(100vh-10rem)] space-y-4 text-white">
        
        {/* Header Title */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              <MessageSquare className="w-8 h-8 text-purple-400" />
              Talent Communication Center
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Converse directly with applicants to speed up screening and pipeline scheduling.</p>
          </div>
        </div>

        {/* Dashboard Frame */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 bg-white/5 border border-white/10 rounded-3xl overflow-hidden glass shadow-2xl">
          
          {/* LEFT SIDEBAR: ACTIVE CHATS LIST */}
          <div className="border-r border-white/10 flex flex-col h-full bg-slate-950/20">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-950/40">
              <span className="text-xs font-bold font-mono tracking-wider text-zinc-400 uppercase">Applicant Channels</span>
              <span className="text-[10px] font-mono font-bold bg-purple-500/20 px-2 py-0.5 rounded text-purple-300">
                {chats.length} Active
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/5 scrollbar-thin">
              {loadingChats ? (
                <div className="p-8 flex items-center justify-center gap-2 text-zinc-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                  Loading channels...
                </div>
              ) : chats.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <MessageSquare className="w-10 h-10 mx-auto text-zinc-700" />
                  <p className="text-xs text-zinc-400 leading-normal">
                    No active messages. Direct messages are initialized when you screen applications or schedule interviews!
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
                        isSelected ? 'bg-purple-600/10 border-l-4 border-purple-500' : ''
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-black text-white shrink-0 shadow-lg text-xs">
                        {getInitials(c.candidateName)}
                      </div>
                      <div className="flex-1 truncate space-y-1">
                        <div className="flex justify-between items-baseline">
                          <h4 className="text-xs font-bold text-white truncate">{c.candidateName}</h4>
                          <span className="text-[8px] text-zinc-500 font-mono">
                            {formatTime(c.lastMessageTimestamp)}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-medium truncate flex items-center gap-1">
                          <Briefcase className="w-3 h-3 text-zinc-500 shrink-0" /> {c.jobTitle}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate italic">
                          {c.lastMessage || 'Channel created. Write candidate...'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* MAIN MESSAGE WINDOW & INLINE SIDEBAR */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 h-full">
            
            {/* THREAD WINDOW */}
            <div className="md:col-span-2 border-r border-white/10 flex flex-col h-full bg-slate-950/10">
              {activeChat ? (
                <>
                  {/* Chat header */}
                  <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-950/40">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-black text-white shrink-0 shadow-lg text-xs">
                        {getInitials(activeChat.candidateName)}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">{activeChat.candidateName}</h3>
                        <p className="text-[10px] text-zinc-400 flex items-center gap-1 font-medium mt-0.5">
                          <Briefcase className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> {activeChat.jobTitle}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Message logs */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-4 scrollbar-thin">
                    {loadingMessages ? (
                      <div className="flex justify-center py-12 text-zinc-400 text-xs items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 animate-spin text-purple-400" /> Loading message stream...
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isRecruiter = msg.senderId === user?.id;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isRecruiter ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-xs md:max-w-md p-3.5 rounded-2xl text-xs leading-relaxed border relative ${
                                isRecruiter
                                  ? 'bg-gradient-to-br from-purple-600 to-indigo-600 border-purple-400/20 text-white rounded-br-none shadow shadow-purple-500/10'
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

                  {/* Input form */}
                  <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-slate-950/40">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type your message here..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={!inputText.trim() || sending}
                        className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center shrink-0 transition disabled:opacity-50 active:scale-95 cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <MessageSquare className="w-12 h-12 text-zinc-800" />
                  <h3 className="font-bold text-zinc-400">Select an Applicant Conversation</h3>
                  <p className="text-xs text-zinc-500 max-w-sm leading-normal">
                    Choose a candidate channel from the list to display their application details and text timeline.
                  </p>
                </div>
              )}
            </div>

            {/* SIDE PREVIEW PANEL */}
            <div className="hidden md:flex flex-col h-full bg-slate-950/30 overflow-y-auto p-4 scrollbar-thin">
              {activeChat ? (
                loadingResume ? (
                  <div className="flex items-center justify-center h-full text-zinc-500 text-xs gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" /> Fetching resume...
                  </div>
                ) : resumeData ? (
                  <div className="space-y-4 text-xs">
                    <div className="pb-3 border-b border-white/10">
                      <h4 className="font-bold uppercase tracking-wider text-purple-400 text-[10px] flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5" /> Candidate profile
                      </h4>
                      <p className="text-sm font-semibold text-white mt-1.5">{activeChat.candidateName}</p>
                      
                      <div className="mt-2.5 space-y-1.5 text-zinc-400 text-[10px]">
                        {resumeData.personal?.email && (
                          <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-zinc-600" />{resumeData.personal.email}</span>
                        )}
                        {resumeData.personal?.phone && (
                          <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-zinc-600" />{resumeData.personal.phone}</span>
                        )}
                        {resumeData.personal?.location && (
                          <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-zinc-600" />{resumeData.personal.location}</span>
                        )}
                      </div>
                    </div>

                    {resumeData.summary && (
                      <div className="space-y-1 pb-3 border-b border-white/5">
                        <span className="font-bold text-[9px] uppercase tracking-wider text-purple-400">Professional Summary</span>
                        <p className="text-zinc-300 leading-normal text-[10px]" dangerouslySetInnerHTML={{ __html: resumeData.summary }} />
                      </div>
                    )}

                    {resumeData.skills && resumeData.skills.length > 0 && (
                      <div className="space-y-2 pb-3 border-b border-white/5">
                        <span className="font-bold text-[9px] uppercase tracking-wider text-purple-400 block">Skills Attributes</span>
                        <div className="flex flex-wrap gap-1">
                          {resumeData.skills.flatMap((s: any) => {
                            if (typeof s === 'string') return [s];
                            if (s.skills_list) return String(s.skills_list).split(',').map((x: string) => x.trim()).filter(Boolean);
                            return [];
                          }).slice(0, 10).map((skill: string, index: number) => (
                            <span key={index} className="bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[8px] font-mono px-2 py-0.5 rounded">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {resumeData.experience && resumeData.experience.length > 0 && (
                      <div className="space-y-2">
                        <span className="font-bold text-[9px] uppercase tracking-wider text-purple-400 block">Recent Experience</span>
                        <div className="space-y-2.5">
                          {resumeData.experience.slice(0, 2).map((exp: any, index: number) => (
                            <div key={index} className="border-l border-white/10 pl-2">
                              <p className="font-bold text-white text-[10px]">{exp.jobTitle}</p>
                              <p className="text-purple-300 text-[9px]">{exp.company} · {exp.dates}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-center text-zinc-500 text-xs">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-zinc-700 block" />
                    No parsed profile found.
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-center text-xs">
                  Select a chat channel to view applicant details.
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </RecruiterLayout>
  );
}
