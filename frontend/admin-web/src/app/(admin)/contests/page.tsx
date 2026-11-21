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
  AlertCircle,
} from 'lucide-react';

interface Contest {
  _id: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalMarks?: number;
  rubricId?: string;
  proctorConfig?: { enabled?: boolean };
}

interface Rubric {
  _id: string;
  name: string;
}

const statusColor: Record<string, 'gray' | 'green' | 'blue' | 'red'> = {
  draft: 'gray',
  scheduled: 'blue',
  live: 'green',
  completed: 'blue',
  ended: 'gray',
  archived: 'gray',
  cancelled: 'red',
};

const getDefaultForm = () => {
  const now = new Date();
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  return {
    title: '',
    startTime: formatLocal(now),
    endTime: formatLocal(later),
    durationMinutes: 180,
    totalMarks: 100,
    rubricId: '',
    description: '',
    instructions: '',
    proctorEnabled: true,
    detectTabSwitch: true,
    blockCopyPaste: true,
    enforceFullscreen: true,
    blockRightClick: true,
    maxViolations: 5,
    leaderboardEnabled: true,
    leaderboardAnonymous: false,
    leaderboardTopN: 50,
  };
};

export default function ContestsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editContest, setEditContest] = useState<Contest | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(getDefaultForm());
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timingModal, setTimingModal] = useState<{ id: string; title: string } | null>(null);
  const [extensionMin, setExtensionMin] = useState('');
  const [timingReason, setTimingReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['contests', search],
    queryFn: () => contestsApi.list({ search, limit: 50 }),
  });
  const contests: Contest[] = (data as { data?: Contest[] })?.data || [];

  const { data: rubricsData } = useQuery({
    queryKey: ['rubrics'],
    queryFn: rubricsApi.list,
  });
  const rubrics: Rubric[] = (rubricsData as Rubric[]) || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const startIso = form.startTime ? new Date(form.startTime).toISOString() : new Date().toISOString();
      const endIso = form.endTime ? new Date(form.endTime).toISOString() : new Date(Date.now() + 86400000).toISOString();

      return contestsApi.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        instructions: form.instructions.trim() || undefined,
        startTime: startIso,
        endTime: endIso,
        durationMinutes: Number(form.durationMinutes) || 60,
        rubricId: form.rubricId || undefined,
        proctorConfig: {
          enabled: form.proctorEnabled,
          detectTabSwitch: form.detectTabSwitch,
          detectWindowBlur: true,
          blockCopyPaste: form.blockCopyPaste,
          blockRightClick: form.blockRightClick,
          enforceFullscreen: form.enforceFullscreen,
          blockDevTools: true,
          blockPrintScreen: true,
          blockTextSelection: true,
          maxViolations: Number(form.maxViolations) || 5,
        },
        leaderboardConfig: {
          enabled: form.leaderboardEnabled,
          displayMode: form.leaderboardAnonymous ? 'anonymous' : 'with_names',
          topN: Number(form.leaderboardTopN) || 50,
          freezeMinutesBeforeEnd: 0,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contests'] });
      setShowCreate(false);
      setForm(getDefaultForm());
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create contest';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      setErrorMsg(null);
      const startIso = form.startTime ? new Date(form.startTime).toISOString() : undefined;
      const endIso = form.endTime ? new Date(form.endTime).toISOString() : undefined;

      return contestsApi.update(id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        startTime: startIso,
        endTime: endIso,
        durationMinutes: Number(form.durationMinutes) || 60,
        rubricId: form.rubricId || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contests'] });
      setEditContest(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update contest';
      setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contestsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contests'] });
      setDeleteId(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => contestsApi.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contests'] }),
  });

  const timingMutation = useMutation({
    mutationFn: ({ id, ext, reason }: { id: string; ext: number; reason: string }) =>
      contestsApi.adjustTiming(id, ext, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contests'] });
      setTimingModal(null);
      setExtensionMin('');
      setTimingReason('');
    },
  });

  const openCreate = () => {
    setErrorMsg(null);
    setForm(getDefaultForm());
    setShowCreate(true);
  };

  const openEdit = (c: Contest) => {
    setErrorMsg(null);
    setEditContest(c);
    setForm({
      ...getDefaultForm(),
      title: c.title,
      startTime: c.startTime?.slice(0, 16) || '',
      endTime: c.endTime?.slice(0, 16) || '',
      durationMinutes: c.durationMinutes,
      rubricId: c.rubricId || '',
    });
  };

  const columns = [
    {
      key: 'title',
      header: 'Contest Title',
      render: (c: Contest) => (
        <div>
          <Link
            href={`/contests/${c._id}`}
            className="font-semibold text-slate-900 hover:text-[#3760F8] transition-colors block tracking-tight"
          >
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
        <Badge color={statusColor[c.status] || 'gray'}>
          {c.status.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (c: Contest) => (
        <span className="text-xs font-mono font-medium text-slate-700">{c.durationMinutes} mins</span>
      ),
    },
    {
      key: 'timing',
      header: 'Scheduled Window',
      render: (c: Contest) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <p>Start: {new Date(c.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
          <p>End: {new Date(c.endTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
        </div>
      ),
    },
    {
      key: 'security',
      header: 'Proctoring',
      render: (c: Contest) => (
        <Badge color={c.proctorConfig?.enabled ? 'neon' : 'gray'}>
          {c.proctorConfig?.enabled ? 'Strict Lock' : 'Standard'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c: Contest) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link href={`/contests/${c._id}`}>
            <Button variant="ghost" size="sm">
              Manage
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => openEdit(c)} leftIcon={<Edit2 className="w-3.5 h-3.5" />}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => duplicateMutation.mutate(c._id)}
            leftIcon={<Copy className="w-3.5 h-3.5" />}
          >
            Clone
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTimingModal({ id: c._id, title: c.title })}
            leftIcon={<Clock className="w-3.5 h-3.5" />}
          >
            Extend
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={() => setDeleteId(c._id)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assessment Contests</h1>
          <p className="text-xs text-slate-500 mt-1">
            Create, schedule, manage sections &amp; question banks, and monitor live exam environments
          </p>
        </div>
        <Button size="sm" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Create Contest
        </Button>
      </div>

      {/* Search Bar */}
      <div className="max-w-md">
        <Input
          placeholder="Filter contests by title or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Main Table */}
      <Table
        columns={columns}
        data={contests}
        loading={isLoading}
        rowKey={(c) => c._id}
        emptyMessage="No contests found. Click 'Create Contest' to launch your first assessment."
      />

      {/* Create Contest Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Assessment Contest" size="lg">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Contest Title *"
            placeholder="e.g. National Coding Olympiad 2026 - Round 1"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Window *"
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
            <Input
              label="End Window *"
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Duration (Minutes) *"
              type="number"
              min="5"
              value={String(form.durationMinutes)}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
            />
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Evaluation Rubric</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none min-h-[44px]"
                value={form.rubricId}
                onChange={(e) => setForm((f) => ({ ...f, rubricId: e.target.value }))}
              >
                <option value="">Default Standard Evaluation</option>
                {rubrics.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Description (Optional)"
            placeholder="Brief overview or eligibility criteria"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />

          {/* Security Proctoring Section */}
          <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="createProctorEnabled"
                className="w-4 h-4 text-[#3760F8] accent-[#3760F8] rounded"
                checked={form.proctorEnabled}
                onChange={(e) => setForm((f) => ({ ...f, proctorEnabled: e.target.checked }))}
              />
              <label htmlFor="createProctorEnabled" className="text-xs font-bold text-slate-800 cursor-pointer">
                Enable Automated Anti-Cheat Security Proctoring
              </label>
            </div>

            {form.proctorEnabled && (
              <div className="ml-6 space-y-2.5 text-xs text-slate-700 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-[#3760F8]"
                      checked={form.detectTabSwitch}
                      onChange={(e) => setForm((f) => ({ ...f, detectTabSwitch: e.target.checked }))}
                    />
                    <span>Detect Tab Switches</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-[#3760F8]"
                      checked={form.blockCopyPaste}
                      onChange={(e) => setForm((f) => ({ ...f, blockCopyPaste: e.target.checked }))}
                    />
                    <span>Block Copy &amp; Paste</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-[#3760F8]"
                      checked={form.enforceFullscreen}
                      onChange={(e) => setForm((f) => ({ ...f, enforceFullscreen: e.target.checked }))}
                    />
                    <span>Enforce Fullscreen Mode</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-[#3760F8]"
                      checked={form.blockRightClick}
                      onChange={(e) => setForm((f) => ({ ...f, blockRightClick: e.target.checked }))}
                    />
                    <span>Block Right Click &amp; Inspect</span>
                  </label>
                </div>

                <div className="pt-2 max-w-xs">
                  <Input
                    label="Max Violation Limit Before Flag"
                    type="number"
                    min="1"
                    max="50"
                    value={String(form.maxViolations)}
                    onChange={(e) => setForm((f) => ({ ...f, maxViolations: Number(e.target.value) }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard Settings */}
          <div className="border border-slate-200 rounded-2xl p-4 space-y-2.5 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-800">Leaderboard Configuration</p>
            <div className="flex flex-wrap gap-4 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#3760F8]"
                  checked={form.leaderboardEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, leaderboardEnabled: e.target.checked }))}
                />
                <span>Visible to Candidates</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-[#3760F8]"
                  checked={form.leaderboardAnonymous}
                  onChange={(e) => setForm((f) => ({ ...f, leaderboardAnonymous: e.target.checked }))}
                />
                <span>Anonymize Candidate Names</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!form.title.trim()}
            >
              Create Contest
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Contest Modal */}
      <Modal open={!!editContest} onClose={() => setEditContest(null)} title="Edit Contest Settings" size="lg">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Input
            label="Contest Title *"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Window"
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
            <Input
              label="End Window"
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Duration (Minutes)"
              type="number"
              min="5"
              value={String(form.durationMinutes)}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
            />
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Evaluation Rubric</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none min-h-[44px]"
                value={form.rubricId}
                onChange={(e) => setForm((f) => ({ ...f, rubricId: e.target.value }))}
              >
                <option value="">Default Standard Evaluation</option>
                {rubrics.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setEditContest(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => editContest && updateMutation.mutate({ id: editContest._id })}
              loading={updateMutation.isPending}
              disabled={!form.title.trim()}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Adjust Timing Modal */}
      <Modal open={!!timingModal} onClose={() => setTimingModal(null)} title={`Extend Time &bull; ${timingModal?.title || ''}`}>
        <div className="space-y-4">
          <Input
            label="Extension Minutes"
            type="number"
            min="1"
            placeholder="e.g. 15"
            value={extensionMin}
            onChange={(e) => setExtensionMin(e.target.value)}
          />
          <Input
            label="Reason for Extension"
            placeholder="e.g. Platform network delay resolution"
            value={timingReason}
            onChange={(e) => setTimingReason(e.target.value)}
          />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setTimingModal(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                timingModal &&
                timingMutation.mutate({
                  id: timingModal.id,
                  ext: Number(extensionMin),
                  reason: timingReason,
                })
              }
              loading={timingMutation.isPending}
              disabled={!extensionMin || !timingReason}
            >
              Apply Extension
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Contest Confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Delete Contest"
        message="Are you sure you want to delete this contest? All question associations, participant rosters, and attempts will be permanently erased."
        confirmLabel="Delete Contest"
        danger
      />
    </div>
  );
}
