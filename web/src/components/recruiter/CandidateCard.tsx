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
    <div className="glass p-6 rounded-xl transition duration-300 hover:scale-[1.02] hover:shadow-lg">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {candidate.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{candidate.name}</h3>
            <p className="text-xs text-zinc-400">{candidate.role}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-zinc-400">
        <p><span className="font-medium text-zinc-300">Status:</span> {candidate.status}</p>
        <p><span className="font-medium text-zinc-300">Location:</span> {candidate.location}</p>
        <p><span className="font-medium text-zinc-300">Experience:</span> {candidate.experience}</p>
      </div>

      <div className="flex gap-2 mt-4">
        <Link href={`/profile/${candidate.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-white/15 bg-white/3 hover:bg-white/8 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition">
          <ExternalLink className="w-3 h-3" /> View Profile
        </Link>
        <Link href={`/recruiter/candidates/${candidate.id}`}
          className="flex-1 flex items-center justify-center py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold transition">
          Review
        </Link>
      </div>
    </div>
  );
}
