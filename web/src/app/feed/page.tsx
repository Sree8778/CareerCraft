'use client';

// Social feed — LinkedIn-style posts shared by candidates and recruiters.
// Gated by the "feed" feature flag (hidden in UI + enforced by the API).
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CandidateLayout from '@/components/layout/CandidateLayout';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { toast } from 'sonner';
import { API_BASE as API } from '@/lib/api';
import { Heart, MessageCircle, Send, Trash2, RefreshCw, Newspaper, Briefcase, PenSquare } from 'lucide-react';

interface FeedPost {
  id: string;
  authorId: string;
  author: { name: string; role: string; avatar: string };
  content: string;
  jobId?: string | null;
  jobTitle?: string | null;
  likeCount: number;
  likedByMe: boolean;
  comments: { id: string; uid: string; author: { name: string; role: string }; text: string; createdAt: string }[];
  createdAt: string;
}

const timeAgo = (iso: string) => {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
};

const Avatar = ({ name, avatar }: { name: string; avatar?: string }) => (
  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[var(--cc-accent)] to-[var(--cc-accent-2)] flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
    {avatar ? <img src={avatar} alt={name} className="w-10 h-10 object-cover" /> : (name?.charAt(0).toUpperCase() || 'M')}
  </div>
);

function FeedContent() {
  const { user, isAuthenticated, getToken, loading: authLoading } = useAuth();
  const { flags, flagsLoaded, isAdmin } = useFeatureFlags();
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState('');
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const authed = useCallback(async () => ({ Authorization: `Bearer ${await getToken()}` }), [getToken]);

  useEffect(() => {
    if (authLoading || !flagsLoaded) return;
    if (!isAuthenticated) { router.push('/'); return; }
    if (!flags.feed) { toast.error('The feed is currently disabled.'); router.push(user?.role === 'recruiter' ? '/recruiter/dashboard' : '/candidate/dashboard'); }
  }, [authLoading, flagsLoaded, isAuthenticated, flags.feed, router, user?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/feed`, { headers: await authed() });
      const d = await res.json();
      if (res.ok) setPosts(d.posts || []);
    } catch { /* backend down */ }
    finally { setLoading(false); }
  }, [authed]);

  useEffect(() => { if (isAuthenticated && flags.feed) load(); }, [isAuthenticated, flags.feed, load]);

  const publish = async () => {
    const content = composer.trim();
    if (!content) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authed() },
        body: JSON.stringify({ content }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPosts([{ ...d.post, comments: d.post.comments || [] }, ...posts]);
      setComposer('');
      toast.success('Posted!');
    } catch (e: any) { toast.error(e.message || 'Failed to post.'); }
    finally { setPosting(false); }
  };

  const toggleLike = async (id: string) => {
    setPosts(posts.map(p => p.id === id
      ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) } : p));
    try {
      await fetch(`${API}/posts/${id}/like`, { method: 'POST', headers: await authed() });
    } catch { load(); }
  };

  const comment = async (id: string) => {
    const text = (commentDrafts[id] || '').trim();
    if (!text) return;
    setBusy(id);
    try {
      const res = await fetch(`${API}/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await authed() },
        body: JSON.stringify({ text }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPosts(posts.map(p => p.id === id ? { ...p, comments: [...(p.comments || []), d.comment] } : p));
      setCommentDrafts({ ...commentDrafts, [id]: '' });
    } catch (e: any) { toast.error(e.message || 'Failed to comment.'); }
    finally { setBusy(null); }
  };

  const removePost = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch(`${API}/posts/${id}`, { method: 'DELETE', headers: await authed() });
      if (!res.ok) throw new Error();
      setPosts(posts.filter(p => p.id !== id));
      toast.success('Post deleted.');
    } catch { toast.error('Failed to delete.'); }
    finally { setBusy(null); }
  };

  if (authLoading || !flagsLoaded || !isAuthenticated) return null;

  return (
    <div className="max-w-2xl mx-auto text-white space-y-5">
      <div className="flex items-center gap-3">
        <Newspaper className="w-6 h-6 text-[var(--cc-accent)]" />
        <div>
          <h1 className="text-2xl font-bold">Feed</h1>
          <p className="text-xs text-muted">Updates from candidates and recruiters across CareerCraft.</p>
        </div>
      </div>

      {/* Composer */}
      <div className="cc-card p-4 space-y-3">
        <div className="flex gap-3">
          <Avatar name={user?.name || 'M'} avatar={user?.avatar} />
          <textarea value={composer} onChange={e => setComposer(e.target.value)} rows={3} maxLength={2000}
            placeholder={user?.role === 'recruiter' ? 'Share an update, hiring news, or advice…' : 'Share an update, milestone, or question…'}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 text-sm placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--cc-accent)] resize-none" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-600">{composer.length}/2000</span>
          <button onClick={publish} disabled={posting || !composer.trim()}
            className="cc-btn-primary !py-2 !px-4 text-xs disabled:opacity-40">
            {posting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PenSquare className="w-3.5 h-3.5" />} Post
          </button>
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-[var(--cc-accent)]" /></div>
      ) : posts.length === 0 ? (
        <div className="cc-card p-12 text-center text-muted">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">Nothing here yet</p>
          <p className="text-xs mt-1">Be the first to post — your network will see it.</p>
        </div>
      ) : (
        posts.map(p => (
          <div key={p.id} className="cc-card p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Avatar name={p.author?.name} avatar={p.author?.avatar} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate">{p.author?.name || 'Member'}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/10 uppercase tracking-wider text-muted shrink-0">{p.author?.role}</span>
                </div>
                <p className="text-[11px] text-muted">{timeAgo(p.createdAt)}</p>
              </div>
              {(p.authorId === user?.id || isAdmin) && (
                <button onClick={() => removePost(p.id)} disabled={busy === p.id}
                  className="text-zinc-600 hover:text-red-400 transition" title="Delete post">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{p.content}</p>

            {p.jobId && (
              <Link href={`/candidate/jobs/${p.jobId}`}
                className="flex items-center gap-2 p-3 rounded-xl border border-white/10 bg-white/3 hover:border-[var(--cc-accent)]/40 transition text-sm">
                <Briefcase className="w-4 h-4 text-[var(--cc-accent)]" />
                <span className="font-semibold">{p.jobTitle || 'View job posting'}</span>
              </Link>
            )}

            <div className="flex items-center gap-5 pt-1 border-t border-white/5 text-xs text-muted">
              <button onClick={() => toggleLike(p.id)}
                className={`flex items-center gap-1.5 pt-2 transition ${p.likedByMe ? 'text-pink-400' : 'hover:text-white'}`}>
                <Heart className={`w-4 h-4 ${p.likedByMe ? 'fill-pink-400' : ''}`} /> {p.likeCount > 0 ? p.likeCount : ''} Like
              </button>
              <button onClick={() => setOpenComments({ ...openComments, [p.id]: !openComments[p.id] })}
                className="flex items-center gap-1.5 pt-2 hover:text-white transition">
                <MessageCircle className="w-4 h-4" /> {(p.comments || []).length > 0 ? (p.comments || []).length : ''} Comment
              </button>
            </div>

            {openComments[p.id] && (
              <div className="space-y-3 pt-1">
                {(p.comments || []).map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {c.author?.name?.charAt(0).toUpperCase() || 'M'}
                    </div>
                    <div className="flex-1 bg-white/3 border border-white/8 rounded-xl px-3 py-2">
                      <p className="text-xs font-bold">{c.author?.name} <span className="font-normal text-zinc-600 ml-1">{timeAgo(c.createdAt)}</span></p>
                      <p className="text-xs text-zinc-300 mt-0.5">{c.text}</p>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input value={commentDrafts[p.id] || ''} onChange={e => setCommentDrafts({ ...commentDrafts, [p.id]: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && comment(p.id)} maxLength={500}
                    placeholder="Write a comment…"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--cc-accent)]" />
                  <button onClick={() => comment(p.id)} disabled={busy === p.id || !(commentDrafts[p.id] || '').trim()}
                    className="px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40">
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}
      <div className="pb-10" />
    </div>
  );
}

export default function FeedPage() {
  const { user } = useAuth();
  const Layout = user?.role === 'recruiter' ? RecruiterLayout : CandidateLayout;
  return <Layout><FeedContent /></Layout>;
}
