'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contestsApi, rubricsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import Link from 'next/link';

interface Contest {
  _id: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalMarks: number;
  rubricId?: string;
  proctorConfig?: { enabled?: boolean };
}

interface Rubric { _id: string; name: string }

type ContestStatus = 'draft' | 'live' | 'completed' | 'cancelled';

const statusColor: Record<string, 'gray' | 'green' | 'blue' | 'red'> = {
  draft: 'gray',
  live: 'green',
  completed: 'blue',
  cancelled: 'red',
};

const EMPTY_FORM = {
  title: '',
  startTime: '',
  endTime: '',
  durationMinutes: 180,
  totalMarks: 100,
  rubricId: '',
  description: '',
  proctorEnabled: false,
  blockTabSwitch: true,
  blockCopyPaste: true,
  enforceFullscreen: false,
  blockRightClick: true,
  maxViolations: 5,
  leaderboardVisible: true,
  leaderboardAnonymous: false,
  leaderboardTopN: 0,
};

export default function ContestsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editContest, setEditContest] = useState<Contest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [search, setSearch] = useState('');
  const [timingModal, setTimingModal] = useState<{ id: string; title: string } | null>(null);
  const [extensionMin, setExtensionMin] = useState('');
  const [timingReason, setTimingReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['contests', search],
    queryFn: () => contestsApi.list({ search, limit: 50 }),
  });
  const contests: Contest[] = (data as { data?: Contest[] })?.data || [];

  const { data: rubricsData } = useQuery({ queryKey: ['rubrics'], queryFn: rubricsApi.list });
  const rubrics: Rubric[] = (rubricsData as Rubric[]) || [];

  const createMutation = useMutation({
    mutationFn: (d: typeof form) =>
      contestsApi.create({
        title: d.title,
        startTime: d.startTime,
        endTime: d.endTime,
        durationMinutes: Number(d.durationMinutes),
        totalMarks: Number(d.totalMarks),
        rubricId: d.rubricId || undefined,
        description: d.description,
        proctorConfig: {
          enabled: d.proctorEnabled,
          blockTabSwitch: d.blockTabSwitch,
          blockCopyPaste: d.blockCopyPaste,
          enforceFullscreen: d.enforceFullscreen,
          blockRightClick: d.blockRightClick,
          maxViolations: Number(d.maxViolations),
        },
        leaderboardConfig: {
          visible: d.leaderboardVisible,
          anonymous: d.leaderboardAnonymous,
          topN: Number(d.leaderboardTopN) || 0,
        },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contests'] }); setShowCreate(false); setForm({ ...EMPTY_FORM }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) =>
      contestsApi.update(id, { title: d.title, startTime: d.startTime, endTime: d.endTime, durationMinutes: Number(d.durationMinutes) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contests'] }); setEditContest(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contestsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contests'] }); setDeleteId(null); },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => contestsApi.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contests'] }),
  });

  const timingMutation = useMutation({
    mutationFn: ({ id, ext, reason }: { id: string; ext: number; reason: string }) =>
      contestsApi.adjustTiming(id, ext, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contests'] }); setTimingModal(null); setExtensionMin(''); setTimingReason(''); },
  });

  const openCreate = () => { setForm({ ...EMPTY_FORM }); setShowCreate(true); };
  const openEdit = (c: Contest) => {
    setEditContest(c);
    setForm({
      ...EMPTY_FORM,
      title: c.title,
      startTime: c.startTime?.slice(0, 16) || '',
      endTime: c.endTime?.slice(0, 16) || '',
      durationMinutes: c.durationMinutes,
      totalMarks: c.totalMarks,
    });
  };

  const columns = [
    { key: 'title', header: 'Title', render: (c: Contest) => (
      <Link href={`/contests/${c._id}`} className="text-blue-600 hover:underline font-medium">{c.title}</Link>
    )},
    { key: 'status', header: 'Status', render: (c: Contest) => (
      <Badge color={statusColor[c.status] || 'gray'}>{c.status}</Badge>
    )},
    { key: 'startTime', header: 'Start', render: (c: Contest) => new Date(c.startTime).toLocaleString() },
    { key: 'durationMinutes', header: 'Duration', render: (c: Contest) => `${c.durationMinutes}m` },
    { key: 'totalMarks', header: 'Marks' },
    { key: 'actions', header: 'Actions', render: (c: Contest) => (
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => openEdit(c)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">Edit</button>
        <button onClick={() => duplicateMutation.mutate(c._id)} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">Duplicate</button>
        <button onClick={() => setTimingModal({ id: c._id, title: c.title })} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">+Time</button>
        <Link href={`/attendance/${c._id}`} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">Attendance</Link>
        <Link href={`/leaderboard/${c._id}`} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">LB</Link>
        <Link href={`/reports/${c._id}`} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">Report</Link>
        <Link href={`/proctoring/${c._id}`} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">Proctor</Link>
        <button onClick={() => setDeleteId(c._id)} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">Delete</button>
      </div>
    )},
  ];

  const ContestForm = ({ onSave, saving }: { onSave: () => void; saving: boolean }) => (
    <div className="space-y-4">
      <Input label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Start Time" type="datetime-local" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        <Input label="End Time" type="datetime-local" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Duration (min)" type="number" value={String(form.durationMinutes)} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} />
        <Input label="Total Marks" type="number" value={String(form.totalMarks)} onChange={(e) => setForm((f) => ({ ...f, totalMarks: Number(e.target.value) }))} />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Rubric</label>
        <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={form.rubricId} onChange={(e) => setForm((f) => ({ ...f, rubricId: e.target.value }))}>
          <option value="">No Rubric</option>
          {rubrics.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
        </select>
      </div>
      <div className="border rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="proctorEnabled" checked={form.proctorEnabled} onChange={(e) => setForm((f) => ({ ...f, proctorEnabled: e.target.checked }))} />
          <label htmlFor="proctorEnabled" className="text-sm font-medium text-gray-700">Enable Proctoring</label>
        </div>
        {form.proctorEnabled && (
          <div className="ml-4 space-y-1 text-sm">
            {(['blockTabSwitch', 'blockCopyPaste', 'enforceFullscreen', 'blockRightClick'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[key] as boolean} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
                {key.replace(/([A-Z])/g, ' $1').replace('block ', 'Block ').replace('enforce ', 'Enforce ')}
              </label>
            ))}
            <Input label="Max Violations" type="number" value={String(form.maxViolations)} onChange={(e) => setForm((f) => ({ ...f, maxViolations: Number(e.target.value) }))} />
          </div>
        )}
      </div>
      <div className="border rounded-lg p-3 space-y-2">
        <p className="text-sm font-medium text-gray-700">Leaderboard</p>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.leaderboardVisible} onChange={(e) => setForm((f) => ({ ...f, leaderboardVisible: e.target.checked }))} />
            Visible to students
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.leaderboardAnonymous} onChange={(e) => setForm((f) => ({ ...f, leaderboardAnonymous: e.target.checked }))} />
            Anonymous
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={() => { setShowCreate(false); setEditContest(null); }}>Cancel</Button>
        <Button onClick={onSave} loading={saving}>Save Contest</Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contests</h1>
        <Button onClick={openCreate}>+ Create Contest</Button>
      </div>
      <div className="max-w-sm">
        <Input placeholder="Search contests..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <Table columns={columns} data={contests} loading={isLoading} rowKey={(c) => c._id} emptyMessage="No contests found. Create one to get started." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Contest" size="lg">
        <ContestForm onSave={() => createMutation.mutate(form)} saving={createMutation.isPending} />
      </Modal>

      <Modal open={!!editContest} onClose={() => setEditContest(null)} title="Edit Contest" size="lg">
        <ContestForm onSave={() => editContest && updateMutation.mutate({ id: editContest._id, d: form })} saving={updateMutation.isPending} />
      </Modal>

      <Modal open={!!timingModal} onClose={() => setTimingModal(null)} title="Adjust Contest Time" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Adding extension time for: <strong>{timingModal?.title}</strong></p>
          <Input label="Extension (minutes)" type="number" value={extensionMin} onChange={(e) => setExtensionMin(e.target.value)} />
          <Input label="Reason" value={timingReason} onChange={(e) => setTimingReason(e.target.value)} />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setTimingModal(null)}>Cancel</Button>
            <Button loading={timingMutation.isPending} onClick={() => timingModal && timingMutation.mutate({ id: timingModal.id, ext: Number(extensionMin), reason: timingReason })}>Apply Extension</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Delete Contest"
        message="Are you sure? This will permanently delete the contest and all associated data."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
