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
import { Plus, Trash2, Edit2, Network, UserCheck } from 'lucide-react';

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
    {
      key: 'name',
      header: 'Team Name',
      render: (t: Team) => (
        <div className="flex items-center gap-2">
          <Network className="w-3.5 h-3.5 text-[#3760F8]" />
          <span className="font-semibold text-slate-900 tracking-tight text-xs">{t.name}</span>
        </div>
      ),
    },
    {
      key: 'members',
      header: 'Total Members',
      render: (t: Team) => (
        <Badge color="neon">{(t.memberIds || []).length} Members</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (t: Team) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(t)}
            className="text-xs font-semibold text-[#3760F8] hover:underline"
          >
            Edit Roster
          </button>
          <button
            onClick={() => setDeleteId(t._id)}
            className="text-xs font-semibold text-rose-600 hover:underline ml-2"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const MemberSelect = () => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-700">Select Candidates</label>
        <span className="text-xs font-bold text-[#3760F8] bg-[#EEF2FF] px-2 py-0.5 rounded-full">
          {form.memberIds.length} Selected
        </span>
      </div>
      <div className="border border-slate-200 rounded-2xl max-h-56 overflow-y-auto divide-y divide-slate-100 bg-slate-50/40">
        {participants.map((p) => {
          const checked = form.memberIds.includes(p._id);
          return (
            <label
              key={p._id}
              className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                checked ? 'bg-[#EEF2FF]/60' : 'hover:bg-white'
              }`}
            >
              <input
                type="checkbox"
                className="w-4 h-4 accent-[#3760F8] rounded"
                checked={checked}
                onChange={() => toggleMember(p._id)}
              />
              <span className="text-xs font-mono text-slate-500 font-semibold">{p.rollNumber}</span>
              <span className="text-xs font-medium text-slate-800">{p.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team Formations</h1>
          <p className="text-xs text-slate-500 mt-0.5">Organize student teams for hackathon and collaborative rounds</p>
        </div>
        <Button size="sm" onClick={() => { setForm({ name: '', memberIds: [] }); setShowCreate(true); }} leftIcon={<Plus className="w-4 h-4" />}>
          Create Team
        </Button>
      </div>

      <Table columns={columns} data={teams} loading={isLoading} rowKey={(t) => t._id} emptyMessage="No teams created yet. Click 'Create Team' above." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Team Formation" size="lg">
        <div className="space-y-4">
          <Input label="Team Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Algorithmics Team Alpha" />
          <MemberSelect />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} loading={createMutation.isPending}>Create Team</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editTeam} onClose={() => setEditTeam(null)} title="Edit Team Roster" size="lg">
        <div className="space-y-4">
          <Input label="Team Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <MemberSelect />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditTeam(null)}>Cancel</Button>
            <Button size="sm" onClick={() => editTeam && updateMutation.mutate({ id: editTeam._id, d: form })} loading={updateMutation.isPending}>Save Changes</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} loading={deleteMutation.isPending} title="Delete Team" message="Are you sure you want to delete this team? Members will not be deleted." confirmLabel="Delete Team" danger />
    </div>
  );
}
