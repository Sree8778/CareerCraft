'use client';

import { useContext, useState, useEffect } from 'react';
import { ModalContext } from '@/contexts/LoginModalContext';
import { motion } from 'framer-motion';
import { Bot, ArrowRight, TrendingUp, Zap, CheckCircle, Sparkles } from 'lucide-react';

const liveJobs = [
  { role: 'Senior Frontend Engineer', co: 'Stripe',  match: 98 },
  { role: 'Full Stack Developer',     co: 'Vercel',  match: 95 },
  { role: 'React Engineer',           co: 'Linear',  match: 92 },
];

export default function Hero() {
  const { openModal } = useContext(ModalContext);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => (n + 1) % liveJobs.length), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden flex flex-col">

      {/* ── ambient glows ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-700/25 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-[-100px] w-[500px] h-[500px] bg-pink-700/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-[-100px] w-[400px] h-[400px] bg-blue-800/15 rounded-full blur-[100px]" />
      </div>

      {/* ── dot grid ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.03) 1px,transparent 1px)', backgroundSize: '28px 28px' }}
      />

      {/* ══════════ TOP — WALLPAPER TEXT ══════════ */}
      <div className="pointer-events-none select-none relative overflow-hidden pt-16 pb-0 flex justify-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="whitespace-nowrap leading-[0.88] tracking-[-0.04em] font-black relative"
          style={{ fontSize: 'clamp(72px, 16vw, 240px)' }}
        >
          {/* decorative dot above the "C" of Craft */}
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3, type: 'spring' }}
            className="absolute rounded-full bg-gradient-to-br from-violet-400 to-pink-500"
            style={{
              width:  'clamp(14px, 2.8vw, 42px)',
              height: 'clamp(14px, 2.8vw, 42px)',
              top:    'clamp(-20px, -3vw, -48px)',
              right:  '0px',
            }}
          />
          <span className="text-white/[0.16]">Career</span>
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Craft</span>
        </motion.div>
      </div>

      {/* ══════════ CENTER — TAGLINE + CARD ══════════ */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10">

        {/* readable tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Job Search
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1] max-w-2xl mx-auto">
            Apply to{' '}
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">100+ jobs</span>
            <br />while you sleep
          </h1>
          <p className="mt-4 text-zinc-400 text-base max-w-md mx-auto leading-relaxed">
            CareerCraft's AI agent scrapes top job boards, matches your profile, and submits applications 24/7 — fully autonomous.
          </p>
        </motion.div>

        {/* ── floating product card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[380px]"
        >
          {/* card label */}
          <div className="flex items-center gap-2.5 mb-3 pl-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-[0_0_18px_rgba(124,58,237,0.6)]">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-tight">Smart Apply</span>
          </div>

          {/* main card */}
          <div
            className="rounded-3xl overflow-hidden border border-white/[0.09]"
            style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)' }}
          >
            {/* visual header */}
            <div
              className="relative h-48 flex items-center justify-center overflow-hidden"
              style={{ background: 'linear-gradient(160deg, #0c0420 0%, #150930 50%, #1c0c40 100%)' }}
            >
              <div className="absolute inset-0 flex items-end justify-center pb-3">
                <div className="w-52 h-16 bg-violet-600/60 rounded-full blur-3xl" />
              </div>
              <div className="absolute top-3 right-12 w-20 h-20 bg-pink-600/20 rounded-full blur-2xl" />

              {/* 3D floating card */}
              <motion.div
                animate={{ y: [0, -9, 0], rotateX: [1, 4, 1], rotateY: [-4, 4, -4] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ transformStyle: 'preserve-3d', perspective: '700px' }}
                className="relative z-10"
              >
                <div
                  className="w-52 h-32 rounded-2xl p-4 flex flex-col justify-between border border-white/10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(109,40,217,0.95) 0%, rgba(168,85,247,0.75) 40%, rgba(236,72,153,0.65) 80%, rgba(6,182,212,0.35) 100%)',
                    boxShadow: '0 16px 50px rgba(109,40,217,0.55), 0 0 0 1px rgba(255,255,255,0.07)',
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white/50 text-[9px] uppercase tracking-[0.15em] font-semibold">CareerCraft</p>
                      <p className="text-white font-bold text-sm">Autonomous Apply</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-white/40 text-[9px] uppercase tracking-widest font-medium">Applied Today</p>
                      <p className="text-4xl font-black text-white leading-none">47</p>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-300 text-[11px] font-semibold">
                      <TrendingUp className="w-3 h-3" />
                      +12 this week
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* floor shadow */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-40 h-3 bg-violet-900/80 rounded-full blur-xl" />

              {/* live badge */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-semibold">Live</span>
              </div>
            </div>

            {/* card body */}
            <div className="bg-zinc-950 p-5">
              <div className="space-y-2 mb-4">
                {liveJobs.map((j, i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: tick === i ? 1 : 0.3 }}
                    transition={{ duration: 0.35 }}
                    className="flex items-center gap-2.5 text-[11px]"
                  >
                    <div className="w-5 h-5 rounded-md bg-white/[0.07] border border-white/[0.09] flex items-center justify-center font-bold text-[9px] text-zinc-400 flex-shrink-0">
                      {j.co[0]}
                    </div>
                    <span className="text-zinc-300 flex-1 truncate font-medium">{j.role}</span>
                    {tick === i
                      ? <span className="text-amber-400 font-semibold flex-shrink-0">Applying…</span>
                      : i < tick
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      : <span className="text-zinc-600 flex-shrink-0">Queued</span>
                    }
                  </motion.div>
                ))}
              </div>

              <button
                onClick={() => openModal('signup')}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 group shadow-[0_0_28px_rgba(124,58,237,0.4)] hover:shadow-[0_0_48px_rgba(124,58,237,0.65)] transition-all duration-300"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </button>
              <p className="text-center text-zinc-700 text-[10px] mt-2.5 tracking-wide">No credit card required</p>
            </div>
          </div>
        </motion.div>

        {/* stats row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex items-center gap-8 mt-8 text-center"
        >
          {[
            { val: '50K+', label: 'Candidates' },
            { val: '10K+', label: 'Jobs Daily' },
            { val: '85%',  label: 'Hired in 30 days' },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="text-white font-black text-lg leading-none">{s.val}</span>
              <span className="text-zinc-600 text-[10px] mt-1 font-medium">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* bottom fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#06040f] to-transparent" />
    </section>
  );
}
