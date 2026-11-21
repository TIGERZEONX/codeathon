'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, rolesApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/apiClient';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { Plus, UserCog, Trash2, Shield, Lock, AlertCircle } from 'lucide-react';

interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  roleId?: string;
  roleName?: string;
  isActive?: boolean;
}

interface Role {
  _id: string;
  id?: string;
  name: string;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAdminAuthStore();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });
  const users: User[] = (usersData as { data?: User[] })?.data || (Array.isArray(usersData) ? usersData : []);

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: rolesApi.list,
  });
  const roles: Role[] = (rolesData as { data?: Role[] })?.data || (Array.isArray(rolesData) ? rolesData : []);

  const createMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      return usersApi.create({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
        roleId: form.roleId || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowCreate(false);
      setForm({ name: '', email: '', password: '', roleId: '' });
    },
    onError: (err: any) => {
      setErrorMsg(getErrorMessage(err, 'Failed to create user'));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersApi.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setDeleteId(null);
    },
  });

  const openCreate = () => {
    setErrorMsg(null);
    setForm({ name: '', email: '', password: '', roleId: '' });
    setShowCreate(true);
  };

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
      render: (u: User) =>
        u.roleName ? (
          <Badge color="primary">{u.roleName}</Badge>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
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
            onClick={() => toggleActiveMutation.mutate({ id: u._id || u.id!, isActive: !u.isActive })}
            className={`text-xs font-semibold hover:underline ${
              u.isActive !== false ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {u.isActive !== false ? 'Disable' : 'Enable'}
          </button>
          <button
            onClick={() => setDeleteId(u._id || u.id!)}
            className="text-xs font-semibold text-rose-600 hover:underline"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const isLoading = usersLoading || rolesLoading;

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Staff Administration</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage administrative personnel, assign roles, and handle staff credentials
          </p>
        </div>
        <Button size="sm" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Add Staff Member
        </Button>
      </div>

      <Table
        columns={columns}
        data={users}
        loading={isLoading}
        rowKey={(u) => u._id || u.id || u.email}
        emptyMessage="No staff administrators registered yet."
      />

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Register Staff Member">
        <div className="space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Full Name *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Sarah Jenkins"
            required
          />
          <Input
            label="Email Address *"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="sarah@university.edu"
            required
          />
          <Input
            label="Password *"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="At least 6 characters"
            required
          />
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Administrative Role</label>
            <select
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none min-h-[44px]"
              value={form.roleId}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
            >
              <option value="">Default Operational Admin</option>
              {roles.map((r) => (
                <option key={r._id || r.id} value={r._id || r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!form.name.trim() || !form.email.trim() || !form.password.trim()}
            >
              Add Staff
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Revoke Staff Account"
        message="Are you sure you want to remove this staff member? They will instantly lose administrative access."
        confirmLabel="Revoke Access"
        danger
      />
    </div>
  );
}
