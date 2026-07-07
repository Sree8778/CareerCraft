// ✅ /components/Navbar.tsx
'use client';

import { useContext, useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ModalContext } from '@/contexts/LoginModalContext';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import AppLogo from '@/components/PamtenLogo';
import Link from 'next/link';
import { Bell, CheckCheck, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, writeBatch, doc,
} from 'firebase/firestore';

// ── Notification bell ────────────────────────────────────────────────────

interface Notif {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

function NotificationBell({ userId, role }: { userId: string; role: string }) {
  const [notifs, setNotifs]     = useState<Notif[]>([]);
  const [open, setOpen]         = useState(false);
  const panelRef                = useRef<HTMLDivElement>(null);
  const unread                  = notifs.filter(n => !n.read).length;
  const field                   = role === 'recruiter' ? 'recruiterId' : 'candidateId';

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where(field, '==', userId),
      orderBy('timestamp', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Notif, 'id'>) })));
    }, () => {});
    return () => unsub();
  }, [userId, field]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    const unreadItems = notifs.filter(n => !n.read);
    if (!unreadItems.length) return;
    const batch = writeBatch(db);
    unreadItems.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
    await batch.commit().catch(() => {});
  };

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unread > 0) markAllRead();
  };

  const fmt = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = Date.now();
      const diff = Math.floor((now - d.getTime()) / 1000);
      if (diff < 60)   return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 z-[9999] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/8">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-400 font-semibold"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-white/5">
            {notifs.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 dark:text-zinc-500">
                No notifications yet
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 transition ${
                    !n.read
                      ? 'bg-indigo-50 dark:bg-indigo-500/5 border-l-2 border-indigo-400'
                      : 'hover:bg-gray-50 dark:hover:bg-white/3'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">{n.title}</p>
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1" />}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1 font-mono">{fmt(n.timestamp)}</p>
                </div>
              ))
            )}
          </div>

          {notifs.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-white/8 text-center">
              <Link
                href={role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard'}
                onClick={() => setOpen(false)}
                className="text-[11px] text-indigo-500 hover:text-indigo-400 font-semibold transition"
              >
                View all on dashboard →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Navbar ────────────────────────────────────────────────────────────

export default function Navbar() {
  const { openModal } = useContext(ModalContext);
  const { user, logout, isAuthenticated } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoClick = () => router.push('/');

  const handleLogout = () => {
    logout();
    setShowProfileMenu(false);
    router.push('/');
  };

  const handleProfileClick = () => {
    router.push(user?.role === 'recruiter' ? '/recruiter/profile' : '/candidate/profile');
    setShowProfileMenu(false);
  };

  const handleDashboardClick = () => {
    router.push(user?.role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard');
    setShowProfileMenu(false);
  };

  const isOnDashboard = pathname.includes('/recruiter/') || pathname.includes('/candidate/');

  return (
    <nav className="fixed top-0 left-0 right-0 w-full px-6 py-4 flex justify-between items-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-white/10 z-[9999]">
      <div
        className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white cursor-pointer hover:opacity-80 transition-opacity"
        onClick={handleLogoClick}
      >
        <AppLogo width={80} height={40} className="h-8 w-auto" />
        CareerCraft
      </div>

      <div className="hidden md:flex flex-grow justify-center">
        {isAuthenticated && user?.role === 'candidate' && (
          <Link
            href="/candidate/jobs"
            className="text-gray-700 dark:text-white px-4 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Browse Jobs
          </Link>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <ThemeToggle />

        {/* Notification bell — all authenticated users */}
        {isAuthenticated && user?.id && (
          <NotificationBell userId={user.id} role={user.role ?? 'candidate'} />
        )}

        {isAuthenticated ? (
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  user?.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300">
                {user?.name}
              </span>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-[9999]">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 capitalize">{user?.role}</p>
                </div>

                {!isOnDashboard && (
                  <button
                    onClick={handleDashboardClick}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Dashboard
                  </button>
                )}

                <button
                  onClick={handleProfileClick}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Manage Profile
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link href="/signup">
              <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded text-white hover:opacity-90">
                Try it Free
              </button>
            </Link>
            <button
              onClick={() => openModal('login')}
              className="px-4 py-2 bg-transparent border border-gray-300 dark:border-white rounded text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white hover:text-black dark:hover:text-black transition"
            >
              Login
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
