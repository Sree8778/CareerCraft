// src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, Users, ClipboardList, LogOut, Sparkles, MessageSquare, Search, Building2, Webhook, Network } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import React from 'react';

const navLinks = [
  { name: 'Dashboard', href: '/recruiter/dashboard', icon: <Briefcase size={18} /> },
  { name: 'Requisitions', href: '/recruiter/requisitions', icon: <ClipboardList size={18} /> },
  { name: 'Candidates Pool', href: '/recruiter/candidates', icon: <Users size={18} /> },
  { name: 'AI Sourcing Search', href: '/recruiter/sourcing', icon: <Search size={18} /> },
  { name: 'Company Directory', href: '/companies', icon: <Building2 size={18} /> },
  { name: 'Messages', href: '/recruiter/messages', icon: <MessageSquare size={18} /> },
  { name: 'Webhook Integrations', href: '/recruiter/webhooks', icon: <Webhook size={18} /> },
  { name: 'Ecosystem Network', href: '/recruiter/network', icon: <Network size={18} /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const router = useRouter();

  return (
    <aside className="fixed top-[4rem] left-0 h-[calc(100%-4rem)] w-60 bg-[#0B0F19]/90 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col justify-between transition-colors duration-300 z-40 text-white">
      <div className="space-y-6">
        
        {/* Branding header / status tag */}
        <div className="flex items-center gap-2 px-1 py-1">
          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          <span className="text-[10px] font-bold font-mono tracking-widest text-zinc-400 uppercase">
            Hiring Console
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
                    ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/10 border-l-2 border-purple-400 text-white shadow shadow-purple-500/5' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <span className={isActive ? 'text-purple-400' : 'text-zinc-500'}>
                  {link.icon}
                </span>
                {link.name}
              </Link>
            );
          })}
          
          <Link
            href="/recruiter/applications"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
              pathname === '/recruiter/applications'
                ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/10 border-l-2 border-purple-400 text-white shadow shadow-purple-500/5' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <span role="img" aria-label="Applications" className="text-zinc-500">📋</span>
            Applications Review
          </Link>
        </nav>
      </div>

      {/* User profile details widget at the bottom */}
      <div className="border-t border-white/5 pt-4 space-y-4">
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-xl bg-zinc-950/40 border border-white/5 shadow-inner">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold text-xs">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  user.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-purple-500 rounded-full border border-[#0B0F19] shadow animate-pulse" />
            </div>
            <div className="space-y-0.5 text-xs truncate">
              <span className="font-bold text-zinc-200 block truncate">{user.name}</span>
              <span className="text-[8px] font-mono text-zinc-500 tracking-wider block uppercase">
                {user.role}
              </span>
            </div>
          </div>
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
