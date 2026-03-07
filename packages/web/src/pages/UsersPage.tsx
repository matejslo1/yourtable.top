import { useEffect, useState } from 'react';
import { apiFetch, useAuthStore } from '@/lib/auth';
import { Modal, Badge, Button, Input, Select } from '@/components/ui';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
];

const roleBadge = (role: string) => {
  if (role === 'owner') return 'purple';
  if (role === 'admin') return 'danger';
  if (role === 'manager') return 'warning';
  return 'default';
};

// ── Modals ──────────────────────────────────────────────

function InviteModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setError('');
    if (!form.email || !form.password || !form.name) { setError('All fields are required'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      await apiFetch('/api/v1/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ email: '', password: '', name: '', role: 'staff' });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add New User">
      <div className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Full Name</label>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
          <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@restaurant.com" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Password</label>
          <Input type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Role</label>
          <Select value={form.role} onChange={e => set('role', e.target.value)} options={ROLE_OPTIONS}>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function EditModal({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) setForm({ name: user.name, role: user.role });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setError('');
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/v1/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!user} onClose={onClose} title="Edit User">
      <div className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Full Name</label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Role</label>
          <Select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} options={ROLE_OPTIONS}>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ChangePasswordModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { user: me } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isSelf = user?.id === me?.id;

  const handleSave = async () => {
    if (!user) return;
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      const endpoint = isSelf
        ? '/api/v1/users/me/change-password'
        : `/api/v1/users/${user.id}/change-password`;
      await apiFetch(endpoint, { method: 'POST', body: JSON.stringify({ password }) });
      setSuccess(true);
      setPassword('');
      setConfirm('');
      setTimeout(() => { setSuccess(false); onClose(); }, 1500);
    } catch (e: any) {
      setError(e.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!user} onClose={onClose} title={`Change Password${user ? ` — ${user.name}` : ''}`}>
      <div className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
        {success && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600 text-sm">Password changed successfully!</div>}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">New Password</label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirm Password</label>
          <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || success}>
            {saving ? 'Saving...' : 'Change Password'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteModal({ user, onClose, onDeleted }: { user: User | null; onClose: () => void; onDeleted: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/api/v1/users/${user.id}`, { method: 'DELETE' });
      onDeleted();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!user} onClose={onClose} title="Delete User">
      <div className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}
        <p className="text-sm text-gray-600">
          Are you sure you want to delete <span className="font-semibold text-gray-900">{user?.name}</span>?
          This will permanently remove their account and access.
        </p>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <button
            className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            onClick={handleDelete}
            disabled={saving}
          >
            {saving ? 'Deleting...' : 'Delete User'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ────────────────────────────────────────────

export function UsersPage() {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<User[]>('/api/v1/users');
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isOwner = me?.role === 'owner';
  const isAdmin = me?.role === 'admin' || isOwner;

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Users</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">Manage team members and their access</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowInvite(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add User
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading...</div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              No users yet
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">Name</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">Email</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-5 py-3">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{u.name}</span>
                        {u.id === me?.id && <span className="text-xs text-gray-400">(you)</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={roleBadge(u.role) as any}>{u.role}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={u.isActive ? 'success' : 'default'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Change own password always allowed; others need admin */}
                        {(u.id === me?.id || isAdmin) && (
                          <button
                            onClick={() => setPasswordUser(u)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            title="Change password"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          </button>
                        )}
                        {isAdmin && u.id !== me?.id && (
                          <button
                            onClick={() => setEditUser(u)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            title="Edit user"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                        )}
                        {isOwner && u.id !== me?.id && (
                          <button
                            onClick={() => setDeleteUser(u)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete user"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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
      </div>

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} onSaved={load} />
      <EditModal user={editUser} onClose={() => setEditUser(null)} onSaved={load} />
      <ChangePasswordModal user={passwordUser} onClose={() => setPasswordUser(null)} />
      <DeleteModal user={deleteUser} onClose={() => setDeleteUser(null)} onDeleted={load} />
    </div>
  );
}
