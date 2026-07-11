'use client';

// Route-group layout: shows a branded skeleton while Firebase auth initializes,
// so full page loads never flash a blank screen. Pages keep their own guards.
import { useAuth } from '@/contexts/AuthContext';

function AuthSkeleton() {
  return (
    <div className="flex min-h-screen w-full animate-pulse" aria-busy="true" aria-label="Loading">
      {/* Sidebar placeholder */}
      <div
        className="hidden md:flex flex-col gap-3 fixed top-16 left-0 h-full w-60 p-6 border-r"
        style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-8 rounded-xl" style={{ background: 'var(--cc-border)' }} />
        ))}
      </div>
      {/* Content placeholder */}
      <div className="flex-1 ml-0 md:ml-60 p-6 space-y-4">
        <div className="h-10 w-1/3 rounded-xl" style={{ background: 'var(--cc-border)' }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl" style={{ background: 'var(--cc-border)' }} />
          ))}
        </div>
        <div className="h-72 rounded-2xl" style={{ background: 'var(--cc-border)' }} />
      </div>
    </div>
  );
}

export default function CandidateGroupLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  if (loading) return <AuthSkeleton />;
  return <>{children}</>;
}
