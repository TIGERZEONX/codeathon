'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { submissionsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { ShieldCheck, RotateCcw, AlertTriangle, Lock } from 'lucide-react';

interface Submission {
  _id: string;
  participantName: string;
  rollNumber: string;
  contestTitle: string;
  status: string;
  totalScore?: number;
  submittedAt?: string;
  attemptId: string;
}

export default function SubmissionsPage() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAdminAuthStore();
  const superAdmin = isSuperAdmin();

  const [revokeModal, setRevokeModal] = useState<Submission | null>(null);
  const [reason, setReason] = useState('');
  const [extensionMin, setExtensionMin] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['submissions'],
    queryFn: () => submissionsApi.getLocked(),
  });
  const submissions: Submission[] = (data as Submission[]) || [];

  const revokeMutation = useMutation({
    mutationFn: () =>
      submissionsApi.revoke({
        attemptId: revokeModal!.attemptId,
        reason,
        extensionMinutes: extensionMin ? Number(extensionMin) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] });
      setRevokeModal(null);
      setReason('');
      setExtensionMin('');
    },
  });

  const columns = [
    {
      key: 'rollNumber',
      header: 'Roll No.',
      render: (s: Submission) => (
        <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
          {s.rollNumber}
        </span>
      ),
    },
    {
      key: 'participantName',
      header: 'Candidate Name',
      render: (s: Submission) => (
        <span className="text-xs font-semibold text-slate-900 tracking-tight">{s.participantName}</span>
      ),
    },
    {
      key: 'contestTitle',
      header: 'Contest Challenge',
      render: (s: Submission) => (
        <span className="text-xs text-slate-700 font-medium">{s.contestTitle}</span>
      ),
    },
    {
      key: 'status',
      header: 'Lock Status',
      render: (s: Submission) => (
        <Badge color={s.status === 'submitted' ? 'green' : 'primary'} dot>
          {s.status}
        </Badge>
      ),
    },
    {
      key: 'totalScore',
      header: 'Score',
      render: (s: Submission) => (
        <span className="text-xs font-mono font-extrabold text-[#3760F8]">{s.totalScore ?? '—'} pts</span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Locked Timestamp',
      render: (s: Submission) => (
        <span className="text-xs font-mono text-slate-500">
          {s.submittedAt ? new Date(s.submittedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Authorization',
      render: (s: Submission) =>
        superAdmin ? (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setRevokeModal(s)}
            leftIcon={<RotateCcw className="w-3 h-3 text-white" />}
          >
            Revoke Lock
          </Button>
        ) : (
          <span className="text-xs text-slate-400 font-medium">Requires Super Admin</span>
        ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Locked Submissions Control</h1>
          <p className="text-xs text-slate-500 mt-0.5">Review completed submissions and grant emergency re-attempt overrides</p>
        </div>
        {!superAdmin && (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Submission unlock requires Super Admin role</span>
          </div>
        )}
      </div>

      <Table columns={columns} data={submissions} loading={isLoading} rowKey={(s) => s._id} emptyMessage="No locked submissions found." />

      <Modal open={!!revokeModal} onClose={() => setRevokeModal(null)} title="Revoke Candidate Submission Lock" size="sm">
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <p className="text-xs text-rose-900 leading-relaxed">
              Unlocking will convert <strong>{revokeModal?.participantName}&apos;s</strong> attempt back to <em>In Progress</em> and allow them to modify responses.
            </p>
          </div>
          <Input
            label="Audit Justification Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Browser crash verified by proctor"
            required
          />
          <Input
            label="Additional Time Extension (Minutes)"
            type="number"
            value={extensionMin}
            onChange={(e) => setExtensionMin(e.target.value)}
            placeholder="e.g. 15"
            helperText="Extra time added to the candidate's active countdown timer."
          />
          <div className="flex gap-2.5 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setRevokeModal(null)}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => revokeMutation.mutate()}
              loading={revokeMutation.isPending}
              disabled={!reason.trim()}
            >
              Confirm Unlock
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
