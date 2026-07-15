// src/components/layout/RecruiterLayout.tsx
'use client';

import Sidebar from './Sidebar';
import React from 'react';

interface RecruiterLayoutProps {
  children: React.ReactNode;
}

export default function RecruiterLayout({ children }: RecruiterLayoutProps) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      {/* Main content — clears the fixed 240px sidebar on md+ screens */}
      <div className="flex flex-col flex-1 overflow-auto ml-0 md:ml-60">
        <main className="p-4 md:p-6 min-h-full text-[var(--cc-text)]">
          {children}
        </main>
      </div>
    </div>
  );
}
