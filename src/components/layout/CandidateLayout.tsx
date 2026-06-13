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
      {/* Sidebar */}
      <CandidateSidebar />

      {/* Main Content Area - ml-60 to clear the 240px fixed sidebar */}
      <div className="flex flex-col flex-1 overflow-auto ml-60">
        <main className="p-6 bg-gradient-to-b from-black to-neutral-900 min-h-full text-white">
          {children}
        </main>
      </div>

    </div>
  );
}
