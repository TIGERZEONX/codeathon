'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, rolesApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { Plus, UserCog, Trash2, Shield, Lock } from 'lucide-react';

interface User { _id: string; name: string; email: string; roleId?: string; roleName?: string; isActive?: boolean }
interface Role { _id: string; name: string }

export default function UsersPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAdminAuthStore();
  if (!isSuperAdmin()) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans max-w-sm mx-auto mt-24 bg-white border border-slate-200 rounded-3xl p-8 shadow-xs">
        <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="font-bold text-slate-900 text-sm">Access Restricted</p>
        <p className="text-xs text-slate-500 mt-1">Super Administrator privileges are required to manage platform administrators.</p>
      </div>
    );
  }

  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' });

  const { data: usersData, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list() });
  const users: User[] = (usersData as { data?: User[] })?.data || [];

  const { data: rolesData } = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const roles: Role[] = (rolesData as Role[]) || [];

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); setForm({ name: '', email: '', password: '', roleId: '' }); },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteId(null); },
  });

  const columns = [
    {
      key: 'name',
      header: 'Staff Member',
      render: (u: User) => (
        <div>
          <span className="font-semibold text-slate-900 text-xs tracking-tight block">{u.name}</span>
          <span className="text-[11px] font-mono text-slate-400">{u.email}</span>
        </div>
      ),
    },
    {
      key: 'roleName',
      header: 'Assigned Role',
      render: (u: User) => (
        u.roleName ? <Badge color="primary">{u.roleName}</Badge> : <span className="text-slate-400 text-xs">—</span>
      ),
    },
    {
      key: 'status',
      header: 'Account Status',
      render: (u: User) => (
        <Badge color={u.isActive !== false ? 'green' : 'red'} dot>
          {u.isActive !== false ? 'Active' : 'Disabled'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Operations',
      render: (u: User) => (
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleActiveMutation.mutate({ id: u._id, isActive: !u.isActive })}
            className={`text-xs font-semibold hover:underline ${
              u.isActive !== false ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {u.isActive !== false ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => setDeleteId(u._id)}
            className="text-xs font-semibold text-rose-600 hover:underline"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff &amp; Administrators</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage administrative credentials, assigned roles, and access status</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Add Administrator
        </Button>
      </div>

      <Table columns={columns} data={users} loading={isLoading} rowKey={(u) => u._id} emptyMessage="No administrative users found." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Administrator Account">
        <div className="space-y-4">
          <Input label="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Elena Rostova" required />
          <Input label="Email Address" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="elena@codeathon.dev" required />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" required />
          <div>
            <label className="text-xs font-semibold text-slate-700">Role Privilege Level</label>
            <select
              className="mt-1 w-full border border-slate-200 bg-white rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
              value={form.roleId}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
            >
              <option value="">Select an RBAC role profile...</option>
              {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Create Staff Account</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Administrator" message="Are you sure you want to permanently delete this administrator user?" danger confirmLabel="Delete User" />
    </div>
  );
}
