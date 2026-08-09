// src/components/layout/RecruiterLayout.tsx
'use client';

import Sidebar from './Sidebar';
import React from 'react';

interface RecruiterLayoutProps {
  children: React.ReactNode;
}

export default function RecruiterLayout({ children }: RecruiterLayoutProps) {
  return (
    <div className="cc-workspace-shell flex min-h-screen w-full">
      <Sidebar />
      {/* Main content — clears the fixed 240px sidebar on md+ screens */}
      <div className="cc-workspace-main flex flex-1 flex-col overflow-auto ml-0 md:ml-60">
        <main className="cc-workspace-content min-h-full p-4 text-[var(--cc-text)] md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
