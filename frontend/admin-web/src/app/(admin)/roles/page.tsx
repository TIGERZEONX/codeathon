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

interface Role { _id: string; name: string; permissions: string[]; isSystem?: boolean }
interface PermGroup { group: string; permissions: string[] }

export default function RolesPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAdminAuthStore();
  if (!isSuperAdmin()) {
    return <div className="p-6 text-center text-gray-500 mt-20">Super Admin access required.</div>;
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
    { key: 'name', header: 'Role Name', render: (r: Role) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'type', header: 'Type', render: (r: Role) => <Badge color={r.isSystem ? 'blue' : 'purple'}>{r.isSystem ? 'System' : 'Custom'}</Badge> },
    { key: 'permCount', header: 'Permissions', render: (r: Role) => <span className="text-gray-600">{r.permissions.length} permissions</span> },
    {
      key: 'actions', header: 'Actions', render: (r: Role) => r.isSystem ? (
        <span className="text-xs text-gray-400">System role</span>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => openEdit(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={() => setDeleteId(r._id)} className="text-xs text-red-600 hover:underline">Delete</button>
        </div>
      ),
    },
  ];

  const PermissionMatrix = () => (
    <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
      {permGroups.map((group) => (
        <div key={group.group}>
          <div className="bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide border-b">
            {group.group}
          </div>
          <div className="px-3 py-2 grid grid-cols-2 gap-1">
            {group.permissions.map((perm) => (
              <label key={perm} className="flex items-center gap-2 text-xs cursor-pointer hover:text-blue-700 py-0.5">
                <input
                  type="checkbox"
                  className="accent-blue-600"
                  checked={form.permissions.includes(perm)}
                  onChange={() => togglePermission(perm)}
                />
                {perm.replace(/[._]/g, ' ')}
              </label>
            ))}
          </div>
        </div>
      ))}
      {permGroups.length === 0 && (
        <div className="p-4 text-sm text-gray-400 text-center">No permission groups defined.</div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
        <Button onClick={() => { setForm({ name: '', permissions: [] }); setShowCreate(true); }}>+ Create Role</Button>
      </div>

      <Table columns={columns} data={roles} loading={isLoading} rowKey={(r) => r._id} emptyMessage="No roles found." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Role" size="lg">
        <div className="space-y-4">
          <Input label="Role Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Permissions ({form.permissions.length} selected)
            </label>
            <PermissionMatrix />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editRole} onClose={() => setEditRole(null)} title="Edit Role" size="lg">
        <div className="space-y-4">
          <Input label="Role Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Permissions ({form.permissions.length} selected)
            </label>
            <PermissionMatrix />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setEditRole(null)}>Cancel</Button>
            <Button onClick={() => editRole && updateMutation.mutate({ id: editRole._id, d: form })} loading={updateMutation.isPending}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Role" message="Delete this role? Users with this role will lose their permissions." danger confirmLabel="Delete" />
    </div>
  );
}
