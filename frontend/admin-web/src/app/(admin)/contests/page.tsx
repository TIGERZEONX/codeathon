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
import {
  Plus,
  Search,
  Edit2,
  Copy,
  Clock,
  Trash2,
  Users,
  Trophy,
  FileSpreadsheet,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

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
    {
      key: 'title',
      header: 'Contest Title',
      render: (c: Contest) => (
        <div>
          <Link href={`/contests/${c._id}`} className="font-semibold text-slate-900 hover:text-[#3760F8] transition-colors block tracking-tight">
            {c.title}
          </Link>
          <span className="text-[11px] text-slate-400 font-mono">ID: {c._id.slice(-6)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c: Contest) => (
        <Badge color={statusColor[c.status] || 'gray'} dot>{c.status}</Badge>
      ),
    },
    {
      key: 'startTime',
      header: 'Start Date & Time',
      render: (c: Contest) => (
        <span className="text-xs text-slate-600 font-medium">
          {new Date(c.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'durationMinutes',
      header: 'Duration',
      render: (c: Contest) => (
        <span className="text-xs font-mono font-medium text-slate-700">{c.durationMinutes}m</span>
      ),
    },
    {
      key: 'totalMarks',
      header: 'Max Marks',
      render: (c: Contest) => (
        <span className="text-xs font-mono font-bold text-[#3760F8]">{c.totalMarks} pts</span>
      ),
    },
    {
      key: 'actions',
      header: 'Operations',
      render: (c: Contest) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/contests/${c._id}`}
            className="text-[11px] font-semibold px-2.5 py-1 bg-slate-100 hover:bg-[#EEF2FF] hover:text-[#3760F8] text-slate-700 rounded-lg transition-colors"
          >
            Manage
          </Link>
          <button
            onClick={() => openEdit(c)}
            className="text-[11px] font-medium px-2 py-1 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => duplicateMutation.mutate(c._id)}
            className="text-[11px] font-medium px-2 py-1 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
          >
            Clone
          </button>
          <button
            onClick={() => setTimingModal({ id: c._id, title: c.title })}
            className="text-[11px] font-medium px-2 py-1 hover:bg-slate-100 text-[#3760F8] rounded-lg transition-colors"
          >
            +Time
          </button>
          <button
            onClick={() => setDeleteId(c._id)}
            className="text-[11px] font-medium px-2 py-1 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  const ContestForm = ({ onSave, saving }: { onSave: () => void; saving: boolean }) => (
    <div className="space-y-4">
      <Input label="Contest Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Start Window" type="datetime-local" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        <Input label="End Window" type="datetime-local" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Duration (Minutes)" type="number" value={String(form.durationMinutes)} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} />
        <Input label="Total Score Marks" type="number" value={String(form.totalMarks)} onChange={(e) => setForm((f) => ({ ...f, totalMarks: Number(e.target.value) }))} />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-700">Evaluation Rubric</label>
        <select className="mt-1 w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none" value={form.rubricId} onChange={(e) => setForm((f) => ({ ...f, rubricId: e.target.value }))}>
          <option value="">Default Standard Evaluation</option>
          {rubrics.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
        </select>
      </div>
      <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="proctorEnabled" className="w-4 h-4 text-[#3760F8] accent-[#3760F8] rounded" checked={form.proctorEnabled} onChange={(e) => setForm((f) => ({ ...f, proctorEnabled: e.target.checked }))} />
          <label htmlFor="proctorEnabled" className="text-xs font-bold text-slate-800">Enable Automated Security Proctoring</label>
        </div>
        {form.proctorEnabled && (
          <div className="ml-5 space-y-2 text-xs text-slate-700 pt-1">
            {(['blockTabSwitch', 'blockCopyPaste', 'enforceFullscreen', 'blockRightClick'] as const).map((key) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-[#3760F8]" checked={form[key] as boolean} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
                <span>{key.replace(/([A-Z])/g, ' $1').replace('block ', 'Block ').replace('enforce ', 'Enforce ')}</span>
              </label>
            ))}
            <div className="pt-1 max-w-xs">
              <Input label="Violation Threshold Limit" type="number" value={String(form.maxViolations)} onChange={(e) => setForm((f) => ({ ...f, maxViolations: Number(e.target.value) }))} />
            </div>
          </div>
        )}
      </div>
      <div className="border border-slate-200 rounded-2xl p-4 space-y-2 bg-slate-50/50">
        <p className="text-xs font-bold text-slate-800">Leaderboard Configuration</p>
        <div className="flex gap-4 text-xs text-slate-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-[#3760F8]" checked={form.leaderboardVisible} onChange={(e) => setForm((f) => ({ ...f, leaderboardVisible: e.target.checked }))} />
            Visible to Candidates
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-[#3760F8]" checked={form.leaderboardAnonymous} onChange={(e) => setForm((f) => ({ ...f, leaderboardAnonymous: e.target.checked }))} />
            Anonymize Names
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2.5 pt-2">
        <Button variant="outline" size="sm" onClick={() => { setShowCreate(false); setEditContest(null); }}>Cancel</Button>
        <Button size="sm" onClick={onSave} loading={saving}>Save Contest</Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contests Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">Create, schedule, configure, and supervise programming contests</p>
        </div>
        <Button size="sm" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Create Contest
        </Button>
      </div>

      <div className="max-w-md">
        <Input placeholder="Search contests by title..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Table columns={columns} data={contests} loading={isLoading} rowKey={(c) => c._id} emptyMessage="No contests created yet. Click 'Create Contest' above." />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Contest" size="lg">
        <ContestForm onSave={() => createMutation.mutate(form)} saving={createMutation.isPending} />
      </Modal>

      <Modal open={!!editContest} onClose={() => setEditContest(null)} title="Edit Contest Settings" size="lg">
        <ContestForm onSave={() => editContest && updateMutation.mutate({ id: editContest._id, d: form })} saving={updateMutation.isPending} />
      </Modal>

      <Modal open={!!timingModal} onClose={() => setTimingModal(null)} title="Extend Contest Window" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Grant extra time extension for active candidates in <strong>{timingModal?.title}</strong>:
          </p>
          <Input label="Extension Minutes" type="number" value={extensionMin} onChange={(e) => setExtensionMin(e.target.value)} placeholder="e.g. 15" />
          <Input label="Official Reason" value={timingReason} onChange={(e) => setTimingReason(e.target.value)} placeholder="e.g. Technical delay" />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setTimingModal(null)}>Cancel</Button>
            <Button size="sm" loading={timingMutation.isPending} onClick={() => timingModal && timingMutation.mutate({ id: timingModal.id, ext: Number(extensionMin), reason: timingReason })}>Apply Extension</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Delete Contest"
        message="Are you sure you want to delete this contest? All question sections, attempts, and submitted solutions will be permanently removed."
        confirmLabel="Delete Contest"
        danger
      />
    </div>
  );
}
