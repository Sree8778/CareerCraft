'use client';

import { motion } from 'framer-motion';

// 🧑‍💼 Replace images with relatable emojis
const features = [
  {
    quote:
      'RecruitEdge revolutionized our hiring process. We found top-tier talent faster than ever before!',
    name: 'Sarah J.',
    title: 'HR Director at InnovateCorp',
    emoji: '💼',
  },
  {
    quote:
      'Finding my dream job was effortless with their intuitive search and personalized recommendations. Highly recommend!',
    name: 'David L.',
    title: 'Senior Software Engineer',
    emoji: '👨‍💻',
  },
  {
    quote:
      'The benefits section is spot on! Every feature highlighted truly makes a difference in our daily operations.',
    name: 'Emily R.',
    title: 'Recruitment Manager',
    emoji: '📈',
  },
];

export default function FeaturesGrid() {
  return (
    <section className="py-20 md:py-28 bg-transparent">
      <div className="max-w-6xl mx-auto px-6 text-center space-y-12">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-5xl font-extrabold text-white"
        >
          What Our Users Say
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              whileHover={{ scale: 1.05 }}
              className="glass p-6 md:p-8 rounded-2xl text-left shadow-md hover:shadow-purple-500/30 transition-all duration-300"
            >
              <p className="italic text-white mb-6">&quot;{feature.quote}&quot;</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center text-2xl rounded-full bg-white/20 border border-white/30">
                  {feature.emoji}
                </div>
                <div>
                  <p className="font-semibold text-white">{feature.name}</p>
                  <p className="text-sm text-white/70">{feature.title}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
