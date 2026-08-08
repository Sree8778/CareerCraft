// src/components/layout/CandidateLayout.tsx
'use client';

import React from 'react';
import CandidateSidebar from './CandidateSidebar';

interface CandidateLayoutProps {
  children: React.ReactNode;
}

export default function CandidateLayout({ children }: CandidateLayoutProps) {
  return (
    <div className="cc-workspace flex min-h-screen w-full bg-[#f7f9fc]">
      <CandidateSidebar />
      {/* Main content — clears the fixed 240px sidebar on md+ screens */}
      <div className="flex flex-col flex-1 overflow-auto ml-0 md:ml-60">
        <main className="min-h-full p-4 text-slate-900 md:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
