// src/components/layout/CandidateLayout.tsx
'use client';

import React from 'react';
import CandidateSidebar from './CandidateSidebar';

interface CandidateLayoutProps {
  children: React.ReactNode;
}

export default function CandidateLayout({ children }: CandidateLayoutProps) {
  return (
    <div className="cc-workspace-shell flex min-h-screen w-full">
      <CandidateSidebar />
      {/* Main content — clears the fixed 240px sidebar on md+ screens */}
      <div className="cc-workspace-main flex flex-1 flex-col overflow-auto ml-0 md:ml-60">
        <main className="cc-workspace-content min-h-full p-4 text-[var(--cc-text)] md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
