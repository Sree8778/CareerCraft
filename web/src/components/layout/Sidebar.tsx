// src/components/layout/Sidebar.tsx (recruiter)
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Briefcase, Users, ClipboardList, LogOut, Sparkles, MessageSquare, Building2, Network, ClipboardCheck, Settings, Globe, Menu, X, Newspaper, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import React, { useState, useEffect } from 'react';

// Primary navigation = hiring work only, grouped by task.
// Profile/Settings live in the bottom widget; Webhook Integrations moved
// into Settings where configuration belongs.
const navGroups: { label: string | null; links: { name: string; href: string; icon: React.ReactNode; flag?: string }[] }[] = [
  {
    label: null,
    links: [
      { name: 'Dashboard', href: '/recruiter/dashboard', icon: <Briefcase size={18} /> },
    ],
  },
  {
    label: 'Hiring',
    links: [
      { name: 'Requisitions',    href: '/recruiter/requisitions', icon: <ClipboardList size={18} /> },
      { name: 'Applications',    href: '/recruiter/applications', icon: <ClipboardCheck size={18} /> },
      { name: 'Candidates',      href: '/recruiter/candidates',   icon: <Users size={18} /> },
      { name: 'Passive Sourcing',href: '/recruiter/sourcing',     icon: <Globe size={18} />, flag: 'sourcing' },
    ],
  },
  {
    label: 'Connect',
    links: [
      { name: 'Feed',      href: '/feed',               icon: <Newspaper size={18} />, flag: 'feed' },
      { name: 'Messages',  href: '/recruiter/messages', icon: <MessageSquare size={18} />, flag: 'messages' },
      { name: 'Network',   href: '/recruiter/network',  icon: <Network size={18} />, flag: 'network' },
      { name: 'Companies', href: '/companies',          icon: <Building2 size={18} />, flag: 'companies' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { flags, isAdmin } = useFeatureFlags();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on navigation
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle navigation"
        className="md:hidden fixed bottom-5 left-5 z-50 p-3 rounded-full cc-btn-primary shadow-lg"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed top-[4rem] left-0 h-[calc(100%-4rem)] w-60 backdrop-blur-xl border-r p-5 flex flex-col justify-between transition-transform duration-300 z-40 text-[var(--cc-text)] ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ background: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}
      >
        <div className="space-y-5 overflow-y-auto pb-2">
          {/* Status tag */}
          <div className="flex items-center gap-2 px-1 py-1">
            <Sparkles className="w-4 h-4 text-[var(--cc-accent-2)] animate-pulse" />
            <span className="text-[10px] font-bold font-mono tracking-widest text-muted uppercase">
              Hiring Console
            </span>
          </div>

          {/* Grouped navigation */}
          <nav className="space-y-4">
            {navGroups.map((group, gi) => (
              <div key={gi} className="space-y-1">
                {group.label && (
                  <p className="px-3 pt-1 text-[9px] font-bold font-mono tracking-[0.18em] uppercase text-muted/80">
                    {group.label}
                  </p>
                )}
                {group.links.filter(l => !l.flag || (flags as any)[l.flag] !== false).map(link => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-[var(--cc-accent-2)]/20 to-[var(--cc-accent)]/10 border-l-2 border-[var(--cc-accent-2)] text-[var(--cc-text)] shadow'
                          : 'text-muted hover:text-[var(--cc-text)] hover:bg-white/5'
                      }`}
                    >
                      <span className={isActive ? 'text-[var(--cc-accent-2)]' : 'text-muted'}>
                        {link.icon}
                      </span>
                      {link.name}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Identity & configuration — profile widget + settings gear + logout */}
        <div className="border-t pt-3 space-y-2" style={{ borderColor: 'var(--cc-border)' }}>
          {isAdmin && (
            <Link href="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition ${
                pathname === '/admin' ? 'text-[var(--cc-accent-2)]' : 'text-muted hover:text-[var(--cc-text)] hover:bg-white/5'
              }`}>
              <ShieldCheck size={16} /> Super Admin
            </Link>
          )}
          {user && (
            <div className="flex items-center gap-1.5">
              <Link
                href="/recruiter/profile"
                title="View my profile"
                className={`flex flex-1 min-w-0 items-center gap-3 p-2 rounded-xl border transition cursor-pointer hover:bg-white/5 ${
                  pathname === '/recruiter/profile' ? 'border-[var(--cc-accent-2)]/50' : ''
                }`}
                style={{ borderColor: pathname === '/recruiter/profile' ? undefined : 'var(--cc-border)', background: 'var(--cc-surface)' }}
              >
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[var(--cc-accent-2)] to-[var(--cc-accent)] flex items-center justify-center text-white font-bold text-xs">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      user.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border shadow" style={{ borderColor: 'var(--cc-bg)' }} />
                </div>
                <div className="space-y-0.5 text-xs min-w-0 flex-1 overflow-hidden">
                  <span className="font-bold block truncate">{user.name}</span>
                  <span className="text-[8px] font-mono text-muted tracking-wider block uppercase">View profile</span>
                </div>
              </Link>
              <Link
                href="/recruiter/settings"
                title="Settings"
                className={`p-2.5 shrink-0 rounded-xl border transition hover:bg-white/5 ${
                  pathname === '/recruiter/settings' ? 'text-[var(--cc-accent-2)] border-[var(--cc-accent-2)]/50' : 'text-muted hover:text-[var(--cc-text)]'
                }`}
                style={{ borderColor: pathname === '/recruiter/settings' ? undefined : 'var(--cc-border)' }}
              >
                <Settings size={16} />
              </Link>
            </div>
          )}

          <button
            className="w-full flex items-center justify-center gap-2 py-2 px-3 border hover:bg-red-500/10 hover:border-red-500/20 text-muted hover:text-red-400 rounded-xl text-xs font-bold transition duration-300 cursor-pointer"
            style={{ borderColor: 'var(--cc-border)' }}
            onClick={() => { logout(); router.push('/'); }}
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      </aside>
    </>
  );
}
