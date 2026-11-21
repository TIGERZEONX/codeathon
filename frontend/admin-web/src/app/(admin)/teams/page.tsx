'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi, participantsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';

interface Team { _id: string; name: string; memberIds: string[]; memberNames?: string[] }
interface Participant { _id: string; rollNumber: string; name: string }

export default function TeamsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', memberIds: [] as string[] });

  const { data: teamsData, isLoading } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });
  const teams: Team[] = (teamsData as Team[]) || [];

  const { data: participantsData } = useQuery({
    queryKey: ['participants-all'],
    queryFn: () => participantsApi.list({ limit: 500 }),
  });
  const participants: Participant[] = (participantsData as { data?: Participant[] })?.data || [];

  const createMutation = useMutation({
    mutationFn: () => teamsApi.create({ name: form.name, memberIds: form.memberIds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); setShowCreate(false); setForm({ name: '', memberIds: [] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) => teamsApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); setEditTeam(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); setDeleteId(null); },
  });

  const toggleMember = (participantId: string) => {
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(participantId)
        ? f.memberIds.filter((id) => id !== participantId)
        : [...f.memberIds, participantId],
    }));
  };

  const openEdit = (team: Team) => {
    setEditTeam(team);
    setForm({ name: team.name, memberIds: team.memberIds || [] });
  };

  const columns = [
    { key: 'name', header: 'Team Name', render: (t: Team) => <span className="font-medium text-gray-900">{t.name}</span> },
    { key: 'members', header: 'Members', render: (t: Team) => <Badge color="blue">{(t.memberIds || []).length} members</Badge> },
    {
      key: 'actions', header: 'Actions', render: (t: Team) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(t)} className="text-xs text-blue-600 hover:underline">Edit</button>
          <button onClick={() => setDeleteId(t._id)} className="text-xs text-red-600 hover:underline">Delete</button>
        </div>
      ),
    },
  ];

  const MemberSelect = () => (
    <div>
      <label className="text-sm font-medium text-gray-700">Members ({form.memberIds.length} selected)</label>
      <div className="mt-1 border rounded-lg max-h-48 overflow-y-auto">
        {participants.map((p) => (
          <label key={p._id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={form.memberIds.includes(p._id)}
              onChange={() => toggleMember(p._id)}
            />
            <span className="text-sm text-gray-800">{p.rollNumber} — {p.name}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
        <Button onClick={() => { setForm({ name: '', memberIds: [] }); setShowCreate(true); }}>+ Create Team</Button>
      </div>

      <Table columns={columns} data={teams} loading={isLoading} rowKey={(t) => t._id} emptyMessage="No teams yet." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Team" size="lg">
        <div className="space-y-4">
          <Input label="Team Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <MemberSelect />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editTeam} onClose={() => setEditTeam(null)} title="Edit Team" size="lg">
        <div className="space-y-4">
          <Input label="Team Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <MemberSelect />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setEditTeam(null)}>Cancel</Button>
            <Button onClick={() => editTeam && updateMutation.mutate({ id: editTeam._id, d: form })} loading={updateMutation.isPending}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Team" message="Delete this team?" confirmLabel="Delete" danger />
    </div>
  );
}
