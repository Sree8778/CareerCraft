// src/app/companies/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CandidateLayout from '@/components/layout/CandidateLayout';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { Building2, Search, Star, MapPin, Users, ChevronRight, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

export default function CompanyDirectoryPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [companies, setCompanies] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const loadData = async (query = '') => {
    if (query) setSearching(true);
    else setLoading(true);
    try {
      const url = query ? `${API}/companies?search=${encodeURIComponent(query)}` : `${API}/companies`;
      const compRes = await fetch(url);
      const jobsRes = await fetch(`${API}/jobs`);
      
      if (compRes.ok && jobsRes.ok) {
        const compData = await compRes.json();
        const jobsData = await jobsRes.json();
        
        if (query) {
          setCompanies((prev) => {
            const existingIds = new Set(prev.map(c => c.id));
            const newComps = compData.companies || [];
            const merged = [...prev];
            newComps.forEach((c: any) => {
              if (!existingIds.has(c.id)) {
                merged.push(c);
              }
            });
            return merged;
          });
        } else {
          setCompanies(compData.companies || []);
        }
        setJobs(jobsData.jobs || []);
      }
    } catch (err) {
      console.error('Failed to load companies database:', err);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  // Load companies & jobs
  useEffect(() => {
    loadData();
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      loadData(searchQuery);
    }
  };

  const getJobCount = (companyName: string) => {
    return jobs.filter(
      (j) => j.company?.toLowerCase() === companyName?.toLowerCase()
    ).length;
  };

  const filteredCompanies = companies.filter((c) =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const Layout = user?.role === 'recruiter' ? RecruiterLayout : CandidateLayout;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 text-white pb-10">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
              <Building2 className="w-8 h-8 text-indigo-400" />
              Company Directory
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Research salary standards, check anonymous employee reviews, and browse active jobs.</p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Type name and press Enter to search/discover..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Directory Grid */}
        {loading ? (
          <div className="flex justify-center items-center h-60 text-zinc-400 text-xs gap-2">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Loading company listings...
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-16 border border-white/5 bg-white/5 rounded-3xl text-center space-y-3">
            <Building2 className="w-12 h-12 mx-auto text-zinc-700" />
            <h3 className="font-bold text-zinc-400">No companies found matching "{searchQuery}"</h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-normal">
              Press Enter or click below to query the real-world registry and discover details & employee reviews dynamically.
            </p>
            <button
              onClick={() => loadData(searchQuery)}
              disabled={searching}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              {searching ? 'Querying World Registry...' : 'Discover & Import Company'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCompanies.map((company, index) => {
              const count = getJobCount(company.name);
              return (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white/5 border border-white/10 hover:border-white/20 rounded-3xl p-6 glass transition-all hover:translate-y-[-2px] flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Top row */}
                    <div className="flex items-center gap-4">
                      <img
                        src={company.logoUrl || "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=100&auto=format&fit=crop&q=60"}
                        alt={company.name}
                        className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-md shrink-0"
                      />
                      <div className="truncate">
                        <h2 className="text-lg font-bold text-white truncate">{company.name}</h2>
                        <p className="text-xs text-indigo-400 font-semibold">{company.industry}</p>
                      </div>
                    </div>

                    {/* Bio description */}
                    <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
                      {company.bio}
                    </p>

                    {/* Meta stats pills */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 bg-white/5 border border-white/5 rounded-lg px-2.5 py-1">
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" /> {company.location}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 bg-white/5 border border-white/5 rounded-lg px-2.5 py-1">
                        <Users className="w-3.5 h-3.5 text-zinc-500" /> {company.employeesCount} Employees
                      </span>
                      {count > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 rounded-lg px-2.5 py-1">
                          <Briefcase className="w-3.5 h-3.5" /> {count} Open Roles
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions / details transition */}
                  <div className="border-t border-white/5 mt-6 pt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      <span className="text-xs font-bold text-white">4.8</span>
                      <span className="text-[10px] text-zinc-500 font-mono">(Verified)</span>
                    </div>

                    <Link href={`/companies/${company.id}`} passHref>
                      <button className="flex items-center gap-1 text-[10px] font-bold font-mono tracking-wider text-indigo-400 hover:text-indigo-300 uppercase py-1.5 px-3 rounded-lg border border-indigo-500/10 hover:bg-indigo-500/5 transition cursor-pointer">
                        View Profile <ChevronRight className="w-3 h-3" />
                      </button>
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>
    </Layout>
  );
}
