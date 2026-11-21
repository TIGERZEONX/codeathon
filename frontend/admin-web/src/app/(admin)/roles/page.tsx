'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { Plus, ShieldCheck, Lock, Edit2, Trash2, CheckCircle2 } from 'lucide-react';

interface Role { _id: string; name: string; permissions: string[]; isSystem?: boolean }
interface PermGroup { group: string; permissions: string[] }

export default function RolesPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAdminAuthStore();
  if (!isSuperAdmin()) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans max-w-sm mx-auto mt-24 bg-white border border-slate-200 rounded-3xl p-8 shadow-xs">
        <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="font-bold text-slate-900 text-sm">Access Restricted</p>
        <p className="text-xs text-slate-500 mt-1">Super Administrator privileges are required to configure RBAC roles.</p>
      </div>
    );
  }

  const [showCreate, setShowCreate] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', permissions: [] as string[] });

  const { data: rolesData, isLoading } = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const roles: Role[] = (rolesData as Role[]) || [];

  const { data: permsData } = useQuery({ queryKey: ['permissions'], queryFn: rolesApi.getPermissions });
  const permGroups: PermGroup[] = (permsData as PermGroup[]) || [];

  const createMutation = useMutation({
    mutationFn: () => rolesApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setShowCreate(false); setForm({ name: '', permissions: [] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) => rolesApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setEditRole(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setDeleteId(null); },
  });

  const togglePermission = (perm: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter((p) => p !== perm)
        : [...f.permissions, perm],
    }));
  };

  const openEdit = (role: Role) => {
    setEditRole(role);
    setForm({ name: role.name, permissions: [...role.permissions] });
  };

  const columns = [
    {
      key: 'name',
      header: 'Role Profile',
      render: (r: Role) => (
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-[#3760F8]" />
          <span className="font-semibold text-slate-900 tracking-tight text-xs">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'System Classification',
      render: (r: Role) => (
        <Badge color={r.isSystem ? 'primary' : 'neon'}>
          {r.isSystem ? 'Immutable Core' : 'Custom Defined'}
        </Badge>
      ),
    },
    {
      key: 'permCount',
      header: 'Granted Permissions',
      render: (r: Role) => (
        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
          {r.permissions.length} Scope Keys
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Operations',
      render: (r: Role) =>
        r.isSystem ? (
          <span className="text-xs text-slate-400 font-medium">Protected System Role</span>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={() => openEdit(r)} className="text-xs font-semibold text-[#3760F8] hover:underline">
              Edit Matrix
            </button>
            <button onClick={() => setDeleteId(r._id)} className="text-xs font-semibold text-rose-600 hover:underline">
              Delete
            </button>
          </div>
        ),
    },
  ];

  const PermissionMatrix = () => (
    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto bg-slate-50/40">
      {permGroups.map((group) => (
        <div key={group.group}>
          <div className="bg-slate-100/90 px-4 py-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
            {group.group} Module
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.permissions.map((perm) => {
              const checked = form.permissions.includes(perm);
              return (
                <label
                  key={perm}
                  className={`flex items-center gap-2.5 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                    checked ? 'bg-[#EEF2FF] text-[#3760F8] font-semibold' : 'hover:bg-white text-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-[#3760F8] accent-[#3760F8] rounded"
                    checked={checked}
                    onChange={() => togglePermission(perm)}
                  />
                  <span className="truncate">{perm.replace(/[._]/g, ' ')}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {permGroups.length === 0 && (
        <div className="p-8 text-xs text-slate-400 text-center">No permission scope definitions found.</div>
      )}
    </div>
  );

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Roles &amp; Permission Matrix</h1>
          <p className="text-xs text-slate-500 mt-0.5">Configure role-based access control (RBAC) grants and scopes</p>
        </div>
        <Button size="sm" onClick={() => { setForm({ name: '', permissions: [] }); setShowCreate(true); }} leftIcon={<Plus className="w-4 h-4" />}>
          Create Custom Role
        </Button>
      </div>

      <Table columns={columns} data={roles} loading={isLoading} rowKey={(r) => r._id} emptyMessage="No roles found." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Custom Role Profile" size="lg">
        <div className="space-y-4">
          <Input label="Role Title" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Assessment Evaluator" required />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">Permission Capabilities Matrix</label>
              <span className="text-xs font-bold text-[#3760F8] bg-[#EEF2FF] px-2 py-0.5 rounded-full">
                {form.permissions.length} Selected
              </span>
            </div>
            <PermissionMatrix />
          </div>
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Create Role</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editRole} onClose={() => setEditRole(null)} title="Modify Role Permissions" size="lg">
        <div className="space-y-4">
          <Input label="Role Title" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800">Permission Capabilities Matrix</label>
              <span className="text-xs font-bold text-[#3760F8] bg-[#EEF2FF] px-2 py-0.5 rounded-full">
                {form.permissions.length} Selected
              </span>
            </div>
            <PermissionMatrix />
          </div>
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditRole(null)}>Cancel</Button>
            <Button size="sm" onClick={() => editRole && updateMutation.mutate({ id: editRole._id, d: form })} loading={updateMutation.isPending}>Save Role Matrix</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Role" message="Are you sure you want to delete this role profile? Staff assigned to this role will lose associated permissions." danger confirmLabel="Delete Role" />
    </div>
  );
}
