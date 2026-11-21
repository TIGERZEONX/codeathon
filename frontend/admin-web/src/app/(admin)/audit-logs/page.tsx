'use client';
import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { ScrollText, Clock, User, Shield } from 'lucide-react';

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

const actionColor = (action: string): 'red' | 'green' | 'primary' | 'yellow' | 'gray' => {
  if (action.includes('delete') || action.includes('revoke')) return 'red';
  if (action.includes('create') || action.includes('seed')) return 'green';
  if (action.includes('update') || action.includes('edit')) return 'yellow';
  if (action.includes('login') || action.includes('logout')) return 'primary';
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
      key: 'createdAt',
      header: 'Timestamp',
      render: (l: AuditLog) => (
        <span className="text-[11px] font-mono text-slate-500 font-medium">
          {new Date(l.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor & Session',
      render: (l: AuditLog) => (
        <div>
          <span className="text-xs font-semibold text-slate-900 tracking-tight block">
            {l.actorName || 'System'}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">{l.actorEmail || ''}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Audit Action',
      render: (l: AuditLog) => (
        <Badge color={actionColor(l.action)} dot>
          {l.action.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'resource',
      header: 'Target Resource',
      render: (l: AuditLog) => (
        <span className="text-xs font-semibold text-slate-700">
          {l.resource || '—'}
          {l.resourceId && (
            <span className="ml-1.5 text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              {l.resourceId.slice(-6)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Activity Details',
      render: (l: AuditLog) => (
        <span className="text-xs text-slate-500 truncate max-w-sm block font-sans">
          {l.details || '—'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'Network IP',
      render: (l: AuditLog) => (
        <span className="text-[11px] font-mono text-slate-400 font-medium">
          {l.ipAddress || '127.0.0.1'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Trail &amp; Governance</h1>
          <p className="text-xs text-slate-500 mt-0.5">Immutable record of security mutations, logins, and contest administrative actions</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Polled 30s</span>
        </div>
      </div>

      <Table
        columns={columns}
        data={logs}
        loading={isLoading}
        rowKey={(l) => l._id}
        emptyMessage="No audit log activity entries recorded yet."
      />
    </div>
  );
}
