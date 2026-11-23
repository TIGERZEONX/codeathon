'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { contestsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Eye,
  Clock,
  Radio,
  AlertTriangle,
  ChevronRight,
  Activity,
  Users,
} from 'lucide-react';

interface Contest {
  _id: string;
  id?: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  proctorConfig?: {
    enabled?: boolean;
    maxViolations?: number;
  };
}

export default function ProctoringHubPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['proctoring-contests', search],
    queryFn: () => contestsApi.list({ search, limit: 50 }),
  });

  const contests: Contest[] = (data as { data?: Contest[] })?.data || (Array.isArray(data) ? data : []);

  const columns = [
    {
      key: 'title',
      header: 'Assessment Contest',
      render: (c: Contest) => (
        <div>
          <span className="font-bold text-slate-900 text-xs tracking-tight block">{c.title}</span>
          <span className="text-[11px] font-mono text-slate-400">ID: {(c._id || c.id || '').slice(-6)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Exam State',
      render: (c: Contest) => {
        const isLive = c.status === 'live';
        return (
          <Badge color={isLive ? 'green' : c.status === 'scheduled' ? 'blue' : 'gray'}>
            {c.status.toUpperCase()}
          </Badge>
        );
      },
    },
    {
      key: 'proctorStatus',
      header: 'Proctoring Mode',
      render: (c: Contest) => {
        const enabled = c.proctorConfig?.enabled !== false;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              enabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            {enabled ? 'Proctoring Active' : 'Standard'}
          </span>
        );
      },
    },
    {
      key: 'timing',
      header: 'Scheduled Window',
      render: (c: Contest) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <p>Duration: {c.durationMinutes} mins</p>
          <p className="text-[11px] text-slate-400">
            {new Date(c.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Live Action',
      render: (c: Contest) => {
        const targetId = c._id || c.id;
        return (
          <Link href={`/proctoring/${targetId}`}>
            <Button size="sm" leftIcon={<Radio className="w-3.5 h-3.5 text-white" />}>
              Open Live Monitor
            </Button>
          </Link>
        );
      },
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Proctoring Monitor</h1>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time candidate telemetry, violation logs (tab switches, screen defocus, clipboard actions), and active exam room supervision
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="max-w-md">
        <Input
          placeholder="Filter contests by title or session ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Main Table */}
      <Table
        columns={columns}
        data={contests}
        loading={isLoading}
        rowKey={(c) => c._id || c.id || ''}
        emptyMessage="No contests available for proctoring monitoring."
      />
    </div>
  );
}
