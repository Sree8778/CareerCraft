// src/components/recruiter/CandidateCard.tsx
'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface CandidateCardProps {
  candidate: {
    id: string;
    name: string;
    role: string;
    status: string;
    location: string;
    experience: string;
  };
}

export default function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <div className="cc-candidate-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {candidate.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--cc-text)]">{candidate.name}</h3>
            <p className="text-xs text-[var(--cc-text-muted)]">{candidate.role || 'Role not specified'}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-[var(--cc-text-muted)]">
        <p><span className="mb-0.5 block font-semibold text-[var(--cc-text)]">Status</span>{candidate.status}</p>
        <p><span className="mb-0.5 block font-semibold text-[var(--cc-text)]">Location</span>{candidate.location}</p>
        <p><span className="mb-0.5 block font-semibold text-[var(--cc-text)]">Experience</span>{candidate.experience || '—'}</p>
      </div>

      <div className="mt-5 flex gap-2">
        <Link href={`/profile/${candidate.id}`}
          className="cc-btn-ghost flex-1 !px-2 !py-2 text-xs">
          <ExternalLink className="w-3 h-3" /> View Profile
        </Link>
        <Link href={`/recruiter/candidates/${candidate.id}`}
          className="cc-btn-primary flex-1 !px-2 !py-2 text-xs">
          Review
        </Link>
      </div>
    </div>
  );
}
