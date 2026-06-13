// src/app/recruiter/webhooks/page.tsx
'use client';

import { useState, useEffect } from 'react';
import RecruiterLayout from '@/components/layout/RecruiterLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Webhook, Plus, Play, Link2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export default function WebhooksPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [pingStatus, setPingStatus] = useState<Record<string, 'idle' | 'pinging' | 'success' | 'failed'>>({});

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'recruiter') {
      router.push('/');
      return;
    }
    fetchSubscriptions();
  }, [isAuthenticated, user, router]);

  const fetchSubscriptions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/webhooks/subscriptions', {
        headers: { 'Authorization': `Bearer mock_token_for_${user.id}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      } else {
        setSubscriptions([]);
      }
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!url) {
      setErrorMsg('Please specify an endpoint URL.');
      return;
    }

    if (!user) {
      setErrorMsg('User authentication context is missing.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/webhooks/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock_token_for_${user.id}`,
        },
        body: JSON.stringify({ url, description }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg('Webhook subscription added successfully.');
        setUrl('');
        setDescription('');
        fetchSubscriptions();
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to subscribe webhook URL.');
      }
    } catch (err) {
      setErrorMsg('Network error. Failed to establish connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePing = async (subUrl: string) => {
    if (!user) return;
    setPingStatus((prev) => ({ ...prev, [subUrl]: 'pinging' }));
    try {
      const res = await fetch('http://127.0.0.1:5000/api/webhooks/test-ping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock_token_for_${user.id}`,
        },
        body: JSON.stringify({ url: subUrl }),
      });

      if (res.ok) {
        setPingStatus((prev) => ({ ...prev, [subUrl]: 'success' }));
        setTimeout(() => {
          setPingStatus((prev) => ({ ...prev, [subUrl]: 'idle' }));
        }, 3000);
      } else {
        setPingStatus((prev) => ({ ...prev, [subUrl]: 'failed' }));
      }
    } catch (err) {
      setPingStatus((prev) => ({ ...prev, [subUrl]: 'failed' }));
    }
  };

  if (!isAuthenticated || user?.role !== 'recruiter') return null;

  return (
    <RecruiterLayout>
      <div className="text-white space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Webhook className="w-8 h-8 text-purple-400" />
              Webhook Integrations
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Synchronize application events and screening assessments with external systems (e.g. ATS databases).
            </p>
          </div>
          <button
            onClick={fetchSubscriptions}
            className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 rounded-lg transition"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Webhook Form */}
          <div className="lg:col-span-1 bg-[#0F1424]/60 border border-white/5 backdrop-blur-xl rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" />
              Add Webhook Subscription
            </h2>

            <form onSubmit={handleSubscribe} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-mono tracking-wider text-zinc-400 uppercase">Payload URL</label>
                <input
                  type="url"
                  placeholder="https://your-ats.com/webhook"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-[#070A13]/90 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm outline-none transition"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono tracking-wider text-zinc-400 uppercase">Description</label>
                <input
                  type="text"
                  placeholder="e.g., Greenhouse Dev Sync"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#070A13]/90 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm outline-none transition"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded-xl">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? 'Subscribing...' : 'Register Endpoint'}
              </button>
            </form>
          </div>

          {/* Webhooks List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-400" />
              Active Webhook Endpoints
            </h2>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 rounded-2xl gap-3 text-zinc-400">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                <span className="text-sm">Loading registered webhooks...</span>
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 space-y-2">
                <Webhook className="w-8 h-8 text-zinc-600" />
                <p className="text-sm">No webhook subscriptions defined yet.</p>
                <p className="text-xs text-zinc-500">Configure a payload endpoint to enable real-time JSON sync.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {subscriptions.map((sub: any) => {
                  const status = pingStatus[sub.url] || 'idle';
                  return (
                    <div
                      key={sub.id || sub.url}
                      className="bg-[#0F1424]/40 border border-white/5 backdrop-blur-xl rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-white/10"
                    >
                      <div className="space-y-2 max-w-md md:max-w-lg">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-mono rounded-md uppercase">
                            POST
                          </span>
                          <span className="text-sm font-semibold truncate block max-w-xs md:max-w-md" title={sub.url}>
                            {sub.url}
                          </span>
                        </div>
                        {sub.description && <p className="text-xs text-zinc-400">{sub.description}</p>}
                        <p className="text-[10px] text-zinc-500 font-mono">
                          Registered: {sub.createdAt ? new Date(sub.createdAt).toLocaleString() : 'N/A'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {status === 'pinging' && (
                          <span className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-3 py-1.5 rounded-xl font-medium">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Pinging
                          </span>
                        )}
                        {status === 'success' && (
                          <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-3 py-1.5 rounded-xl font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Success (2xx)
                          </span>
                        )}
                        {status === 'failed' && (
                          <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-3 py-1.5 rounded-xl font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}
                        {status === 'idle' && (
                          <button
                            onClick={() => handlePing(sub.url)}
                            className="flex items-center gap-1.5 text-xs px-3.5 py-2 border border-white/10 hover:bg-white/5 rounded-xl transition font-medium cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Test Connection
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </RecruiterLayout>
  );
}
