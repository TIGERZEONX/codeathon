'use client';
import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

interface AuditLog {
  _id: string;
  actorName?: string;
  actorEmail?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: string;
  createdAt: string;
  ipAddress?: string;
}

const actionColor = (action: string): 'red' | 'green' | 'blue' | 'yellow' | 'gray' => {
  if (action.includes('delete') || action.includes('revoke')) return 'red';
  if (action.includes('create') || action.includes('seed')) return 'green';
  if (action.includes('update') || action.includes('edit')) return 'yellow';
  if (action.includes('login') || action.includes('logout')) return 'blue';
  return 'gray';
};

export default function AuditLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => auditLogsApi.list(200),
    refetchInterval: 30000,
  });

  const logs: AuditLog[] = (data as AuditLog[]) || [];

  const columns = [
    {
      key: 'createdAt', header: 'Time',
      render: (l: AuditLog) => (
        <span className="text-xs font-mono text-gray-500">{new Date(l.createdAt).toLocaleString()}</span>
      ),
    },
    {
      key: 'actor', header: 'User',
      render: (l: AuditLog) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{l.actorName || '—'}</div>
          <div className="text-xs text-gray-400">{l.actorEmail || ''}</div>
        </div>
      ),
    },
    {
      key: 'action', header: 'Action',
      render: (l: AuditLog) => (
        <Badge color={actionColor(l.action)}>{l.action}</Badge>
      ),
    },
    {
      key: 'resource', header: 'Resource',
      render: (l: AuditLog) => (
        <span className="text-sm text-gray-600">
          {l.resource || '—'}
          {l.resourceId && <span className="ml-1 text-xs text-gray-400 font-mono">{l.resourceId.slice(-6)}</span>}
        </span>
      ),
    },
    {
      key: 'details', header: 'Details',
      render: (l: AuditLog) => (
        <span className="text-xs text-gray-500 truncate max-w-xs block">{l.details || '—'}</span>
      ),
    },
    {
      key: 'ipAddress', header: 'IP',
      render: (l: AuditLog) => (
        <span className="text-xs font-mono text-gray-400">{l.ipAddress || '—'}</span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <span className="text-xs text-gray-500">Last 200 events · Auto-refresh 30s</span>
      </div>

      <Table
        columns={columns}
        data={logs}
        loading={isLoading}
        rowKey={(l) => l._id}
        emptyMessage="No audit log entries found."
      />
    </div>
  );
}
