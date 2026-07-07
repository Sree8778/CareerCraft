'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const INDUSTRY_EMOJI: Record<string, string> = {
  tech: '🏢', software: '💻', ai: '🤖', cloud: '☁️',
  design: '🎨', creative: '✨', health: '🏥', finance: '💰',
  education: '📚', media: '📡',
};

function industryEmoji(industry = '') {
  const t = industry.toLowerCase();
  for (const [k, v] of Object.entries(INDUSTRY_EMOJI)) {
    if (t.includes(k)) return v;
  }
  return '🏢';
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

export default function FeaturedEmployers() {
  const [employers, setEmployers] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API}/companies`)
      .then(r => r.json())
      .then(d => setEmployers((d.companies || []).slice(0, 6)))
      .catch(() => {});
  }, []);

  if (employers.length === 0) return null;

  return (
    <section className="py-20 px-4 bg-transparent">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-5xl font-bold text-center mb-12 text-white"
        >
          Featured Employers
        </motion.h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-6">
          {employers.map((employer, i) => (
            <motion.div
              key={employer.id || employer.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              whileHover={{ scale: 1.05 }}
              className="glass flex flex-col items-center justify-center p-6 rounded-2xl shadow-md hover:shadow-purple-500/30 transition-all duration-300 text-center"
            >
              <motion.div
                whileHover={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6 }}
                className="text-3xl mb-3"
              >
                {employer.emoji || industryEmoji(employer.industry)}
              </motion.div>
              <p className="text-white text-sm font-medium">{employer.name}</p>
              {employer.industry && (
                <p className="text-zinc-400 text-xs mt-1">{employer.industry}</p>
              )}
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center mt-10">
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="px-6 py-2 border border-white/20 rounded-lg text-sm text-white hover:bg-white/10 backdrop-blur"
          >
            View All Employers
          </motion.button>
        </div>
      </div>
    </section>
  );
}
