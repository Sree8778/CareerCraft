'use client';

import { useContext, useState, useEffect } from 'react';
import { ModalContext } from '@/contexts/LoginModalContext';
import { motion } from 'framer-motion';
import { Bot, ArrowRight, TrendingUp, Zap, CheckCircle } from 'lucide-react';

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
    <section className="relative min-h-screen overflow-hidden flex items-center justify-center">

      {/* ── ambient glows ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-violet-600/20 rounded-full blur-[160px]" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-700/10 rounded-full blur-[100px]" />
      </div>

      {/* ── dot grid ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.035) 1px,transparent 1px)', backgroundSize: '28px 28px' }}
      />

      {/* ══════════ BACKGROUND WALLPAPER TEXT ══════════ */}
      <div className="pointer-events-none select-none absolute inset-0 flex flex-col items-center justify-center overflow-hidden">

        {/* decorative dot — sits above the "C" of "Craft" */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15, type: 'spring' }}
          className="absolute"
          style={{ top: 'calc(50% - 14vw)', right: '17%' }}
        >
          <div
            className="rounded-full bg-gradient-to-br from-violet-500 to-pink-500"
            style={{ width: 'clamp(18px, 3.5vw, 52px)', height: 'clamp(18px, 3.5vw, 52px)' }}
          />
        </motion.div>

        {/* main word */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="whitespace-nowrap leading-none tracking-tighter font-black"
          style={{ fontSize: 'clamp(52px, 13.5vw, 220px)' }}
        >
          <span className="text-white/[0.08]">Career</span>
          <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">Craft</span>
        </motion.div>

        {/* sub line */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="whitespace-nowrap leading-none tracking-tighter font-black mt-[-0.5vw]"
          style={{ fontSize: 'clamp(24px, 5.5vw, 90px)' }}
        >
          <span className="text-white/[0.12]">Land Your </span>
          <span className="text-white/[0.35]">Dream Job</span>
        </motion.div>
      </div>

      {/* ══════════ FLOATING CARD (foreground) ══════════ */}
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[360px] mx-auto px-4"
      >
        {/* card label row */}
        <div className="flex items-center gap-2.5 mb-3 ml-0.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.5)]">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Smart Apply</span>
        </div>

        {/* main floating card */}
        <div className="rounded-3xl overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/[0.07]">

          {/* ── visual header ── */}
          <div className="relative h-52 flex items-center justify-center overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #0d0520 0%, #130826 50%, #1a0a35 100%)' }}
          >
            {/* glow behind card */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-56 h-20 bg-violet-600/50 rounded-full blur-3xl" />
            <div className="absolute top-4 right-8 w-24 h-24 bg-pink-600/20 rounded-full blur-2xl" />

            {/* floating application card visual */}
            <motion.div
              animate={{ y: [0, -10, 0], rotateX: [2, 5, 2], rotateY: [-3, 3, -3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformStyle: 'preserve-3d', perspective: '600px' }}
              className="relative z-10"
            >
              <div
                className="w-56 h-36 rounded-2xl border border-white/10 p-4 flex flex-col justify-between"
                style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.9) 0%, rgba(168,85,247,0.7) 40%, rgba(236,72,153,0.6) 80%, rgba(6,182,212,0.4) 100%)',
                  boxShadow: '0 20px 60px rgba(124,58,237,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/50 text-[9px] uppercase tracking-[0.15em] font-semibold">CareerCraft</p>
                    <p className="text-white font-bold text-sm mt-0.5">Autonomous Apply</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/15 border border-white/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white/40 text-[9px] uppercase tracking-widest font-medium">Applied Today</p>
                    <p className="text-4xl font-black text-white leading-none">47</p>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-300 text-[11px] font-semibold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +12 this week
                  </div>
                </div>
              </div>
            </motion.div>

            {/* card shadow on floor */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-44 h-4 bg-violet-900/70 rounded-full blur-xl" />

            {/* live badge */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-semibold">Live</span>
            </div>
          </div>

          {/* ── card body ── */}
          <div className="bg-zinc-950/90 backdrop-blur-2xl p-5">

            {/* mini job list */}
            <div className="space-y-2 mb-4">
              {liveJobs.map((j, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: tick === i ? 1 : 0.35 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-2.5 text-[11px]"
                >
                  <div className="w-5 h-5 rounded-md bg-white/[0.06] border border-white/[0.08] flex items-center justify-center font-bold text-[9px] text-zinc-400 flex-shrink-0">
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

            {/* CTA */}
            <button
              onClick={() => openModal('signup')}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 group shadow-[0_0_30px_rgba(124,58,237,0.4)] hover:shadow-[0_0_50px_rgba(124,58,237,0.6)] transition-all duration-300"
            >
              Get Started Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
            </button>
            <p className="text-center text-zinc-700 text-[10px] mt-2.5 tracking-wide">No credit card required</p>
          </div>
        </div>
      </motion.div>

      {/* ── bottom fade into next section ── */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#06040f] to-transparent" />
    </section>
  );
}
