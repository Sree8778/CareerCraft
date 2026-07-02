'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import FeaturesGrid from '@/components/FeaturesGrid';
import BuiltForEveryone from '@/components/BuiltForEveryone';

export default function Home() {
  const { user, isAuthenticated, loading, needsOnboarding } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) return;
    if (needsOnboarding) {
      router.replace('/onboarding');
    } else {
      router.replace(user.role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard');
    }
  }, [loading, isAuthenticated, user, needsOnboarding, router]);

  if (!loading && isAuthenticated) return null;

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124,58,237,0.15) 0%, transparent 70%), #06040f' }}>
      <main className="relative z-10">
        <Hero />
        <FeaturesGrid />
        <BuiltForEveryone />
      </main>
      <Footer />
    </div>
  );
}
