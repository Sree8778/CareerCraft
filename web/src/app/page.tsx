'use client';

import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import FeaturesGrid from '@/components/FeaturesGrid';
import AnimatedBackground from '@/components/AnimatedBackground';
import FloatingBlobs from '@/components/FloatingBlobs';
import BuiltForEveryone from '@/components/BuiltForEveryone';
import dynamic from 'next/dynamic';

const AnimatedLottie = dynamic(() => import('@/components/AnimatedLottie'), { ssr: false });

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* Background layers */}
      <AnimatedBackground />
      <FloatingBlobs />

      {/* Page Content */}
      <main className="relative z-10 space-y-20 px-4 sm:px-8 md:px-16">
        <Hero />
        <FeaturesGrid />
        <BuiltForEveryone />
        <AnimatedLottie />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
