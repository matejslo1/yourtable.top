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
  permissions?: Record<string, boolean>;
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

function InviteModal({
  open,
  onClose,
  onSaved,
  templates,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  templates: Record<string, Record<string, boolean>>;
}) {
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'staff' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setError('');
    if (!form.email || !form.password || !form.name) {
      setError('All fields are required');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          permissions: templates[form.role] || templates.staff || {},
        }),
      });
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
          <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Creating...' : 'Create User'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function PermissionsModal({
  user,
  templates,
  onClose,
  onSaved,
}: {
  user: User | null;
  templates: Record<string, Record<string, boolean>>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fallback = templates[user.role] || templates.staff || {};
    setPermissions(user.permissions || fallback);
  }, [user, templates]);

  const toggle = (key: string) => setPermissions(prev => ({ ...prev, [key]: !prev[key] }));

  const applyTemplate = (role: string) => {
    const template = templates[role] || templates.staff || {};
    setPermissions(template);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await apiFetch(`/api/v1/users/${user.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const keys = Object.keys(permissions || {});

  return (
    <Modal open={!!user} onClose={onClose} title={`Permissions${user ? ` - ${user.name}` : ''}`}>
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {Object.keys(templates).map(role => (
            <button
              key={role}
              className="px-2.5 py-1 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
              onClick={() => applyTemplate(role)}
            >
              Template: {role}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {keys.map(key => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={!!permissions[key]} onChange={() => toggle(key)} />
              {key}
            </label>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function UsersPage() {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [templates, setTemplates] = useState<Record<string, Record<string, boolean>>>({
    staff: { reservations: true },
  });

  const load = async () => {
    setLoading(true);
    try {
      const [userData, templateData] = await Promise.all([
        apiFetch<User[]>('/api/v1/users'),
        apiFetch<{ data: Record<string, Record<string, boolean>> }>('/api/v1/users/meta/permissions/templates').catch(() => ({ data: {} })),
      ]);
      setUsers(userData);
      if (templateData.data && Object.keys(templateData.data).length > 0) setTemplates(templateData.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isAdmin = me?.role === 'admin' || me?.role === 'owner';

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <div className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-[22px] font-semibold text-[#1E293B] tracking-tight">Users</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">Manage team members and access permissions</p>
          </div>
          {isAdmin && <Button onClick={() => setShowInvite(true)}>Add User</Button>}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading...</div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">No users yet</div>
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
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{u.name} {u.id === me?.id ? <span className="text-xs text-gray-400">(you)</span> : null}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{u.email}</td>
                    <td className="px-5 py-3.5"><Badge variant={roleBadge(u.role) as any}>{u.role}</Badge></td>
                    <td className="px-5 py-3.5"><Badge variant={u.isActive ? 'success' : 'default'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-5 py-3.5 text-sm text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      {isAdmin && (
                        <button
                          onClick={() => setPermissionsUser(u)}
                          className="px-2.5 py-1.5 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          Permissions
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} onSaved={load} templates={templates} />
      <PermissionsModal user={permissionsUser} templates={templates} onClose={() => setPermissionsUser(null)} onSaved={load} />
    </div>
  );
}