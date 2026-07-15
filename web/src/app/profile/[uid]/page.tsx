'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CandidateLayout from '@/components/layout/CandidateLayout';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { toast } from 'sonner';
import {
  MapPin, Mail, Phone, Briefcase, GraduationCap, FolderOpen,
  Award, ExternalLink, Building2, UserPlus, MessageSquare,
  CheckCircle, ChevronLeft, RefreshCw, MoreHorizontal, Link2,
  Pencil, Globe, Calendar, Eye, Plus,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { API_BASE as API } from '@/lib/api';

interface ProfileUser {
  uid: string; fullName?: string; name?: string; email?: string;
  phone?: string; role?: string; avatar?: string; headline?: string;
}
interface ResumeData {
  personal?: { name?: string; email?: string; phone?: string; location?: string; headline?: string };
  summary?: string;
  experience?: { id: string; jobTitle?: string; company?: string; location?: string; dates?: string; description?: string }[];
  education?: { id: string; degree?: string; institution?: string; graduationYear?: string; gpa?: string; achievements?: string }[];
  skills?: { id: string; category?: string; skills_list?: string }[];
  projects?: { id: string; title?: string; description?: string; technologies?: string; link?: string; dates?: string }[];
  certifications?: { id: string; name?: string; issuer?: string; date?: string; link?: string }[];
  preferences?: { jobType?: string; locationPref?: string; workAuth?: string; availability?: string };
}

/* ─── Card ──────────────────────────────────────── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1C2333] border border-[#2A3347] rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

/* ─── Section card ──────────────────────────────── */
function Section({ title, showAll, showAllCount, children }: {
  title: string; showAll?: string; showAllCount?: number; children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="px-6 pb-2">{children}</div>
      {showAll && showAllCount && (
        <div className="border-t border-[#2A3347] px-6 py-4 text-sm font-semibold text-[#94A3B8] hover:text-white hover:bg-white/3 transition cursor-default flex items-center justify-center gap-1.5">
          Show all {showAllCount} {showAll} <ExternalLink className="w-3.5 h-3.5" />
        </div>
      )}
    </Card>
  );
}

function Divider() {
  return <div className="border-t border-[#2A3347] my-4" />;
}

/* ─── Entry item (experience / education / etc) ── */
function EntryItem({ logoIcon, title, sub, meta, body, link, children }: {
  logoIcon?: React.ReactNode; title: string; sub?: string;
  meta?: string; body?: string; link?: string; children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="w-12 h-12 rounded-md bg-[#252D3D] border border-[#2A3347] flex items-center justify-center shrink-0 text-[#566075]">
        {logoIcon ?? <Building2 className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-semibold text-white leading-snug">{title}</p>
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer"
              className="text-[#566075] hover:text-[#94A3B8] shrink-0 mt-0.5">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        {sub && <p className="text-sm text-[#94A3B8] mt-0.5">{sub}</p>}
        {meta && <p className="text-sm text-[#566075] mt-0.5">{meta}</p>}
        {body && <p className="text-sm text-[#94A3B8] mt-3 leading-relaxed whitespace-pre-line">{body}</p>}
        {children}
      </div>
    </div>
  );
}

/* ─── Profile body ──────────────────────────────── */
function ProfileBody({ profileUser, resumeData, isOwn, viewerUid }: {
  profileUser: ProfileUser; resumeData: ResumeData | null;
  isOwn: boolean; viewerUid: string;
}) {
  const { getToken } = useAuth();
  const [connStatus, setConnStatus] = useState<'none' | 'pending' | 'accepted'>('none');
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    if (isOwn || !profileUser.uid) return;
    (async () => {
      try {
        const r = await fetch(`${API}/connections`, {
          headers: { Authorization: `Bearer ${await getToken()}` },
        });
        if (!r.ok) return;
        const d = await r.json();
        const c = (d.connections || []).find((x: any) =>
          (x.senderId === viewerUid && x.receiverId === profileUser.uid) ||
          (x.senderId === profileUser.uid && x.receiverId === viewerUid));
        if (c) setConnStatus(c.status);
      } catch {}
    })();
  }, [profileUser.uid, isOwn, viewerUid]);

  const connect = async () => {
    setActioning(true);
    try {
      const r = await fetch(`${API}/connections/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ receiverId: profileUser.uid }),
      });
      if (r.ok) { setConnStatus('pending'); toast.success('Invitation sent!'); }
      else { const d = await r.json(); toast.error(d.error || 'Failed.'); }
    } catch { toast.error('Network error.'); }
    finally { setActioning(false); }
  };

  const name = profileUser.fullName || profileUser.name || 'Unknown';
  const personal = resumeData?.personal ?? {};
  const location = personal.location || '';
  const headline = personal.headline || profileUser.headline || (profileUser.role === 'recruiter' ? 'Recruiter' : 'Professional');
  const email = (connStatus === 'accepted' || isOwn) ? (personal.email || profileUser.email || '') : '';
  const phone = (connStatus === 'accepted' || isOwn) ? (personal.phone || profileUser.phone || '') : '';
  const summary = resumeData?.summary || '';
  const experience = resumeData?.experience ?? [];
  const education = resumeData?.education ?? [];
  const allSkills: string[] = (resumeData?.skills ?? [])
    .flatMap(s => (s.skills_list || '').split(',').map(x => x.trim()).filter(Boolean));
  const projects = resumeData?.projects ?? [];
  const certs = resumeData?.certifications ?? [];
  const prefs = resumeData?.preferences;

  return (
    <div className="flex gap-5 items-start">

      {/* ── Main column ── */}
      <div className="flex-1 min-w-0 space-y-2.5">

        {/* Top card: cover + avatar + identity */}
        <Card>
          {/* Cover */}
          <div className="relative h-52 bg-gradient-to-br from-[#0d1b3e] via-[#1a3a6e] to-[#0d2044] overflow-hidden">
            <div className="absolute inset-0 opacity-30"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 60%, #2563eb 0%, transparent 50%), radial-gradient(circle at 80% 40%, #7c3aed 0%, transparent 50%)' }} />
          </div>

          <div className="px-6 pb-6">
            {/* Avatar + buttons row */}
            <div className="flex items-end justify-between -mt-16 mb-4">
              <div className="relative">
                {prefs?.availability === 'Immediately' && (
                  <div className="absolute inset-0 rounded-full border-[5px] border-emerald-500 -m-1.5 z-10" />
                )}
                <div className="w-36 h-36 rounded-full border-[5px] border-[#1C2333] bg-gradient-to-br from-[#2563eb] to-[#7c3aed] flex items-center justify-center text-white text-5xl font-black shadow-2xl relative z-0">
                  {profileUser.avatar
                    ? <img src={profileUser.avatar} alt={name} className="w-full h-full rounded-full object-cover" />
                    : name.charAt(0).toUpperCase()}
                </div>
                {prefs?.availability === 'Immediately' && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap border border-emerald-500 z-20">
                    #OPENTOWORK
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mb-1 flex-wrap justify-end">
                {!isOwn && (
                  <>
                    {connStatus === 'none' && (
                      <button onClick={connect} disabled={actioning}
                        className="flex items-center gap-1.5 bg-[#0A66C2] hover:bg-[#0a5ab2] disabled:opacity-50 text-white text-sm font-bold px-5 py-1.5 rounded-full transition">
                        {actioning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                        Connect
                      </button>
                    )}
                    {connStatus === 'pending' && (
                      <span className="flex items-center gap-1.5 border border-[#566075] text-[#94A3B8] text-sm font-bold px-5 py-1.5 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5 text-[#0A66C2]" /> Pending
                      </span>
                    )}
                    {connStatus === 'accepted' && (
                      <span className="flex items-center gap-1.5 border border-emerald-500/40 text-emerald-400 text-sm font-bold px-5 py-1.5 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" /> Connected
                      </span>
                    )}
                    <Link href="/candidate/messages"
                      className="flex items-center gap-1.5 border border-[#566075] hover:border-[#94A3B8] text-[#94A3B8] hover:text-white text-sm font-bold px-5 py-1.5 rounded-full transition">
                      <MessageSquare className="w-3.5 h-3.5" /> Message
                    </Link>
                    <button className="border border-[#566075] hover:border-[#94A3B8] text-[#94A3B8] hover:text-white p-2 rounded-full transition">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </>
                )}
                {isOwn && (
                  <Link href="/candidate/settings"
                    className="border border-[#566075] hover:border-[#94A3B8] text-[#94A3B8] hover:text-white text-sm font-bold px-5 py-1.5 rounded-full transition flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Edit profile
                  </Link>
                )}
              </div>
            </div>

            {/* Identity */}
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <p className="text-base text-[#CBD5E1]">{headline}</p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#566075] pt-0.5">
                {location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{location}</span>}
                {email && <span className="flex items-center gap-1">· <Mail className="w-3.5 h-3.5 ml-1" />{email}</span>}
                {phone && <span className="flex items-center gap-1">· <Phone className="w-3.5 h-3.5 ml-1" />{phone}</span>}
              </div>

              {!isOwn && connStatus !== 'accepted' && (personal.email || personal.phone || profileUser.email || profileUser.phone) && (
                <p className="text-sm text-[#566075] flex items-center gap-1.5 pt-0.5">
                  Connect to see contact info
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                  profileUser.role === 'recruiter'
                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                    : 'bg-[#0A66C2]/15 border-[#0A66C2]/30 text-[#0A66C2]'
                }`}>{profileUser.role}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Open to work */}
        {prefs?.jobType && (
          <Card className="border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Open to work</p>
                <p className="text-sm text-[#94A3B8]">
                  {[prefs.jobType, prefs.locationPref, prefs.availability && `Available ${prefs.availability}`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* About */}
        {summary && (
          <Card>
            <div className="px-6 pt-6 pb-3">
              <h2 className="text-xl font-semibold text-white">About</h2>
            </div>
            <div className="px-6 pb-6">
              <p className="text-sm text-[#94A3B8] leading-relaxed whitespace-pre-line">{summary}</p>
            </div>
          </Card>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <Section title="Experience" showAll="experiences" showAllCount={experience.length > 3 ? experience.length : undefined}>
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

        {/* Education */}
        {education.length > 0 && (
          <Section title="Education" showAll="educations" showAllCount={education.length > 3 ? education.length : undefined}>
            {education.map((edu, i) => (
              <div key={edu.id || i}>
                {i > 0 && <Divider />}
                <EntryItem
                  logoIcon={<GraduationCap className="w-5 h-5" />}
                  title={edu.institution || 'Institution'}
                  sub={edu.degree}
                  meta={[edu.graduationYear ? `Graduated ${edu.graduationYear}` : '', edu.gpa ? `GPA: ${edu.gpa}` : ''].filter(Boolean).join(' · ')}
                  body={edu.achievements}
                />
              </div>
            ))}
          </Section>
        )}

        {/* Skills */}
        {allSkills.length > 0 && (
          <Section title="Skills" showAll="skills" showAllCount={allSkills.length > 5 ? allSkills.length : undefined}>
            {allSkills.slice(0, 5).map((skill, i) => (
              <div key={i}>
                {i > 0 && <Divider />}
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold text-white">{skill}</p>
                  <span className="text-xs text-[#566075] bg-[#252D3D] border border-[#2A3347] px-2.5 py-1 rounded-full">Skill</span>
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <Section title="Projects" showAll="projects" showAllCount={projects.length > 3 ? projects.length : undefined}>
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
                        <span key={j} className="text-[11px] font-mono bg-[#252D3D] text-[#7B8EC8] px-2 py-0.5 rounded border border-[#2A3347]">{tech}</span>
                      ))}
                    </div>
                  )}
                </EntryItem>
              </div>
            ))}
          </Section>
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <Section title="Licenses & certifications" showAll="certifications" showAllCount={certs.length > 3 ? certs.length : undefined}>
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

      </div>

      {/* ── Right sidebar ── */}
      <aside className="w-80 shrink-0 space-y-2.5">

        {/* Profile URL */}
        <Card>
          <div className="p-5 space-y-3">
            <h3 className="text-base font-semibold text-white">Public profile & URL</h3>
            <div className="flex items-center gap-2 bg-[#151D2E] border border-[#2A3347] rounded-lg px-3 py-2">
              <Link2 className="w-3.5 h-3.5 text-[#566075] shrink-0" />
              <span className="text-xs text-[#566075] font-mono truncate">/profile/{profileUser.uid?.slice(0, 14)}…</span>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Copied!'); }}
              className="flex items-center justify-center gap-1.5 w-full py-2 border border-[#566075] hover:border-[#94A3B8] text-[#94A3B8] hover:text-white text-sm font-semibold rounded-full transition">
              <Link2 className="w-3.5 h-3.5" /> Copy profile link
            </button>
          </div>
        </Card>

        {/* Job preferences — only when connected or own */}
        {(isOwn || connStatus === 'accepted') && prefs && Object.values(prefs).some(Boolean) && (
          <Card>
            <div className="p-5">
              <h3 className="text-base font-semibold text-white mb-3">Job preferences</h3>
              <div className="space-y-2.5">
                {prefs.jobType && <div className="flex items-center gap-2.5 text-sm text-[#94A3B8]"><Briefcase className="w-4 h-4 text-[#566075] shrink-0" />{prefs.jobType}</div>}
                {prefs.locationPref && <div className="flex items-center gap-2.5 text-sm text-[#94A3B8]"><Globe className="w-4 h-4 text-[#566075] shrink-0" />{prefs.locationPref}</div>}
                {prefs.workAuth && <div className="flex items-center gap-2.5 text-sm text-[#94A3B8]"><CheckCircle className="w-4 h-4 text-[#566075] shrink-0" />{prefs.workAuth}</div>}
                {prefs.availability && <div className="flex items-center gap-2.5 text-sm text-[#94A3B8]"><Calendar className="w-4 h-4 text-[#566075] shrink-0" />{prefs.availability}</div>}
              </div>
            </div>
          </Card>
        )}

        {/* Connect CTA when not connected */}
        {!isOwn && connStatus !== 'accepted' && (
          <Card>
            <div className="p-5 text-center space-y-3">
              <p className="text-sm text-[#566075] leading-relaxed">
                Connect with {name.split(' ')[0]} to see their contact info and job preferences.
              </p>
              <button onClick={connect} disabled={actioning || connStatus !== 'none'}
                className="w-full flex items-center justify-center gap-1.5 bg-[#0A66C2] hover:bg-[#0a5ab2] disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-full transition">
                {connStatus === 'pending'
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Pending</>
                  : <><UserPlus className="w-3.5 h-3.5" /> Connect</>}
              </button>
            </div>
          </Card>
        )}

      </aside>
    </div>
  );
}

/* ─── Page shell ─────────────────────────────────── */
export default function PublicProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!uid || authLoading || !isAuthenticated) return;
    (async () => {
      try {
        const [uSnap, rSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid)),
          getDoc(doc(db, 'resumes', uid)),
        ]);
        if (uSnap.exists()) {
          const d = uSnap.data();
          setProfileUser({ uid, fullName: d.fullName || d.name, email: d.email, phone: d.phone, role: d.role, avatar: d.avatar, headline: d.headline });
        }
        if (rSnap.exists()) setResumeData(rSnap.data().resumeData ?? null);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [uid, authLoading, isAuthenticated]);

  if (authLoading || !isAuthenticated) return null;

  const isOwn = user?.id === uid;
  const isRecruiter = user?.role === 'recruiter';
  const backHref = isRecruiter ? '/recruiter/candidates' : '/candidate/network';

  const content = (
    <>
      <div className="mb-4">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-[#566075] hover:text-[#94A3B8] transition">
          <ChevronLeft className="w-4 h-4" />
          {isRecruiter ? 'Back to Candidates' : 'Back to Network'}
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#566075]">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading profile…
        </div>
      ) : !profileUser ? (
        <div className="text-center py-24 text-[#566075]">User not found.</div>
      ) : (
        <ProfileBody
          profileUser={profileUser}
          resumeData={resumeData}
          isOwn={isOwn}
          viewerUid={user?.id || ''}
        />
      )}
    </>
  );

  return isRecruiter
    ? <RecruiterLayout>{content}</RecruiterLayout>
    : <CandidateLayout>{content}</CandidateLayout>;
}
