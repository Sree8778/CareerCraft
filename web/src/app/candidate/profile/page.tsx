'use client';

export const dynamic = 'force-dynamic';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import CandidateLayout from '@/components/layout/CandidateLayout';
import Link from 'next/link';
import {
  MapPin, Mail, Phone, Briefcase, GraduationCap, FolderOpen,
  Award, ExternalLink, Building2, Pencil, Globe, Calendar,
  CheckCircle, Link2, Eye, Users, Plus, MoreHorizontal,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { API_BASE } from '@/lib/api';

interface ResumeData {
  personal?: { name?: string; email?: string; phone?: string; location?: string; headline?: string };
  summary?: string;
  experience?: { id: string; jobTitle?: string; company?: string; location?: string; dates?: string; description?: string }[];
  education?: { id: string; degree?: string; institution?: string; graduationYear?: string; gpa?: string; achievements?: string }[];
  skills?: { id: string; category?: string; skills_list?: string }[];
  projects?: { id: string; title?: string; description?: string; technologies?: string; link?: string; dates?: string }[];
  certifications?: { id: string; name?: string; issuer?: string; date?: string; link?: string }[];
  preferences?: { jobType?: string; locationPref?: string; salaryMin?: string; salaryMax?: string; workAuth?: string; availability?: string };
}

/* ─── Card ──────────────────────────────────────────── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`cc-card overflow-hidden rounded-2xl border ${className}`}>
      {children}
    </div>
  );
}

/* ─── Section card with LinkedIn-style header + "Show all" ── */
function Section({ title, addHref, showAll, showAllCount, children }: {
  title: string; addHref?: string; showAll?: string;
  showAllCount?: number; children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h2 className="text-xl font-semibold text-[var(--cc-text)]">{title}</h2>
        <div className="flex items-center gap-1">
          {addHref && (
            <Link href={addHref} className="rounded-full p-1.5 text-[var(--cc-text-muted)] transition hover:bg-[var(--cc-accent)]/10 hover:text-[var(--cc-accent)]">
              <Plus className="w-5 h-5" />
            </Link>
          )}
          <Link href="/candidate/settings" className="rounded-full p-1.5 text-[var(--cc-text-muted)] transition hover:bg-[var(--cc-accent)]/10 hover:text-[var(--cc-accent)]">
            <Pencil className="w-4 h-4" />
          </Link>
        </div>
      </div>
      <div className="px-6 pb-2">
        {children}
      </div>
      {showAll && showAllCount && (
        <Link href={addHref || '/candidate/settings'}
          className="flex w-full items-center justify-center gap-1.5 border-t border-[var(--cc-border)] py-4 text-sm font-semibold text-[var(--cc-text-muted)] transition hover:bg-[var(--cc-accent)]/5 hover:text-[var(--cc-accent)]">
          Show all {showAllCount} {showAll}
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      )}
    </Card>
  );
}

/* ─── Divider between items in a section ──────────────── */
function Divider() {
  return <div className="my-4 border-t border-[var(--cc-border)]" />;
}

/* ─── Experience / Education item ─────────────────────── */
function EntryItem({ logoIcon, title, sub, sub2, meta, body, link, children }: {
  logoIcon?: React.ReactNode; title: string; sub?: string; sub2?: string;
  meta?: string; body?: string; link?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      {/* Company logo square – LinkedIn style */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--cc-border)] bg-[var(--cc-bg)] text-[var(--cc-text-muted)]">
        {logoIcon ?? <Building2 className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-semibold leading-snug text-[var(--cc-text)]">{title}</p>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="mt-0.5 shrink-0 text-[var(--cc-text-muted)] transition hover:text-[var(--cc-accent)]">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        {sub && <p className="mt-0.5 text-sm text-[var(--cc-text-muted)]">{sub}</p>}
        {sub2 && <p className="text-sm text-[var(--cc-text-muted)]">{sub2}</p>}
        {meta && <p className="mt-0.5 text-sm text-[var(--cc-text-muted)]">{meta}</p>}
        {body && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--cc-text-muted)]">{body}</p>}
        {children}
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────── */
export default function CandidateProfilePage() {
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionCount, setConnectionCount] = useState<number | null>(null);

  // Real accepted-connections count via the backend API (Admin SDK), so it
  // works without depending on deployed client-side Firestore rules.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/connections`, {
          headers: { 'Authorization': `Bearer ${await getToken()}` },
        });
        const data = await res.json();
        if (res.ok) {
          setConnectionCount((data.connections || []).filter((c: any) => c.status === 'accepted').length);
        }
      } catch { setConnectionCount(null); }
    })();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/'); return; }
  }, [isAuthenticated, router, authLoading]);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const [uSnap, rSnap] = await Promise.all([
          getDoc(doc(db, 'users', user.id)),
          getDoc(doc(db, 'resumes', user.id)),
        ]);
        let rd: ResumeData = {};
        if (rSnap.exists()) rd = rSnap.data().resumeData ?? {};
        if (uSnap.exists()) {
          const ud = uSnap.data();
          rd = {
            ...rd,
            personal: {
              name: ud.fullName || rd.personal?.name,
              email: ud.email || rd.personal?.email,
              phone: ud.phone || rd.personal?.phone,
              location: rd.personal?.location,
              headline: rd.personal?.headline,
            },
          };
        }
        setResumeData(rd);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [user?.id]);

  if (!isAuthenticated) return null;

  const name = resumeData?.personal?.name || user?.name || 'Your Name';
  const headline = resumeData?.personal?.headline || 'Add a headline';
  const location = resumeData?.personal?.location || '';
  const email = resumeData?.personal?.email || user?.email || '';
  const phone = resumeData?.personal?.phone || '';
  const summary = resumeData?.summary || '';
  const experience = resumeData?.experience ?? [];
  const education = resumeData?.education ?? [];
  const allSkills: string[] = (resumeData?.skills ?? [])
    .flatMap(s => (s.skills_list || '').split(',').map(x => x.trim()).filter(Boolean));
  const projects = resumeData?.projects ?? [];
  const certs = resumeData?.certifications ?? [];
  const prefs = resumeData?.preferences;

  return (
    <CandidateLayout>
      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-[var(--cc-text-muted)] animate-pulse">Loading profile…</div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">

          {/* ── Left: main content ── */}
          <div className="min-w-0 space-y-6">

            {/* ── TOP CARD: cover + avatar + identity ── */}
            <Card>
              {/* Cover photo */}
              <div className="relative h-40 overflow-hidden bg-gradient-to-br from-[#192b69] via-[#3865c9] to-[#8b5cf6] sm:h-48">
                {/* subtle pattern overlay */}
                <div className="absolute inset-0 opacity-30"
                  style={{ backgroundImage: 'radial-gradient(circle at 20% 60%, #2563eb 0%, transparent 50%), radial-gradient(circle at 80% 40%, #7c3aed 0%, transparent 50%)' }} />
                {/* Edit cover */}
                <Link href="/candidate/settings"
                  className="absolute bottom-3 right-4 flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full border border-white/20 transition backdrop-blur-sm">
                  <Pencil className="w-3 h-3" /> Edit cover
                </Link>
              </div>

              {/* Identity section */}
              <div className="px-5 pb-6 sm:px-7">
                {/* Avatar row */}
                <div className="mb-5 flex flex-col gap-4 -mt-14 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="relative">
                    {/* Open to work green ring */}
                    {prefs?.availability === 'Immediately' && (
                      <div className="absolute inset-0 rounded-full border-[5px] border-emerald-500 -m-1.5 z-10" />
                    )}
                    <div className="relative z-0 flex h-28 w-28 items-center justify-center rounded-full border-[5px] border-[var(--cc-surface-solid)] bg-gradient-to-br from-[#2563eb] to-[#7c3aed] text-4xl font-black text-white shadow-2xl sm:h-32 sm:w-32 sm:text-5xl">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    {/* Open to work label */}
                    {prefs?.availability === 'Immediately' && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border border-emerald-500 z-20">
                        #OPENTOWORK
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mb-1 flex flex-wrap items-center gap-2 sm:justify-end">
                    <Link href="/candidate/resume-builder"
                      className="rounded-full bg-gradient-to-r from-[var(--cc-accent)] to-[var(--cc-accent-2)] px-5 py-1.5 text-sm font-bold text-white shadow-sm transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-accent)]">
                      Resume builder
                    </Link>
                    <Link href="/candidate/settings"
                      className="rounded-full border border-[var(--cc-border)] px-5 py-1.5 text-sm font-bold text-[var(--cc-text-muted)] transition hover:border-[var(--cc-accent)] hover:bg-[var(--cc-accent)]/10 hover:text-[var(--cc-accent)]">
                      Add section
                    </Link>
                    <button aria-label="More profile actions" className="rounded-full border border-[var(--cc-border)] p-2 text-[var(--cc-text-muted)] transition hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Name, headline, meta */}
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-bold leading-tight text-[var(--cc-text)]">{name}</h1>
                  <p className="text-base text-[var(--cc-text-muted)]">{headline}</p>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-sm text-[var(--cc-text-muted)]">
                    {location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{location}
                      </span>
                    )}
                    {email && (
                      <span className="flex items-center gap-1">
                        · <Mail className="w-3.5 h-3.5 ml-1" />{email}
                      </span>
                    )}
                    {phone && (
                      <span className="flex items-center gap-1">
                        · <Phone className="w-3.5 h-3.5 ml-1" />{phone}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <Link href="/candidate/network" className="text-sm font-semibold text-[var(--cc-accent)] hover:underline">
                      {connectionCount === null ? '' : `${connectionCount} connection${connectionCount === 1 ? '' : 's'}`}
                    </Link>
                    <Link href="/candidate/network" className="text-sm text-[var(--cc-text-muted)] hover:text-[var(--cc-accent)]">
                      · Contact info
                    </Link>
                  </div>

                  {/* Edit profile link */}
                  <div className="pt-2">
                    <Link href="/candidate/settings"
                      className="text-sm font-semibold text-[var(--cc-accent)] hover:underline">
                      Edit profile
                    </Link>
                  </div>
                </div>
              </div>
            </Card>

            {/* ── Open to Work banner ── */}
            {prefs?.jobType && (
              <Card className="border-l-4 border-l-emerald-500">
                <div className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <Briefcase className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-[var(--cc-text)]">Open to work</p>
                      <p className="text-sm text-[var(--cc-text-muted)]">
                        {[prefs.jobType, prefs.locationPref, prefs.availability && `Available ${prefs.availability}`]
                          .filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <Link href="/candidate/settings" className="text-[var(--cc-text-muted)] transition hover:text-[var(--cc-accent)]">
                    <Pencil className="w-4 h-4" />
                  </Link>
                </div>
              </Card>
            )}

            {/* ── About ── */}
            {summary && (
              <Card>
                <div className="flex items-center justify-between px-6 pt-6 pb-3">
                  <h2 className="text-xl font-semibold text-[var(--cc-text)]">About</h2>
                  <Link href="/candidate/settings" className="rounded-full p-1.5 text-[var(--cc-text-muted)] transition hover:bg-[var(--cc-accent)]/10 hover:text-[var(--cc-accent)]">
                    <Pencil className="w-4 h-4" />
                  </Link>
                </div>
                <div className="px-6 pb-6">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--cc-text-muted)]">{summary}</p>
                </div>
              </Card>
            )}

            {/* ── Experience ── */}
            {experience.length > 0 && (
              <Section title="Experience" addHref="/candidate/settings"
                showAll="experiences" showAllCount={experience.length > 3 ? experience.length : undefined}>
                {experience.map((exp, i) => (
                  <div key={exp.id || i}>
                    {i > 0 && <Divider />}
                    <EntryItem
                      logoIcon={<Building2 className="w-5 h-5" />}
                      title={exp.jobTitle || 'Role'}
                      sub={exp.company}
                      meta={[exp.dates, exp.location].filter(Boolean).join(' · ')}
                      body={exp.description}
                    />
                  </div>
                ))}
              </Section>
            )}

            {/* ── Education ── */}
            {education.length > 0 && (
              <Section title="Education" addHref="/candidate/settings"
                showAll="educations" showAllCount={education.length > 3 ? education.length : undefined}>
                {education.map((edu, i) => (
                  <div key={edu.id || i}>
                    {i > 0 && <Divider />}
                    <EntryItem
                      logoIcon={<GraduationCap className="w-5 h-5" />}
                      title={edu.institution || 'Institution'}
                      sub={edu.degree}
                      meta={[
                        edu.graduationYear ? `Graduated ${edu.graduationYear}` : '',
                        edu.gpa ? `GPA: ${edu.gpa}` : '',
                      ].filter(Boolean).join(' · ')}
                      body={edu.achievements}
                    />
                  </div>
                ))}
              </Section>
            )}

            {/* ── Skills ── */}
            {allSkills.length > 0 && (
              <Section title="Skills" addHref="/candidate/settings"
                showAll="skills" showAllCount={allSkills.length > 5 ? allSkills.length : undefined}>
                {allSkills.slice(0, 5).map((skill, i) => (
                  <div key={i}>
                    {i > 0 && <Divider />}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold text-[var(--cc-text)]">{skill}</p>
                      </div>
                      <span className="rounded-full border border-[var(--cc-border)] bg-[var(--cc-bg)] px-2.5 py-1 text-xs text-[var(--cc-text-muted)]">
                        Skill
                      </span>
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {/* ── Projects ── */}
            {projects.length > 0 && (
              <Section title="Projects" addHref="/candidate/settings"
                showAll="projects" showAllCount={projects.length > 3 ? projects.length : undefined}>
                {projects.map((proj, i) => (
                  <div key={proj.id || i}>
                    {i > 0 && <Divider />}
                    <EntryItem
                      logoIcon={<FolderOpen className="w-5 h-5" />}
                      title={proj.title || 'Project'}
                      meta={proj.dates}
                      body={proj.description}
                      link={proj.link}
                    >
                      {proj.technologies && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {proj.technologies.split(',').map(t => t.trim()).filter(Boolean).map((tech, j) => (
                            <span key={j} className="rounded border border-[var(--cc-border)] bg-[var(--cc-bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--cc-accent)]">
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </EntryItem>
                  </div>
                ))}
              </Section>
            )}

            {/* ── Certifications ── */}
            {certs.length > 0 && (
              <Section title="Licenses & certifications" addHref="/candidate/settings"
                showAll="certifications" showAllCount={certs.length > 3 ? certs.length : undefined}>
                {certs.map((cert, i) => (
                  <div key={cert.id || i}>
                    {i > 0 && <Divider />}
                    <EntryItem
                      logoIcon={<Award className="w-5 h-5 text-amber-400" />}
                      title={cert.name || 'Certification'}
                      sub={cert.issuer}
                      meta={cert.date}
                      link={cert.link}
                    />
                  </div>
                ))}
              </Section>
            )}

            {/* Empty state */}
            {!summary && !experience.length && !education.length && !allSkills.length && (
              <Card>
                <div className="p-8 text-center space-y-4">
                  <p className="text-sm text-[var(--cc-text-muted)]">Your profile is empty — add details to stand out to recruiters.</p>
                  <div className="flex gap-3 justify-center">
                    <Link href="/candidate/resume-builder"
                      className="rounded-full bg-gradient-to-r from-[var(--cc-accent)] to-[var(--cc-accent-2)] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110">
                      Build from resume
                    </Link>
                    <Link href="/candidate/settings"
                      className="rounded-full border border-[var(--cc-border)] px-5 py-2 text-sm font-semibold text-[var(--cc-text-muted)] transition hover:border-[var(--cc-accent)] hover:text-[var(--cc-accent)]">
                      Edit settings
                    </Link>
                  </div>
                </div>
              </Card>
            )}

          </div>

          {/* ── Right sidebar ── */}
          <aside className="w-full space-y-6 xl:w-80">

            {/* Profile analytics */}
            <Card>
              <div className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-[var(--cc-text)]">Analytics</h3>
                  <span className="text-[11px] text-[var(--cc-text-muted)]">Private to you</span>
                </div>
                <div className="space-y-3 mt-3">
                  <Link href="/candidate/network" className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[var(--cc-accent)]/5">
                    <Eye className="h-5 w-5 text-[var(--cc-text-muted)] group-hover:text-[var(--cc-accent)]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--cc-text)] transition group-hover:text-[var(--cc-accent)]">Profile views</p>
                      <p className="text-xs text-[var(--cc-text-muted)]">Discover who's viewed your profile</p>
                    </div>
                  </Link>
                  <Link href="/candidate/jobs" className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[var(--cc-accent)]/5">
                    <Users className="h-5 w-5 text-[var(--cc-text-muted)] group-hover:text-[var(--cc-accent)]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--cc-text)] transition group-hover:text-[var(--cc-accent)]">Search appearances</p>
                      <p className="text-xs text-[var(--cc-text-muted)]">See how often you appear in searches</p>
                    </div>
                  </Link>
                </div>
              </div>
            </Card>

            {/* Public profile URL */}
            <Card>
              <div className="p-5 space-y-3">
                <h3 className="text-base font-semibold text-[var(--cc-text)]">Public profile & URL</h3>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-bg)] px-3 py-2">
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" />
                  <span className="truncate font-mono text-xs text-[var(--cc-text-muted)]">/profile/{user?.id?.slice(0, 14)}…</span>
                </div>
                <Link href={`/profile/${user?.id}`}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full border border-[var(--cc-border)] py-2 text-sm font-semibold text-[var(--cc-text-muted)] transition hover:border-[var(--cc-accent)] hover:bg-[var(--cc-accent)]/10 hover:text-[var(--cc-accent)]">
                  <Eye className="w-3.5 h-3.5" /> View public profile
                </Link>
              </div>
            </Card>

            {/* Job preferences */}
            {prefs && Object.values(prefs).some(Boolean) && (
              <Card>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-[var(--cc-text)]">Job preferences</h3>
                    <Link href="/candidate/settings" className="text-[var(--cc-text-muted)] transition hover:text-[var(--cc-accent)]">
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="space-y-2.5">
                    {prefs.jobType && (
                      <div className="flex items-center gap-2.5 text-sm text-[var(--cc-text-muted)]">
                        <Briefcase className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" /> {prefs.jobType}
                      </div>
                    )}
                    {prefs.locationPref && (
                      <div className="flex items-center gap-2.5 text-sm text-[var(--cc-text-muted)]">
                        <Globe className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" /> {prefs.locationPref}
                      </div>
                    )}
                    {prefs.workAuth && (
                      <div className="flex items-center gap-2.5 text-sm text-[var(--cc-text-muted)]">
                        <CheckCircle className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" /> {prefs.workAuth}
                      </div>
                    )}
                    {prefs.availability && (
                      <div className="flex items-center gap-2.5 text-sm text-[var(--cc-text-muted)]">
                        <Calendar className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" /> {prefs.availability}
                      </div>
                    )}
                    {prefs.salaryMin && (
                      <div className="flex items-center gap-2.5 text-sm text-[var(--cc-text-muted)]">
                        <span className="shrink-0 text-base text-[var(--cc-accent)]">$</span>
                        {prefs.salaryMin}{prefs.salaryMax ? ` – $${prefs.salaryMax}` : '+'} / yr
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

          </aside>
        </div>
      )}
    </CandidateLayout>
  );
}
