'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi, contestsApi } from '@/lib/api';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { ArrowLeft, Download, UserCheck, Users, CheckCircle2, Search } from 'lucide-react';

interface AttendanceRecord {
  _id: string;
  participantId: string;
  participantName: string;
  rollNumber: string;
  teamName?: string;
  status: 'absent' | 'present' | 'completed';
  startedAt?: string;
  submittedAt?: string;
}

const statusColor: Record<string, 'gray' | 'green' | 'primary'> = {
  absent: 'gray',
  present: 'green',
  completed: 'primary',
};

export default function AttendancePage() {
  const { contestId } = useParams<{ contestId: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: contestData } = useQuery({ queryKey: ['contest', contestId], queryFn: () => contestsApi.get(contestId) });
  const contest = contestData as { title?: string } | null;

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', contestId, statusFilter],
    queryFn: () => attendanceApi.getByContest(contestId, { status: statusFilter || undefined }),
  });

  const records: AttendanceRecord[] = (data as AttendanceRecord[]) || [];

  const filtered = records.filter((r) =>
    !search ||
    r.participantName.toLowerCase().includes(search.toLowerCase()) ||
    r.rollNumber.toLowerCase().includes(search.toLowerCase()) ||
    (r.teamName || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = async () => {
    try {
      const blob = await attendanceApi.exportCsv(contestId);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${contestId}.csv`;
      a.click();
    } catch {}
  };

  const stats = {
    total: records.length,
    present: records.filter((r) => r.status !== 'absent').length,
    completed: records.filter((r) => r.status === 'completed').length,
  };

  const columns = [
    {
      key: 'rollNumber',
      header: 'Roll No.',
      render: (r: AttendanceRecord) => (
        <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
          {r.rollNumber}
        </span>
      ),
    },
    {
      key: 'participantName',
      header: 'Candidate Name',
      render: (r: AttendanceRecord) => (
        <span className="text-xs font-semibold text-slate-900 tracking-tight">{r.participantName}</span>
      ),
    },
    {
      key: 'teamName',
      header: 'Team Allocation',
      render: (r: AttendanceRecord) => (
        r.teamName ? <Badge color="neon">{r.teamName}</Badge> : <span className="text-slate-400 text-xs">Individual</span>
      ),
    },
    {
      key: 'status',
      header: 'Attendance Status',
      render: (r: AttendanceRecord) => (
        <Badge color={statusColor[r.status] || 'gray'} dot>
          {r.status === 'completed' ? 'Submitted' : r.status === 'present' ? 'Testing (Active)' : 'Absent'}
        </Badge>
      ),
    },
    {
      key: 'startedAt',
      header: 'Login Check-in',
      render: (r: AttendanceRecord) => (
        <span className="text-xs text-slate-500 font-mono">
          {r.startedAt ? new Date(r.startedAt).toLocaleTimeString() : '—'}
        </span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Final Turn-in',
      render: (r: AttendanceRecord) => (
        <span className="text-xs text-slate-500 font-mono">
          {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/contests"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#3760F8] hover:text-[#254EDB] px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Contests</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Attendance Roster</h1>
            <p className="text-xs text-slate-500 mt-0.5">{contest?.title || 'Contest'} &bull; Real-time participant check-ins</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleExport} leftIcon={<Download className="w-3.5 h-3.5 text-slate-500" />}>
          Export Attendance CSV
        </Button>
      </div>

      {/* Roster Overview Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase">Enrolled</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">{stats.total}</div>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-700 uppercase">Attending</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono">{stats.present}</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#C7D2FE] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#3760F8] uppercase">Submitted</span>
            <CheckCircle2 className="w-4 h-4 text-[#3760F8]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#3760F8] font-mono">{stats.completed}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input placeholder="Search by name, roll no, or team..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="border border-slate-200 bg-white rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none shadow-2xs"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Attendance Statuses</option>
          <option value="absent">Absent</option>
          <option value="present">Present (In Progress)</option>
          <option value="completed">Completed &amp; Submitted</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <Table columns={columns} data={filtered} rowKey={(r) => r._id} emptyMessage="No attendance records found." />
      )}
    </div>
  );
}
