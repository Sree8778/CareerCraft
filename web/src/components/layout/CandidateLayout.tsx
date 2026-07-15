// src/components/layout/CandidateLayout.tsx
'use client';

import React from 'react';
import CandidateSidebar from './CandidateSidebar';

interface CandidateLayoutProps {
  children: React.ReactNode;
}

export default function CandidateLayout({ children }: CandidateLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      <CandidateSidebar />
      {/* Main content — clears the fixed 240px sidebar on md+ screens */}
      <div className="flex flex-col flex-1 overflow-auto ml-0 md:ml-60">
        <main className="p-4 md:p-6 min-h-full text-[var(--cc-text)]">
          {children}
        </main>
      </div>
    </div>
  );
}
