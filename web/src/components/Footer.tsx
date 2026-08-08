'use client';

import AppLogo from './PamtenLogo';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-8 text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 font-bold text-slate-900"><AppLogo width={60} height={30} className="h-6 w-auto" />CareerCraft</div>
        <p className="text-xs">© {new Date().getFullYear()} CareerCraft. Built for what is next.</p>
        <div className="flex gap-5 text-xs font-medium"><a href="#" className="hover:text-slate-900">Privacy</a><a href="#" className="hover:text-slate-900">Terms</a><a href="#" className="hover:text-slate-900">Contact</a></div>
      </div>
    </footer>
  );
}
