import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';
import { ArrowLeft, Search, Edit2, Trash2, UserPlus, X, Loader2, Shield, ShieldOff } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  avatar_url?: string;
  auth_provider: string;
  is_admin: boolean;
  is_active: boolean;
  language: string;
  created_at: string;
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001';

export function AdminPage() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && !user.is_admin) navigate('/');
  }, [user]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${API_BASE}/api/auth/admin/users${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error('Failed to fetch users:', e);
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleUpdate = async (userId: string, updates: Record<string, any>) => {
    if (!token) return;
    await fetch(`${API_BASE}/api/auth/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    setEditing(null);
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (!token || !window.confirm('Deactivate this user?')) return;
    await fetch(`${API_BASE}/api/auth/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchUsers();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: addName, email: addEmail, password: addPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed');
      }
      setShowAddModal(false);
      setAddName('');
      setAddEmail('');
      setAddPassword('');
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString(); }
    catch { return dateStr || '-'; }
  };

  return (
    <div className="min-h-screen bg-md-surface p-6 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-white/10 text-md-primary">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-md-primary">Admin Panel</h1>
            <span className="text-sm text-md-secondary">{users.length} users</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-md-accent text-black rounded-full font-medium text-sm hover:opacity-90"
          >
            <UserPlus size={16} /> Add User
          </button>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full bg-md-surface-container border border-white/10 rounded-xl py-3 pl-12 pr-4 text-md-primary placeholder-gray-500 outline-none focus:ring-2 focus:ring-md-accent/50"
          />
        </div>

        <div className="bg-md-surface-container rounded-2xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-md-accent" size={32} />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center p-12 text-md-secondary">No users found.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-xs text-md-outline uppercase tracking-wider">
                  <th className="text-left p-4 font-bold">Name</th>
                  <th className="text-left p-4 font-bold">Email</th>
                  <th className="text-left p-4 font-bold hidden md:table-cell">Provider</th>
                  <th className="text-center p-4 font-bold hidden md:table-cell">Admin</th>
                  <th className="text-center p-4 font-bold">Active</th>
                  <th className="text-right p-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={`border-b border-white/5 hover:bg-white/5 ${!u.is_active ? 'opacity-50' : ''}`}>
                    <td className="p-4">
                      <span className="font-medium text-md-primary">{u.name}</span>
                      <span className="block text-xs text-md-secondary">{u.language}</span>
                    </td>
                    <td className="p-4 text-sm text-md-secondary">{u.email || '-'}</td>
                    <td className="p-4 text-sm text-md-secondary hidden md:table-cell">
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">{u.auth_provider}</span>
                    </td>
                    <td className="p-4 text-center hidden md:table-cell">
                      {u.is_admin ? (
                        <Shield size={16} className="inline text-md-accent" />
                      ) : (
                        <ShieldOff size={16} className="inline text-gray-500" />
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${u.is_active ? 'bg-green-400' : 'bg-red-400'}`}></span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditing(u)} className="p-2 rounded-lg hover:bg-white/10 text-md-secondary" title="Edit user">
                          <Edit2 size={14} />
                        </button>
                        {u.id !== user?.id && (
                          <button onClick={() => handleDelete(u.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-red-400" title="Deactivate user">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
            <div className="bg-md-surface-container p-6 rounded-2xl shadow-2xl border border-white/10 w-full max-w-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-md-primary">Edit User — {editing.name}</h3>
                <button onClick={() => setEditing(null)} className="p-1 hover:bg-white/10 rounded-full">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-md-outline uppercase mb-1">Name</label>
                  <input
                    type="text"
                    defaultValue={editing.name}
                    id="edit-name"
                    className="w-full bg-md-surface-container-low border border-white/10 rounded-xl p-3 text-md-primary outline-none focus:ring-2 focus:ring-md-accent/50"
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-md-primary">Admin</span>
                  <button
                    onClick={() => handleUpdate(editing.id, { is_admin: !editing.is_admin })}
                    className={`w-12 h-6 rounded-full transition-colors ${editing.is_admin ? 'bg-md-accent' : 'bg-gray-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${editing.is_admin ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-md-primary">Active</span>
                  <button
                    onClick={() => handleUpdate(editing.id, { is_active: !editing.is_active })}
                    className={`w-12 h-6 rounded-full transition-colors ${editing.is_active ? 'bg-md-accent' : 'bg-gray-600'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${editing.is_active ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
                  </button>
                </div>

                <div className="pt-4 flex gap-3">
                  <button onClick={() => setEditing(null)} className="flex-1 py-2 rounded-xl border border-white/10 text-md-secondary text-sm hover:bg-white/5">
                    Cancel
                  </button>
                  <button onClick={() => {
                    const nameInput = document.getElementById('edit-name') as HTMLInputElement;
                    handleUpdate(editing.id, { name: nameInput.value });
                  }} className="flex-1 py-2 rounded-xl bg-md-accent text-black text-sm font-medium">
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
            <div className="bg-md-surface-container p-6 rounded-2xl shadow-2xl border border-white/10 w-full max-w-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-md-primary">Add User</h3>
                <button onClick={() => { setShowAddModal(false); setError(''); }} className="p-1 hover:bg-white/10 rounded-full">
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="space-y-4">
                <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder="Name" required
                  className="w-full bg-md-surface-container-low border border-white/10 rounded-xl p-3 text-md-primary outline-none focus:ring-2 focus:ring-md-accent/50" />
                <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="Email" required
                  className="w-full bg-md-surface-container-low border border-white/10 rounded-xl p-3 text-md-primary outline-none focus:ring-2 focus:ring-md-accent/50" />
                <input type="password" value={addPassword} onChange={e => setAddPassword(e.target.value)} placeholder="Password (min 8 chars)" required minLength={8}
                  className="w-full bg-md-surface-container-low border border-white/10 rounded-xl p-3 text-md-primary outline-none focus:ring-2 focus:ring-md-accent/50" />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => { setShowAddModal(false); setError(''); }}
                    className="flex-1 py-2 rounded-xl border border-white/10 text-md-secondary text-sm hover:bg-white/5">Cancel</button>
                  <button type="submit" className="flex-1 py-2 rounded-xl bg-md-accent text-black text-sm font-medium">Create User</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
