'use client';
import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { ScrollText, Clock, User, Shield } from 'lucide-react';

interface AuditLog {
  _id: string;
  id?: string;
  actorName?: string;
  userName?: string;
  actorEmail?: string;
  userEmail?: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: any;
  createdAt: string;
  ipAddress?: string;
}

const actionColor = (action: string = ''): 'red' | 'green' | 'primary' | 'yellow' | 'gray' => {
  const act = action.toLowerCase();
  if (act.includes('delete') || act.includes('revoke')) return 'red';
  if (act.includes('create') || act.includes('seed')) return 'green';
  if (act.includes('update') || act.includes('edit')) return 'yellow';
  if (act.includes('login') || act.includes('logout')) return 'primary';
  return 'gray';
};

export default function AuditLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => auditLogsApi.list(200),
    refetchInterval: 30000,
  });

  const logs: AuditLog[] = Array.isArray(data) ? data : (data as any)?.data || [];

  const columns = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      render: (l: AuditLog) => (
        <span className="text-[11px] font-mono text-slate-500 font-medium">
          {l.createdAt ? new Date(l.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' }) : '—'}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor & Session',
      render: (l: AuditLog) => (
        <div>
          <span className="text-xs font-semibold text-slate-900 tracking-tight block">
            {l.actorName || l.userName || 'System Admin'}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {l.actorEmail || l.userEmail || l.userId || ''}
          </span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Audit Action',
      render: (l: AuditLog) => (
        <Badge color={actionColor(l.action)} dot>
          {(l.action || '').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'resource',
      header: 'Target Resource',
      render: (l: AuditLog) => (
        <span className="text-xs font-semibold text-slate-700">
          {l.resource || (l.action ? l.action.split('_')[0] : 'System')}
          {l.resourceId && (
            <span className="ml-1.5 text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
              {String(l.resourceId).slice(-6)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Activity Details',
      render: (l: AuditLog) => {
        let detailsStr = '—';
        if (typeof l.details === 'string') {
          detailsStr = l.details;
        } else if (typeof l.details === 'object' && l.details !== null) {
          detailsStr = Object.entries(l.details)
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(' | ');
        }
        return (
          <span className="text-xs text-slate-600 truncate max-w-sm block font-sans" title={detailsStr}>
            {detailsStr || '—'}
          </span>
        );
      },
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Trail &amp; Governance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable record of security mutations, logins, and contest administrative actions
          </p>
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
        rowKey={(l) => l._id || l.id || Math.random().toString()}
        emptyMessage="No audit log activity entries recorded yet."
      />
    </div>
  );
}
