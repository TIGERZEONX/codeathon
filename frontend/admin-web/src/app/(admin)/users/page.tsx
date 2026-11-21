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

interface User { _id: string; name: string; email: string; roleId?: string; roleName?: string; isActive?: boolean }
interface Role { _id: string; name: string }

export default function UsersPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAdminAuthStore();
  if (!isSuperAdmin()) {
    return <div className="p-6 text-center text-gray-500 mt-20">Super Admin access required.</div>;
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
    { key: 'name', header: 'Name', render: (u: User) => <span className="font-medium text-gray-900">{u.name}</span> },
    { key: 'email', header: 'Email' },
    { key: 'roleName', header: 'Role', render: (u: User) => u.roleName ? <Badge color="blue">{u.roleName}</Badge> : '—' },
    { key: 'status', header: 'Status', render: (u: User) => <Badge color={u.isActive !== false ? 'green' : 'red'}>{u.isActive !== false ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: 'Actions', render: (u: User) => (
        <div className="flex gap-2">
          <button onClick={() => toggleActiveMutation.mutate({ id: u._id, isActive: !u.isActive })} className={`text-xs hover:underline ${u.isActive !== false ? 'text-orange-600' : 'text-green-600'}`}>
            {u.isActive !== false ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => setDeleteId(u._id)} className="text-xs text-red-600 hover:underline">Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Button onClick={() => setShowCreate(true)}>+ Create Admin User</Button>
      </div>

      <Table columns={columns} data={users} loading={isLoading} rowKey={(u) => u._id} emptyMessage="No users found." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Admin User">
        <div className="space-y-3">
          <Input label="Full Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          <div>
            <label className="text-sm font-medium text-gray-700">Role</label>
            <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}>
              <option value="">Select role...</option>
              {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Create</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete User" message="Permanently delete this user?" danger confirmLabel="Delete" />
    </div>
  );
}
