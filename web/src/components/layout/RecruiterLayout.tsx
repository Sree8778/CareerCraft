// src/components/layout/RecruiterLayout.tsx
'use client';

import Sidebar from './Sidebar';
import React from 'react';

interface RecruiterLayoutProps {
  children: React.ReactNode;
}

export default function RecruiterLayout({ children }: RecruiterLayoutProps) {
  return (
    <div className="cc-workspace flex min-h-screen w-full bg-[#f7f9fc]">
      <Sidebar />
      {/* Main content — clears the fixed 240px sidebar on md+ screens */}
      <div className="flex flex-col flex-1 overflow-auto ml-0 md:ml-60">
        <main className="min-h-full p-4 text-slate-900 md:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
