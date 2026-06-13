'use client';

import { useContext } from 'react';
import { ModalContext } from '@/contexts/LoginModalContext';
import { motion } from 'framer-motion';
import {
  RocketIcon,
  UsersIcon,
  ShieldIcon,
  ActivitySquareIcon,
} from 'lucide-react';

import PamtenMotiveAnimation from './PamtenMotiveAnimation';

const benefits = [
  {
    title: 'Top Talent Pool',
    desc: 'Access a curated database of highly qualified candidates or job openings.',
    icon: UsersIcon,
  },
  {
    title: 'Seamless Matching',
    desc: 'Smart algorithms connect the right talent with the right roles.',
    icon: ActivitySquareIcon,
  },
  {
    title: 'Secure & Private',
    desc: 'Your data is protected with industry-leading security.',
    icon: ShieldIcon,
  },
  {
    title: 'Accelerated Hiring',
    desc: 'Streamline recruitment or job search with efficient tools.',
    icon: RocketIcon,
  },
];

export default function Hero() {
  const { openModal } = useContext(ModalContext);

  return (
    <section className="relative z-10 w-full pt-32 pb-10 text-gray-900 dark:text-white">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Heading and Details */}
        <div className="lg:col-span-7 text-left">
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Driven to Transform <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-cyan-500">Your Career</span>
          </motion.h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mt-6 max-w-xl leading-relaxed">
            Connecting top talent with leading employers globally. Built on the core motive of service first and dedicated to making a positive difference in technology.
          </p>
          <div className="mt-8 flex gap-4">
            <button
              onClick={() => openModal()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-all shadow-lg shadow-purple-500/20"
            >
              Get Started Now
            </button>
          </div>
        </div>

        {/* Right Column: Interactive 3D Motive Animation */}
        <div className="lg:col-span-5 w-full">
          <PamtenMotiveAnimation />
        </div>
      </div>

      <div className="mt-24 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 px-6 max-w-6xl mx-auto">
        {benefits.map((item, idx) => (
          <motion.div
            key={idx}
            className="bg-white/5 dark:bg-zinc-900/40 backdrop-blur-md p-6 rounded-xl border border-gray-200 dark:border-zinc-800 text-center"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.3 }}
          >
            <item.icon className="mx-auto h-8 w-8 text-purple-400 mb-4" />
            <h3 className="text-gray-900 dark:text-white font-semibold text-lg">{item.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
