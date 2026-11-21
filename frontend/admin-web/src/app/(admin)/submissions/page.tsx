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
    { key: 'rollNumber', header: 'Roll No.' },
    { key: 'participantName', header: 'Name' },
    { key: 'contestTitle', header: 'Contest' },
    {
      key: 'status', header: 'Status',
      render: (s: Submission) => <Badge color={s.status === 'submitted' ? 'green' : 'blue'}>{s.status}</Badge>,
    },
    { key: 'totalScore', header: 'Score', render: (s: Submission) => s.totalScore ?? '—' },
    {
      key: 'submittedAt', header: 'Submitted At',
      render: (s: Submission) => s.submittedAt ? new Date(s.submittedAt).toLocaleString() : '—',
    },
    {
      key: 'actions', header: 'Actions',
      render: (s: Submission) => superAdmin ? (
        <Button size="sm" variant="danger" onClick={() => setRevokeModal(s)}>Revoke</Button>
      ) : <span className="text-xs text-gray-400">Super Admin only</span>,
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
        {!superAdmin && (
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg">
            Revoke requires Super Admin access
          </div>
        )}
      </div>

      <Table columns={columns} data={submissions} loading={isLoading} rowKey={(s) => s._id} emptyMessage="No submitted attempts found." />

      <Modal open={!!revokeModal} onClose={() => setRevokeModal(null)} title="Revoke Submission" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              Revoking will unlock <strong>{revokeModal?.participantName}&apos;s</strong> submission and allow them to re-attempt.
            </p>
          </div>
          <Input
            label="Reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Technical issue, system error"
          />
          <Input
            label="Extension Minutes (optional)"
            type="number"
            value={extensionMin}
            onChange={(e) => setExtensionMin(e.target.value)}
            placeholder="e.g. 15"
            helperText="Extra time added to their attempt"
          />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setRevokeModal(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => revokeMutation.mutate()}
              loading={revokeMutation.isPending}
              disabled={!reason.trim()}
            >
              Revoke
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
