'use client';

import { motion } from 'framer-motion';
import {
  Bot, FileText, Mic, Globe, KeyRound, BarChart3,
  CheckCircle, Zap, Star,
} from 'lucide-react';

/* ── bento feature data ─────────────────────────────────────── */
const features = [
  {
    icon: Bot,
    title: 'Autonomous Apply',
    desc: 'AI agent opens company career pages, fills every form field, uploads your resume, and submits — hands-free, 24/7.',
    gradient: 'from-violet-500/[0.12] to-purple-900/20',
    border: 'border-violet-500/20 hover:border-violet-500/40',
    iconGrad: 'from-violet-500 to-purple-600',
    tag: 'Core Feature',
    tagColor: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    wide: true,
    tall: true,
    visual: (
      <div className="mt-5 space-y-2">
        {[
          { co: 'Stripe',   role: 'Sr. Frontend Eng.',  s: 'Applied ✓', c: 'text-emerald-400' },
          { co: 'Vercel',   role: 'Full Stack Dev.',     s: 'Applying…', c: 'text-amber-400'   },
          { co: 'Linear',   role: 'React Engineer',      s: 'Queued',    c: 'text-zinc-500'    },
          { co: 'Figma',    role: 'UI Engineer',         s: 'Queued',    c: 'text-zinc-500'    },
        ].map((r, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/40 to-pink-500/40 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white">{r.co[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-white truncate">{r.co}</p>
              <p className="text-[10px] text-zinc-500 truncate">{r.role}</p>
            </div>
            <span className={`text-[10px] font-semibold ${r.c}`}>{r.s}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: FileText,
    title: 'AI Resume Builder',
    desc: 'Multiple ATS-optimized templates, AI-powered content enhancement, real-time score, and one-click PDF export.',
    gradient: 'from-pink-500/[0.10] to-rose-900/20',
    border: 'border-pink-500/20 hover:border-pink-500/40',
    iconGrad: 'from-pink-500 to-rose-600',
    tag: 'ATS Ready',
    tagColor: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
    wide: false,
    tall: false,
    visual: (
      <div className="mt-4 flex items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-pink-500 flex items-center justify-center">
          <span className="text-lg font-black text-white">94</span>
        </div>
        <div className="space-y-1.5">
          {['Keywords', 'Format', 'Length'].map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-1.5 rounded-full bg-white/[0.06] w-20 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full" style={{ width: `${[88, 95, 82][i]}%` }} />
              </div>
              <span className="text-[10px] text-zinc-500">{l}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Mic,
    title: 'Voice Interview Coach',
    desc: 'Practice with an AI interviewer. Get real-time feedback on clarity, confidence, and content.',
    gradient: 'from-cyan-500/[0.10] to-blue-900/20',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    iconGrad: 'from-cyan-500 to-blue-600',
    tag: 'AI Powered',
    tagColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    wide: false,
    tall: false,
    visual: (
      <div className="mt-4 flex items-center justify-center gap-1">
        {[3, 5, 8, 12, 8, 14, 10, 6, 11, 8, 5, 9, 7, 4].map((h, i) => (
          <motion.div
            key={i}
            animate={{ scaleY: [1, h / 8, 1] }}
            transition={{ duration: 0.8, delay: i * 0.06, repeat: Infinity, ease: 'easeInOut' }}
            className="w-1.5 rounded-full bg-gradient-to-t from-cyan-500 to-blue-400 origin-bottom"
            style={{ height: `${h * 3}px` }}
          />
        ))}
      </div>
    ),
  },
  {
    icon: KeyRound,
    title: 'Bring Your Own AI Key',
    desc: 'Plug in Gemini, OpenAI, Claude, Groq, or NVIDIA NIM. Your keys, your costs — no platform markup.',
    gradient: 'from-amber-500/[0.10] to-orange-900/20',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    iconGrad: 'from-amber-500 to-orange-500',
    tag: 'BYOK',
    tagColor: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    wide: false,
    tall: false,
    visual: (
      <div className="mt-4 grid grid-cols-3 gap-2">
        {['Gemini', 'OpenAI', 'Claude', 'Groq', 'NVIDIA', 'Firecrawl'].map((p, i) => (
          <div key={i} className="flex items-center justify-center px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[10px] text-zinc-400 font-medium">
            {p}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Globe,
    title: 'Multi-Source Job Search',
    desc: 'Aggregates 10K+ jobs daily from Indeed, LinkedIn, RemoteOK, Arbeitnow, Jobicy and more — filtered by location and role.',
    gradient: 'from-emerald-500/[0.10] to-green-900/20',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    iconGrad: 'from-emerald-500 to-green-600',
    tag: '10K+ Daily',
    tagColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    wide: true,
    tall: false,
    visual: (
      <div className="mt-4 flex flex-wrap gap-2">
        {['Indeed', 'LinkedIn', 'RemoteOK', 'Arbeitnow', 'Jobicy', 'Apify'].map((s, i) => (
          <span key={i} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-white bg-white/[0.05] border border-white/[0.08]">
            <Zap className="w-2.5 h-2.5 text-emerald-400" />{s}
          </span>
        ))}
      </div>
    ),
  },
];

/* ── testimonials ──────────────────────────────────────────── */
const testimonials = [
  {
    quote: 'CareerCraft applied to 120 jobs in one night. I woke up with 8 interview requests. This thing is unreal.',
    name: 'Sarah J.', title: 'Software Engineer → Stripe', rating: 5,
  },
  {
    quote: 'The resume builder pushed my ATS score from 62 to 94. Got my first callback within 48 hours.',
    name: 'David L.', title: 'Backend Dev → Vercel', rating: 5,
  },
  {
    quote: 'I used the voice interview coach every day for a week. Crushed every FAANG behavioral round.',
    name: 'Emily R.', title: 'PM → Google', rating: 5,
  },
];

const inView = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6 },
};

export default function FeaturesGrid() {
  return (
    <>
      {/* ══════════════════ BENTO FEATURES ══════════════════ */}
      <section className="relative py-24 overflow-hidden">
        {/* glow */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] bg-violet-700/10 rounded-full blur-[140px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <motion.div {...inView} className="text-center mb-16">
            <span className="inline-block px-4 py-1 rounded-full text-xs font-medium text-violet-300 bg-violet-500/10 border border-violet-500/20 mb-4">
              Features
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                land the job
              </span>
            </h2>
            <p className="mt-4 text-zinc-400 text-lg max-w-xl mx-auto">
              One platform that automates the entire job search — from discovery to offer.
            </p>
          </motion.div>

          {/* bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-auto">
            {features.map((f, i) => {
              const Icon = f.icon;
              const spanClass = f.wide ? 'md:col-span-2' : 'md:col-span-1';
              const rowClass  = f.tall ? 'md:row-span-2' : 'md:row-span-1';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.55, delay: i * 0.08 }}
                  className={`${spanClass} ${rowClass} relative group rounded-3xl border ${f.border} bg-gradient-to-br ${f.gradient} p-6 transition-all duration-300 hover:shadow-[0_0_40px_rgba(124,58,237,0.12)] overflow-hidden`}
                >
                  {/* subtle grid inside card */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl" style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '20px 20px' }} />

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${f.iconGrad} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${f.tagColor}`}>{f.tag}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
                    {f.visual}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════ TESTIMONIALS ══════════════════ */}
      <section className="relative py-24 overflow-hidden">
        <div className="pointer-events-none absolute bottom-0 right-1/4 w-[600px] h-[300px] bg-pink-600/10 rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <motion.div {...inView} className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">
              Real results, real people
            </h2>
            <p className="mt-3 text-zinc-400 text-lg">Join thousands of candidates who landed offers with CareerCraft.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
                className="relative rounded-3xl bg-white/[0.03] border border-white/[0.07] p-7 hover:border-white/[0.14] hover:bg-white/[0.05] transition-all duration-300 group"
              >
                {/* stars */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star key={si} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.title}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
