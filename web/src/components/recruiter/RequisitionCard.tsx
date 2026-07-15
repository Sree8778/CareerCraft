// src/components/recruiter/RequisitionCard.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Users, MapPin, Briefcase, ChevronRight, Pencil, Copy, Rocket, Pause, Play, XCircle } from 'lucide-react';

interface RequisitionCardProps {
  id: string;
  title: string;
  location: string;
  postedDate: string;
  status: string;
  applicants: number;
  department?: string;
  jobType?: string;
  salaryMin?: string;
  salaryMax?: string;
  onStatusChange?: (id: string, status: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  Open:       'bg-green-500/20 text-green-300 border-green-500/30',
  Draft:      'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  Paused:     'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Archived:   'bg-zinc-700/50 text-zinc-400 border-zinc-600',
  Closed:     'bg-red-500/20 text-red-300 border-red-500/30',
  'In Review':'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

const actionBtn = "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition";

export default function RequisitionCard({
  id, title, location, postedDate, status, applicants, department, jobType,
  salaryMin, salaryMax, onStatusChange,
}: RequisitionCardProps) {
  const router = useRouter();
  const s = status || 'Open';

  // Prevent card navigation when clicking an action
  const act = (e: React.MouseEvent, fn: () => void) => { e.preventDefault(); e.stopPropagation(); fn(); };

  const salary = salaryMin || salaryMax
    ? `$${Number(salaryMin || 0).toLocaleString()}${salaryMax ? `–$${Number(salaryMax).toLocaleString()}` : '+'}`
    : null;

  return (
    <Link href={`/recruiter/requisitions/${id}`}>
      <div className="glass p-5 rounded-xl border border-white/10 hover:border-purple-500/40 transition-all duration-200 hover:scale-[1.01] cursor-pointer group space-y-4">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition leading-tight">{title}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold whitespace-nowrap ${STATUS_STYLES[s] || STATUS_STYLES['Open']}`}>
            {s}
          </span>
        </div>

        <div className="space-y-1.5 text-xs text-zinc-400">
          <p className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-zinc-500" />{location}</p>
          {department && <p className="flex items-center gap-1.5"><Briefcase className="w-3 h-3 text-zinc-500" />{department}{jobType ? ` · ${jobType}` : ''}</p>}
          <p className="flex items-center gap-1.5"><CalendarDays className="w-3 h-3 text-zinc-500" />Posted {postedDate}{salary ? ` · ${salary}` : ''}</p>
        </div>

        {/* Lifecycle actions */}
        <div className="flex flex-wrap gap-1.5" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
          <button className={actionBtn} onClick={e => act(e, () => router.push(`/recruiter/requisitions/new?edit=${id}`))}>
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button className={actionBtn} onClick={e => act(e, () => router.push(`/recruiter/requisitions/new?clone=${id}`))}>
            <Copy className="w-3 h-3" /> Clone
          </button>
          {s === 'Draft' && onStatusChange && (
            <button className={`${actionBtn} !text-emerald-400 !border-emerald-500/30`} onClick={e => act(e, () => onStatusChange(id, 'Open'))}>
              <Rocket className="w-3 h-3" /> Publish
            </button>
          )}
          {s === 'Open' && onStatusChange && (
            <button className={actionBtn} onClick={e => act(e, () => onStatusChange(id, 'Paused'))}>
              <Pause className="w-3 h-3" /> Pause
            </button>
          )}
          {(s === 'Paused' || s === 'Closed') && onStatusChange && (
            <button className={`${actionBtn} !text-emerald-400 !border-emerald-500/30`} onClick={e => act(e, () => onStatusChange(id, 'Open'))}>
              <Play className="w-3 h-3" /> Reopen
            </button>
          )}
          {(s === 'Open' || s === 'Paused' || s === 'In Review') && onStatusChange && (
            <button className={`${actionBtn} hover:!text-red-400`} onClick={e => act(e, () => onStatusChange(id, 'Closed'))}>
              <XCircle className="w-3 h-3" /> Close
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold text-white">{applicants}</span> applicants
          </span>
          <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 transition" />
        </div>
      </div>
    </Link>
  );
}
