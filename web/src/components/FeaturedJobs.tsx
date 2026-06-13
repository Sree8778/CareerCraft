'use client';

import { motion } from 'framer-motion';
import { MapPin, DollarSign } from 'lucide-react';

const featuredJobs = [
  {
    id: 1,
    title: 'Senior Full Stack Engineer',
    company: 'Tech Innovations Inc.',
    location: 'San Francisco, CA',
    salary: '$120K - $150K',
    emoji: '👨‍💻',
  },
  {
    id: 2,
    title: 'Marketing Specialist',
    company: 'Global Marketing Solutions',
    location: 'New York, NY',
    salary: '$60K - $80K',
    emoji: '📢',
  },
  {
    id: 3,
    title: 'UI/UX Designer',
    company: 'Creative Designs Studio',
    location: 'Austin, TX',
    salary: '$85K - $110K',
    emoji: '🎨',
  },
  {
    id: 4,
    title: 'Data Analyst',
    company: 'Analytics Pro',
    location: 'Chicago, IL',
    salary: '$70K - $95K',
    emoji: '📊',
  },
];

export default function FeaturedJobs() {
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
          Featured Jobs
        </motion.h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {featuredJobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              whileHover={{ scale: 1.02 }}
              className="glass rounded-2xl p-6 shadow-md hover:shadow-purple-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-4 mb-3 text-white text-xl">
                <span className="text-2xl">{job.emoji}</span>
                <div>
                  <h3 className="text-lg font-semibold">{job.title}</h3>
                  <p className="text-sm text-zinc-300">{job.company}</p>
                </div>
              </div>

              <div className="text-sm text-zinc-300 flex flex-col gap-1">
                <p className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {job.location}
                </p>
                <p className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" /> {job.salary}
                </p>
              </div>

              <button className="mt-4 w-full bg-zinc-100/10 hover:bg-zinc-100/20 text-white text-sm py-2 px-4 rounded transition">
                Apply Now
              </button>
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
            View All Jobs
          </motion.button>
        </div>
      </div>
    </section>
  );
}
