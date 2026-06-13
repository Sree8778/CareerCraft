'use client';

import { motion } from 'framer-motion';

const featuredEmployers = [
  { id: 1, name: 'Nexus Corp', emoji: '🏢' },
  { id: 2, name: 'Synapse Tech', emoji: '🧠' },
  { id: 3, name: 'Quantum Innovations', emoji: '🔬' },
  { id: 4, name: 'Evergreen Solutions', emoji: '🌿' },
  { id: 5, name: 'Pioneer Works', emoji: '🚀' },
  { id: 6, name: 'Zenith Labs', emoji: '🧪' },
];

export default function FeaturedEmployers() {
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
          {featuredEmployers.map((employer, i) => (
            <motion.div
              key={employer.id}
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
                {employer.emoji}
              </motion.div>
              <p className="text-white text-sm font-medium">{employer.name}</p>
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
