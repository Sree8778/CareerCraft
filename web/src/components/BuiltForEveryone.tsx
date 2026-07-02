'use client';

import { useState, useEffect, useRef, useContext } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Bot, CalendarCheck, CheckCircle, Sparkles, Clock,
  BarChart, Globe, Users, Settings, ActivitySquare, Shield,
  Briefcase, ArrowRight, Zap,
} from 'lucide-react';
import { ModalContext } from '@/contexts/LoginModalContext';

/* ── how it works steps ─────────────────────────────────────── */
const steps = [
  {
    num: '01',
    icon: Search,
    title: 'Set your preferences',
    desc: 'Tell CareerCraft your target roles, preferred locations, salary range, and upload or build your resume in minutes.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    glow: 'from-violet-600/20',
  },
  {
    num: '02',
    icon: Bot,
    title: 'AI applies on your behalf',
    desc: 'Our autonomous agent scrapes 10K+ jobs daily, matches them to your profile, and submits applications 24/7 — even while you sleep.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    glow: 'from-pink-600/20',
  },
  {
    num: '03',
    icon: CalendarCheck,
    title: 'Show up for interviews',
    desc: 'You get notified of responses and prep with our AI voice interview coach. Then show up, close the offer.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    glow: 'from-cyan-600/20',
  },
];

/* ── role features ──────────────────────────────────────────── */
const candidateFeatures = [
  { icon: Sparkles,       text: 'AI-powered job matching with 95% accuracy'             },
  { icon: Bot,            text: 'Autonomous applications to company career pages'        },
  { icon: Clock,          text: 'Real-time tracking and interview scheduling'            },
  { icon: BarChart,       text: 'Resume scoring, ATS optimization, and gap analysis'     },
  { icon: Globe,          text: 'Multi-source job search across 6+ platforms'            },
];
const recruiterFeatures = [
  { icon: Users,          text: 'Multi-tenant pipeline with white-label branding'        },
  { icon: Settings,       text: 'Advanced candidate filtering and stage management'      },
  { icon: ActivitySquare, text: 'Team collaboration with role-based permissions'         },
  { icon: Shield,         text: 'Automated screening and intelligent interview scheduling'},
  { icon: BarChart,       text: 'Comprehensive analytics and hiring performance insights' },
];

/* ── animated counter ───────────────────────────────────────── */
function Counter({ value, suffix = '', duration = 1200 }: { value: number; suffix?: string; duration?: number }) {
  const [n, setN] = useState(0);
  const start = useRef<number>(0);
  useEffect(() => {
    let raf: number;
    const step = (ts: number) => {
      if (!start.current) start.current = ts;
      const p = Math.min((ts - start.current) / duration, 1);
      setN(Math.floor(p * value));
      if (p < 1) raf = requestAnimationFrame(step); else setN(value);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span>{n}{suffix}</span>;
}

const inView = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6 },
};

export default function BuiltForEveryone() {
  const [tab, setTab] = useState<'candidate' | 'recruiter'>('candidate');
  const { openModal } = useContext(ModalContext);

  return (
    <>
      {/* ══════════════════ HOW IT WORKS ══════════════════ */}
      <section className="relative py-24 overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-violet-700/12 rounded-full blur-[130px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <motion.div {...inView} className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 mb-4">
              How It Works
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              From setup to offer{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
                in 3 steps
              </span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* connector line (desktop) */}
            <div className="hidden md:block absolute top-10 left-[calc(16.6%+1.5rem)] right-[calc(16.6%+1.5rem)] h-px bg-gradient-to-r from-violet-500/30 via-pink-500/30 to-cyan-500/30" />

            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.55, delay: i * 0.12 }}
                  className={`relative rounded-3xl border ${s.border} bg-gradient-to-br ${s.glow} to-transparent p-7 group hover:border-opacity-60 transition-all duration-300`}
                >
                  <div className={`w-12 h-12 rounded-2xl ${s.bg} border ${s.border} flex items-center justify-center mb-5 relative z-10`}>
                    <Icon className={`w-6 h-6 ${s.color}`} />
                  </div>
                  <span className="text-5xl font-black text-white/[0.04] absolute top-5 right-6 select-none">{s.num}</span>
                  <h3 className="text-lg font-bold text-white mb-3">{s.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════ BUILT FOR EVERYONE ══════════════════ */}
      <section className="relative py-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-3/4 h-80 bg-gradient-to-r from-blue-600/10 via-violet-600/10 to-pink-600/10 blur-3xl rounded-3xl" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <motion.div {...inView} className="text-center mb-14">
            <span className="inline-block px-4 py-1 rounded-full text-xs font-medium text-pink-300 bg-pink-500/10 border border-pink-500/20 mb-4">
              For Everyone
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Built for{' '}
              <span className="bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">
                every ambition
              </span>
            </h2>
          </motion.div>

          <div className="max-w-5xl mx-auto rounded-3xl bg-white/[0.03] border border-white/[0.07] p-8 md:p-12">
            {/* tabs */}
            <div className="flex gap-2 mb-10 bg-white/[0.04] rounded-2xl p-1.5 w-fit mx-auto border border-white/[0.07]">
              {(['candidate', 'recruiter'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setTab(role)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    tab === role
                      ? 'bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-[0_4px_20px_rgba(124,58,237,0.35)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {role === 'candidate' ? 'For Candidates' : 'For Recruiters'}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* feature list */}
              <div>
                <h3 className="text-2xl font-bold text-white mb-6">
                  {tab === 'candidate' ? 'Your career, supercharged' : 'Recruitment, reimagined'}
                </h3>
                <ul className="space-y-4">
                  {(tab === 'candidate' ? candidateFeatures : recruiterFeatures).map((f, i) => {
                    const FIcon = f.icon;
                    return (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.07 }}
                        className="flex items-start gap-3 text-zinc-300 text-sm"
                      >
                        <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FIcon className="w-3.5 h-3.5 text-violet-400" />
                        </div>
                        {f.text}
                      </motion.li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => openModal('signup')}
                  className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold text-sm hover:shadow-[0_0_40px_rgba(124,58,237,0.4)] transition-all duration-300"
                >
                  {tab === 'candidate' ? 'Start Your Journey' : 'Transform Your Agency'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* stat card */}
              <div className="flex justify-center">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="relative rounded-3xl bg-gradient-to-br from-violet-600/20 to-pink-600/20 border border-violet-500/20 p-10 text-center w-full max-w-xs overflow-hidden"
                >
                  <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.03) 1px,transparent 1px)', backgroundSize: '18px 18px' }} />
                  <div className="relative z-10">
                    <div className="text-6xl font-black text-white mb-2">
                      {tab === 'candidate'
                        ? <><Counter value={85} suffix="%" /></>
                        : <><Counter value={3} suffix="x" /></>
                      }
                    </div>
                    <p className="text-zinc-300 text-sm leading-relaxed">
                      {tab === 'candidate'
                        ? 'of candidates find their dream role within 30 days'
                        : 'faster time-to-hire with automated workflows'
                      }
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
                      <Zap className="w-3.5 h-3.5 text-violet-400" />
                      Powered by AI
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ FINAL CTA ══════════════════ */}
      <section className="relative py-28 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-violet-600/20 rounded-full blur-[130px]" />
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.03) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

        <motion.div {...inView} className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Start today — it's free
          </span>
          <h2 className="text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.05]">
            Your next job is{' '}
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              one click away
            </span>
          </h2>
          <p className="mt-6 text-lg text-zinc-400 max-w-xl mx-auto">
            Join 50,000+ candidates letting AI do the heavy lifting. Set up in 5 minutes. Get interviews within days.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => openModal('signup')}
              className="group inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-base shadow-[0_0_60px_rgba(124,58,237,0.45)] hover:shadow-[0_0_80px_rgba(124,58,237,0.65)] transition-all duration-300"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => openModal('login')}
              className="inline-flex items-center px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold text-base hover:bg-white/10 transition-all"
            >
              Sign In
            </button>
          </div>
          <p className="mt-6 text-xs text-zinc-600">No credit card required · Free forever on base plan</p>
        </motion.div>
      </section>
    </>
  );
}
