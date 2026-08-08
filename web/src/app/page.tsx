'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';
import LandingPage from '@/components/LandingPage';

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
    <div className="min-h-screen overflow-x-hidden bg-white">
      <main>
        <LandingPage />
      </main>
      <Footer />
    </div>
  );
}
