// src/app/companies/[id]/page.tsx
'use client';

import React, { useEffect, useState, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import CandidateLayout from '@/components/layout/CandidateLayout';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { 
  Building2, Star, MapPin, Users, Info, MessageSquare, 
  DollarSign, Send, HelpCircle, User, StarHalf, PlusCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const companyId = resolvedParams.id;
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [company, setCompany] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [qna, setQna] = useState<any[]>([]);
  const [salaries, setSalaries] = useState<any>({});
  const [selectedTitle, setSelectedTitle] = useState('Flutter Developer');

  // Interactive Inputs
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'qna' | 'salaries'>('overview');
  const [loading, setLoading] = useState(true);

  // Review Submissions
  const [rating, setRating] = useState(5);
  const [wlb, setWlb] = useState(5);
  const [compVal, setCompVal] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Q&A Question Submissions
  const [questionText, setQuestionText] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // Q&A Answer inputs
  const [answerInputs, setAnswerInputs] = useState<{[key: string]: string}>({});

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Load detailed records
  const loadCompanyData = async () => {
    try {
      const compRes = await fetch(`${API}/companies/${companyId}`);
      const revRes = await fetch(`${API}/companies/${companyId}/reviews`);
      const qnaRes = await fetch(`${API}/companies/${companyId}/qna`);
      const salRes = await fetch(`${API}/stats/salaries`);

      if (compRes.ok && revRes.ok && qnaRes.ok && salRes.ok) {
        const compData = await compRes.json();
        const revData = await revRes.json();
        const qnaData = await qnaRes.json();
        const salData = await salRes.json();

        setCompany(compData.company || null);
        setReviews(revData.reviews || []);
        setQna(qnaData.qna || []);
        setSalaries(salData.salaries || {});
        if (salData.salaries && Object.keys(salData.salaries).length > 0) {
          setSelectedTitle(Object.keys(salData.salaries)[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load company detail metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanyData();
  }, [companyId]);

  // Submit Review
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;

    setSubmittingReview(true);
    try {
      const token = user?.id ? `mock_token_for_${user.id}` : 'mock_token';
      const res = await fetch(`${API}/companies/${companyId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rating,
          workLifeBalance: wlb,
          compensation: compVal,
          reviewText
        })
      });

      if (res.ok) {
        toast.success('Your anonymous employee review has been posted!');
        setReviewText('');
        loadCompanyData();
      } else {
        toast.error('Failed to submit review.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network connection issues.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Submit Question
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    setSubmittingQuestion(true);
    try {
      const token = user?.id ? `mock_token_for_${user.id}` : 'mock_token';
      const res = await fetch(`${API}/companies/${companyId}/qna`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: questionText,
          askedBy: user?.role === 'recruiter' ? 'Recruiter' : 'Candidate'
        })
      });

      if (res.ok) {
        toast.success('Your question was posted to the company forum!');
        setQuestionText('');
        loadCompanyData();
      } else {
        toast.error('Question post failed.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // Submit Answer to a Question (Recruiter/Employee action)
  const handleAnswerSubmit = async (questionId: string) => {
    const text = answerInputs[questionId];
    if (!text || !text.trim()) return;

    try {
      const token = user?.id ? `mock_token_for_${user.id}` : 'mock_token';
      const res = await fetch(`${API}/companies/${companyId}/qna`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: qna.find(q => q.id === questionId)?.question || '',
          answer: text,
          answeredBy: user?.name || 'Recruiter'
        })
      });

      if (res.ok) {
        toast.success('Answer published successfully.');
        setAnswerInputs(prev => ({...prev, [questionId]: ''}));
        loadCompanyData();
      } else {
        toast.error('Publishing answer failed.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getSalaryStats = () => {
    return salaries[selectedTitle] || { low: 70000, median: 100000, high: 140000, avg: 102000, curve: [20, 40, 60, 80, 60, 40, 20] };
  };

  if (loading) {
    const Layout = user?.role === 'recruiter' ? RecruiterLayout : CandidateLayout;
    return (
      <Layout>
        <div className="flex justify-center items-center h-[calc(100vh-12rem)] text-zinc-400 text-xs gap-2">
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          Loading company workspace...
        </div>
      </Layout>
    );
  }

  if (!company) {
    const Layout = user?.role === 'recruiter' ? RecruiterLayout : CandidateLayout;
    return (
      <Layout>
        <div className="text-center py-20 text-white space-y-4">
          <h2 className="text-2xl font-bold">Company profile could not be located.</h2>
          <button className="text-indigo-400 font-bold" onClick={() => router.push('/companies')}>Return to Directory</button>
        </div>
      </Layout>
    );
  }

  const Layout = user?.role === 'recruiter' ? RecruiterLayout : CandidateLayout;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto text-white space-y-8 pb-12">
        
        {/* Header Glass Box */}
        <div className="relative bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 glass overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full filter blur-[80px] -z-10 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <img
              src={company.logoUrl || "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=100&auto=format&fit=crop&q=60"}
              alt={company.name}
              className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border border-white/10 shadow-lg"
            />
            
            <div className="flex-1 text-center md:text-left space-y-4">
              <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white">{company.name}</h1>
                <p className="text-xs text-indigo-400 font-bold">{company.industry}</p>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-semibold">
                  <MapPin className="w-4 h-4 text-zinc-500" /> {company.location}
                </span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <Users className="w-4 h-4 text-zinc-500" /> {company.employeesCount} Employees
                </span>
                <span className="flex items-center gap-1 font-bold text-yellow-500">
                  <Star className="w-4 h-4 fill-yellow-500" /> 4.8 Rating
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="border-b border-white/10 flex gap-4 text-xs font-bold uppercase tracking-wider font-mono">
          {(['overview', 'reviews', 'qna', 'salaries'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'border-indigo-400 text-white font-extrabold' 
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab === 'qna' ? 'Forum Q&A' : tab}
            </button>
          ))}
        </div>

        {/* Tab content panel */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 glass space-y-4">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Info className="w-5 h-5 text-indigo-400" /> About {company.name}
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                    {company.bio}
                  </p>
                </div>
              </div>

              {/* Sidebar stats panel */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 glass h-fit space-y-4">
                <h4 className="text-xs font-bold font-mono tracking-widest text-zinc-400 uppercase">Ecosystem Insights</h4>
                <div className="space-y-3.5 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-bold">WLB Score:</span>
                    <span className="text-emerald-400 font-extrabold flex items-center gap-0.5">
                      4.7 <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-bold">Compensation Pay:</span>
                    <span className="text-emerald-400 font-extrabold flex items-center gap-0.5">
                      4.9 <Star className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-bold">Q&A Threads:</span>
                    <span className="text-indigo-400 font-bold font-mono">{qna.length} Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {/* Submission Form */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 glass space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-indigo-400" /> Post Anonymous Review
                </h3>
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Overall Score */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block font-bold">Overall Rating (1-5)</label>
                      <input 
                        type="number" min={1} max={5} value={rating} 
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white"
                      />
                    </div>
                    {/* WLB Slider */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block font-bold">Work Life Balance (1-5)</label>
                      <input 
                        type="number" min={1} max={5} value={wlb} 
                        onChange={(e) => setWlb(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white"
                      />
                    </div>
                    {/* Pay slider */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block font-bold">Compensation (1-5)</label>
                      <input 
                        type="number" min={1} max={5} value={compVal} 
                        onChange={(e) => setCompVal(Number(e.target.value))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block font-bold">Review text description</label>
                    <textarea
                      placeholder="Share your honest thoughts concerning WLB, compensation, culture and growth path..."
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      rows={3}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReview || !reviewText.trim()}
                    className="w-full md:w-fit px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold font-mono tracking-wide rounded-xl transition cursor-pointer"
                  >
                    Submit Review Anonymously
                  </button>
                </form>
              </div>

              {/* Reviews Feed */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold font-mono tracking-wider text-zinc-400 uppercase">Employee Feed</h4>
                {reviews.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No reviews found. Be the first to share review stats anonymously!</p>
                ) : (
                  reviews.map((rev) => (
                    <div key={rev.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 glass space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                          <span className="text-xs font-bold text-white">{rev.rating}/5</span>
                        </div>
                        <span className="text-[8px] font-mono text-zinc-500 tracking-wider">
                          {rev.timestamp ? new Date(rev.timestamp).toLocaleDateString() : 'Recent'}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-300 leading-relaxed font-medium">"{rev.reviewText}"</p>

                      <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5 text-[10px] text-zinc-400 font-bold font-mono">
                        <span>Work Life Balance: <strong className="text-indigo-400">{rev.workLifeBalance}</strong></span>
                        <span>Compensation: <strong className="text-indigo-400">{rev.compensation}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'qna' && (
            <div className="space-y-6">
              {/* Question submission box */}
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 glass space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-400" /> Ask a Question
                </h3>
                <form onSubmit={handleQuestionSubmit} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask about hiring steps, assessment format, tech stack..."
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingQuestion || !questionText.trim()}
                    className="px-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </form>
              </div>

              {/* Q&A Thread feed */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold font-mono tracking-wider text-zinc-400 uppercase">Discussion Forum</h4>
                {qna.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No threads listed. Ask a question to start the conversation!</p>
                ) : (
                  qna.map((thread) => (
                    <div key={thread.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 glass space-y-4">
                      {/* Question block */}
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                          <HelpCircle className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono tracking-widest text-zinc-500 font-bold uppercase">{thread.askedBy || 'Anonymous'} Asked</span>
                          <p className="text-xs text-white font-bold">{thread.question}</p>
                        </div>
                      </div>

                      {/* Answer block */}
                      {thread.answer ? (
                        <div className="pl-10 flex items-start gap-3 border-t border-white/5 pt-4">
                          <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-mono tracking-widest text-zinc-500 font-bold uppercase">{thread.answeredBy || 'Staff'} Replied</span>
                            <p className="text-xs text-zinc-300 leading-relaxed font-medium">{thread.answer}</p>
                          </div>
                        </div>
                      ) : (
                        user?.role === 'recruiter' ? (
                          <div className="pl-10 border-t border-white/5 pt-4 flex gap-2">
                            <input
                              type="text"
                              placeholder="Answer this candidate's question..."
                              value={answerInputs[thread.id] || ''}
                              onChange={(e) => setAnswerInputs(prev => ({...prev, [thread.id]: e.target.value}))}
                              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                            />
                            <button
                              onClick={() => handleAnswerSubmit(thread.id)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold cursor-pointer"
                            >
                              Publish Answer
                            </button>
                          </div>
                        ) : (
                          <div className="pl-10 border-t border-white/5 pt-4">
                            <p className="text-xs text-zinc-500 italic">Awaiting response from company recruiters/staff...</p>
                          </div>
                        )
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'salaries' && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 glass space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-indigo-400" /> Salary Explorer Calculators
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Explore competitive salary distributions based on job functions.</p>
                </div>

                {/* Job selection dropdown */}
                <select
                  value={selectedTitle}
                  onChange={(e) => setSelectedTitle(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {Object.keys(salaries).map((title) => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>

              {/* Salary distribution analytics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                {/* Low scale */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase block font-bold">10th Percentile (Low)</span>
                  <strong className="text-lg font-mono text-zinc-300 block mt-2">${getSalaryStats().low.toLocaleString()}</strong>
                </div>
                {/* Median scale */}
                <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-400/20 rounded-2xl p-4 text-center shadow">
                  <span className="text-[10px] font-mono tracking-widest text-indigo-300 uppercase block font-bold">Median (Standard)</span>
                  <strong className="text-xl font-mono text-indigo-300 block mt-2">${getSalaryStats().median.toLocaleString()}</strong>
                </div>
                {/* High scale */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase block font-bold">90th Percentile (High)</span>
                  <strong className="text-lg font-mono text-zinc-300 block mt-2">${getSalaryStats().high.toLocaleString()}</strong>
                </div>
              </div>

              {/* Curve line canvas drawing */}
              <div className="bg-black/40 border border-white/5 rounded-2xl p-6 relative">
                <span className="absolute top-4 left-4 text-[9px] font-mono font-bold tracking-widest text-zinc-500 uppercase">Pay Distribution Curve</span>
                
                {/* Draw SVG Curve */}
                <div className="h-40 flex items-end pt-10">
                  <svg className="w-full h-full" viewBox="0 0 700 150" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818CF8" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#818CF8" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* SVG Line path */}
                    <path
                      d={`M 0 150 C 100 150, 150 ${150 - getSalaryStats().curve[0]}, 200 ${150 - getSalaryStats().curve[1]} 
                           C 250 ${150 - getSalaryStats().curve[2]}, 300 ${150 - getSalaryStats().curve[3]}, 350 ${150 - getSalaryStats().curve[3]} 
                           C 400 ${150 - getSalaryStats().curve[3]}, 450 ${150 - getSalaryStats().curve[4]}, 500 ${150 - getSalaryStats().curve[5]}
                           C 550 ${150 - getSalaryStats().curve[6]}, 600 150, 700 150`}
                      fill="url(#curveGradient)"
                      stroke="#6366F1"
                      strokeWidth="3.5"
                    />
                    
                    {/* Median indicator vertical dashed line */}
                    <line x1="350" y1="0" x2="350" y2="150" stroke="#818CF8" strokeWidth="1.5" strokeDasharray="4 4" />
                  </svg>
                </div>
                
                {/* Curve labels */}
                <div className="flex justify-between text-[9px] font-mono font-bold text-zinc-500 pt-3">
                  <span>Entry Level Pay</span>
                  <span className="text-indigo-400">Competitive Pay Median</span>
                  <span>Senior Staff Level Pay</span>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
