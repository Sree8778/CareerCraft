// src/app/candidate/network/page.tsx
'use client';

import { useState, useEffect } from 'react';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Network, Search, UserPlus, CheckCircle, RefreshCw, Mail, Phone, Users, Shield, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';

export default function CandidateNetworkPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  // Tab State
  const [activeTab, setActiveTab] = useState<'directory' | 'pending' | 'connections'>('directory');

  // Data States
  const [usersList, setUsersList] = useState<any[]>([]);
  const [connectionsList, setConnectionsList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  // Loading & Submitting States
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'candidate') {
      router.push('/');
      return;
    }
    fetchData();
  }, [isAuthenticated, user, router]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch users
      const usersRes = await fetch(`${API}/users?search=${searchQuery}&role=${roleFilter}`, {
        headers: { 'Authorization': `Bearer mock_token_for_${user.id}` }
      });
      const usersData = await usersRes.json();
      const allUsers = usersData.users || [];

      // Fetch connections
      const connRes = await fetch(`${API}/connections`, {
        headers: { 'Authorization': `Bearer mock_token_for_${user.id}` }
      });
      const connData = await connRes.json();
      const allConnections = connData.connections || [];

      setUsersList(allUsers);
      setConnectionsList(allConnections);
    } catch (err) {
      console.error('Failed to load network data:', err);
      toast.error('Failed to load directory data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (targetUid: string) => {
    if (!user) return;
    setActioningId(targetUid);
    try {
      const res = await fetch(`${API}/connections/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock_token_for_${user.id}`
        },
        body: JSON.stringify({ receiverId: targetUid })
      });

      const result = await res.json();
      if (res.ok) {
        toast.success('Connection invitation sent successfully!');
        fetchData();
      } else {
        toast.error(result.error || 'Failed to send request.');
      }
    } catch (err) {
      toast.error('Network error. Failed to dispatch invitation.');
    } finally {
      setActioningId(null);
    }
  };

  const handleRespond = async (connectionId: string, status: 'accepted' | 'declined') => {
    if (!user) return;
    setActioningId(connectionId);
    try {
      const res = await fetch(`${API}/connections/${connectionId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock_token_for_${user.id}`
        },
        body: JSON.stringify({ status })
      });

      const result = await res.json();
      if (res.ok) {
        toast.success(status === 'accepted' ? 'Request accepted!' : 'Request declined.');
        fetchData();
      } else {
        toast.error(result.error || 'Failed to respond.');
      }
    } catch (err) {
      toast.error('Network error. Response failed.');
    } finally {
      setActioningId(null);
    }
  };

  // Helper to determine connection state between user and target
  const getConnectionState = (targetUid: string) => {
    const conn = connectionsList.find(c => 
      (c.senderId === user?.id && c.receiverId === targetUid) || 
      (c.senderId === targetUid && c.receiverId === user?.id)
    );
    if (!conn) return { status: 'none', id: null };
    return { status: conn.status, id: conn.id, isSender: conn.senderId === user?.id };
  };

  if (!isAuthenticated || user?.role !== 'candidate') return null;

  // Filtered directories & counts
  const pendingReceived = connectionsList.filter(c => c.receiverId === user?.id && c.status === 'pending');
  const activeConnections = connectionsList.filter(c => c.status === 'accepted');

  return (
    <CandidateLayout>
      <div className="text-white space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Network className="w-8 h-8 text-indigo-400" />
              Ecosystem Network
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Search and discover registered professionals in the system, connect, and collaborate via direct chats.
            </p>
          </div>
          <button
            onClick={fetchData}
            className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-300 rounded-lg transition"
            title="Refresh directory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 bg-[#0F1424]/60 border border-white/5 backdrop-blur-xl p-4 rounded-2xl">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
              className="w-full bg-[#070A13]/90 border border-white/10 focus:border-indigo-500 rounded-xl pl-10 pr-4 py-2 text-sm outline-none transition"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#070A13]/90 border border-white/10 focus:border-indigo-500 rounded-xl px-4 py-2 text-sm outline-none transition text-zinc-300"
            >
              <option value="">All Roles</option>
              <option value="candidate">Candidates</option>
              <option value="recruiter">Recruiters</option>
            </select>
            <button
              onClick={fetchData}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition"
            >
              Search
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/10 gap-6 text-sm font-bold">
          <button
            onClick={() => setActiveTab('directory')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'directory' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Search Directory ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 border-b-2 transition flex items-center gap-2 ${
              activeTab === 'pending' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Pending Invites 
            {pendingReceived.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full">
                {pendingReceived.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('connections')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'connections' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            My Connections ({activeConnections.length})
          </button>
        </div>

        {/* Tab Contents */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 rounded-2xl gap-3 text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-sm">Loading directory data...</span>
          </div>
        ) : (
          <div>
            {/* DIRECTORY VIEW */}
            {activeTab === 'directory' && (
              usersList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 text-center">
                  <Users className="w-8 h-8 text-zinc-600 mb-2" />
                  <p className="text-sm">No registered users found matching filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {usersList.map(item => {
                    const conn = getConnectionState(item.uid);
                    return (
                      <div key={item.uid} className="bg-[#0F1424]/40 border border-white/5 backdrop-blur-xl rounded-2xl p-5 hover:border-white/10 transition flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                              {item.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-sm">{item.fullName}</h3>
                              <span className={`px-2 py-0.5 text-[8px] font-bold font-mono tracking-wider rounded-md uppercase border ${
                                item.role === 'recruiter' 
                                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                              }`}>
                                {item.role}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-zinc-400 space-y-1 pt-2">
                            <p className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-zinc-500" /> {item.email}
                            </p>
                            {item.phone && (
                              <p className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-zinc-500" /> {item.phone}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* CTA Connect Button */}
                        <div className="pt-2">
                          {conn.status === 'none' && (
                            <button
                              onClick={() => handleSendRequest(item.uid)}
                              disabled={actioningId === item.uid}
                              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              <UserPlus className="w-4 h-4" />
                              Send Chat Request
                            </button>
                          )}
                          {conn.status === 'pending' && conn.isSender && (
                            <span className="w-full block text-center py-2 bg-white/5 border border-white/5 text-zinc-400 rounded-xl text-xs font-semibold">
                              Request Pending
                            </span>
                          )}
                          {conn.status === 'pending' && !conn.isSender && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRespond(conn.id!, 'accepted')}
                                disabled={actioningId === conn.id}
                                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleRespond(conn.id!, 'declined')}
                                disabled={actioningId === conn.id}
                                className="flex-1 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {conn.status === 'accepted' && (
                            <button
                              onClick={() => router.push('/candidate/messages')}
                              className="w-full py-2 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              Connected • Chat
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* PENDING REQUESTS VIEW */}
            {activeTab === 'pending' && (
              pendingReceived.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 text-center">
                  <Shield className="w-8 h-8 text-zinc-600 mb-2" />
                  <p className="text-sm">No incoming connection invitations at the moment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingReceived.map(conn => (
                    <div key={conn.id} className="bg-[#0F1424]/40 border border-white/5 backdrop-blur-xl rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/25 flex items-center justify-center font-bold text-sm">
                          {conn.senderName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{conn.senderName}</h3>
                          <p className="text-xs text-zinc-400">{conn.senderEmail} • {conn.senderRole}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespond(conn.id, 'accepted')}
                          disabled={actioningId === conn.id}
                          className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Accept Request
                        </button>
                        <button
                          onClick={() => handleRespond(conn.id, 'declined')}
                          disabled={actioningId === conn.id}
                          className="px-5 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-400 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* CONNECTIONS LIST VIEW */}
            {activeTab === 'connections' && (
              activeConnections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 rounded-2xl text-zinc-400 text-center">
                  <CheckCircle className="w-8 h-8 text-zinc-600 mb-2" />
                  <p className="text-sm">You haven't established any connections yet.</p>
                  <p className="text-xs text-zinc-500 mt-1">Start connecting with registered professionals in the directory.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeConnections.map(conn => {
                    const isSender = conn.senderId === user?.id;
                    const cName = isSender ? conn.receiverName : conn.senderName;
                    const cEmail = isSender ? conn.receiverEmail : conn.senderEmail;
                    const cRole = isSender ? conn.receiverRole : conn.senderRole;
                    
                    return (
                      <div key={conn.id} className="bg-[#0F1424]/40 border border-white/5 backdrop-blur-xl rounded-2xl p-5 hover:border-white/10 transition flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                              {cName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-sm">{cName}</h3>
                              <span className={`px-2 py-0.5 text-[8px] font-bold font-mono tracking-wider rounded-md uppercase border ${
                                cRole === 'recruiter'
                                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                              }`}>
                                {cRole}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-zinc-400 pt-2">
                            <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-zinc-500" /> {cEmail}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => router.push('/candidate/messages')}
                          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          Send Message
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </CandidateLayout>
  );
}
