// src/components/layout/CandidateSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, User, LogOut, Search, FileEdit, Sparkles, MessageSquare, Building2, Network } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import React from 'react';

const navLinks = [
  { name: 'Dashboard', href: '/candidate/dashboard', icon: <Briefcase size={18} /> },
  { name: 'Browse Jobs', href: '/candidate/jobs', icon: <Search size={18} /> },
  { name: 'Company Explorer', href: '/companies', icon: <Building2 size={18} /> },
  { name: 'Resume Builder', href: '/candidate/resume-builder', icon: <FileEdit size={18} /> },
  { name: 'Messages', href: '/candidate/messages', icon: <MessageSquare size={18} /> },
  { name: 'Ecosystem Network', href: '/candidate/network', icon: <Network size={18} /> },
  { name: 'Profile Settings', href: '/candidate/profile', icon: <User size={18} /> },
];

export default function CandidateSidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const router = useRouter();

  return (
    <aside className="fixed top-[4rem] left-0 h-[calc(100%-4rem)] w-60 bg-[#0B0F19]/90 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col justify-between transition-colors duration-300 z-40 text-white">
      <div className="space-y-6">
        
        {/* Branding header / status tag */}
        <div className="flex items-center gap-2 px-1 py-1">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="text-[10px] font-bold font-mono tracking-widest text-zinc-400 uppercase">
            Autopilot Active
          </span>
        </div>

        {/* Navigation list */}
        <nav className="space-y-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/10 border-l-2 border-indigo-400 text-white shadow shadow-indigo-500/5' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <span className={isActive ? 'text-indigo-400' : 'text-zinc-500'}>
                  {link.icon}
                </span>
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User profile details widget at the bottom */}
      <div className="border-t border-white/5 pt-4 space-y-4">
        {user && (
          <Link
            href="/candidate/profile"
            className="flex items-center gap-3 p-2 rounded-xl bg-zinc-950/40 border border-white/5 shadow-inner hover:bg-white/5 hover:border-white/10 transition cursor-pointer"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  user.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-[#0B0F19] shadow" />
            </div>
            <div className="space-y-0.5 text-xs truncate">
              <span className="font-bold text-zinc-200 block truncate">{user.name}</span>
              <span className="text-[8px] font-mono text-zinc-500 tracking-wider block uppercase">
                {user.role}
              </span>
            </div>
          </Link>
        )}

        <button
          className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-white/5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/20 text-zinc-400 hover:text-red-400 rounded-xl text-xs font-bold transition duration-300 cursor-pointer"
          onClick={() => {
            logout();
            router.push('/');
          }}
        >
          <LogOut size={14} /> Logout Session
        </button>
      </div>
    </aside>
  );
}
