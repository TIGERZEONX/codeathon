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

const statusColor: Record<string, 'gray' | 'green' | 'blue'> = {
  absent: 'gray',
  present: 'green',
  completed: 'blue',
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
    { key: 'rollNumber', header: 'Roll No.' },
    { key: 'participantName', header: 'Name' },
    { key: 'teamName', header: 'Team', render: (r: AttendanceRecord) => r.teamName || '—' },
    {
      key: 'status', header: 'Status',
      render: (r: AttendanceRecord) => <Badge color={statusColor[r.status] || 'gray'}>{r.status}</Badge>,
    },
    { key: 'startedAt', header: 'Started', render: (r: AttendanceRecord) => r.startedAt ? new Date(r.startedAt).toLocaleTimeString() : '—' },
    { key: 'submittedAt', header: 'Submitted', render: (r: AttendanceRecord) => r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : '—' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/contests" className="text-blue-600 hover:underline text-sm">← Contests</Link>
        <h1 className="text-2xl font-bold text-gray-900">Attendance — {contest?.title || contestId}</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Registered</div>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.present}</div>
          <div className="text-sm text-green-600">Present</div>
        </div>
        <div className="bg-white rounded-xl border border-blue-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.completed}</div>
          <div className="text-sm text-blue-600">Submitted</div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input placeholder="Search by name, roll no, team..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="absent">Absent</option>
          <option value="present">Present</option>
          <option value="completed">Completed</option>
        </select>
        <Button variant="outline" onClick={handleExport}>Export CSV</Button>
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
        <Table columns={columns} data={filtered} rowKey={(r) => r._id} emptyMessage="No attendance records found." />
      )}
    </div>
  );
}
