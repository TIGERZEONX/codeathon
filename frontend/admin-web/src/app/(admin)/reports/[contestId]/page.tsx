'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi, contestsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import Link from 'next/link';

interface ReportStats {
  registered: number;
  started: number;
  submitted: number;
  avgScore: number;
  highestScore: number;
  passRate: number;
}

interface Report {
  realStats: ReportStats;
  displayStats: ReportStats;
  overridden: boolean;
  footerLabel?: string;
  note?: string;
}

function StatRow({
  label, real, display, overridden, onChange,
}: {
  label: string; real: number; display: number; overridden: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-2 border-b last:border-0">
      <span className="w-32 text-sm text-gray-600">{label}</span>
      <span className="w-20 text-sm text-gray-800 font-mono text-right">{real}</span>
      <span className="text-gray-400 mx-2">→</span>
      <input
        type="number"
        className={`w-24 border rounded-lg px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none ${overridden && display !== real ? 'border-yellow-400 bg-yellow-50' : 'border-gray-300'}`}
        value={display}
        onChange={(e) => onChange(Number(e.target.value))}
        step="any"
      />
      {display !== real && <Badge color="yellow">Overridden</Badge>}
    </div>
  );
}

export default function ReportsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const qc = useQueryClient();
  const [overrides, setOverrides] = useState<Partial<ReportStats>>({});
  const [note, setNote] = useState('');
  const [showReset, setShowReset] = useState(false);

  const { data: contestData } = useQuery({ queryKey: ['contest', contestId], queryFn: () => contestsApi.get(contestId) });
  const contest = contestData as { title?: string } | null;

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report', contestId],
    queryFn: () => reportsApi.get(contestId),
  });
  const report = reportData as Report | null;

  const displayStats: ReportStats = report
    ? { ...report.displayStats, ...overrides }
    : { registered: 0, started: 0, submitted: 0, avgScore: 0, highestScore: 0, passRate: 0 };

  const saveMutation = useMutation({
    mutationFn: () => reportsApi.updateOverrides(contestId, overrides, note),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['report', contestId] }); setOverrides({}); setNote(''); },
  });

  const resetMutation = useMutation({
    mutationFn: () => reportsApi.reset(contestId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['report', contestId] }); setOverrides({}); setShowReset(false); },
  });

  const handleExport = async () => {
    try {
      const blob = await reportsApi.exportCsv(contestId);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${contestId}.csv`;
      a.click();
    } catch {}
  };

  const statFields: { key: keyof ReportStats; label: string }[] = [
    { key: 'registered', label: 'Registered' },
    { key: 'started', label: 'Started' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'avgScore', label: 'Avg Score' },
    { key: 'highestScore', label: 'Highest Score' },
    { key: 'passRate', label: 'Pass Rate %' },
  ];

  const hasChanges = Object.keys(overrides).length > 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/contests" className="text-blue-600 hover:underline text-sm">← Contests</Link>
        <h1 className="text-2xl font-bold text-gray-900">Reports — {contest?.title || contestId}</h1>
        {report?.overridden && <Badge color="yellow">⚠ Contains Overrides</Badge>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Statistics</h2>
              <div className="flex gap-2 text-xs text-gray-500">
                <span className="w-20 text-right">Actual</span>
                <span className="mx-6"></span>
                <span className="w-24 text-center">Display</span>
              </div>
            </div>
            {report && statFields.map(({ key, label }) => (
              <StatRow
                key={key}
                label={label}
                real={report.realStats[key]}
                display={overrides[key] !== undefined ? overrides[key]! : report.displayStats[key]}
                overridden={report.overridden}
                onChange={(v) => setOverrides((o) => ({ ...o, [key]: v }))}
              />
            ))}
            {!report && <p className="text-center text-gray-400 py-8">No report data available.</p>}
          </div>

          {report?.footerLabel && (
            <div className={`rounded-lg px-4 py-2 text-sm ${report.overridden ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-gray-50 text-gray-600'}`}>
              {report.footerLabel}
              {report.note && <span className="ml-2 text-xs opacity-75">({report.note})</span>}
            </div>
          )}

          {hasChanges && (
            <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
              <p className="text-sm font-medium text-blue-800">Unsaved override changes</p>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Add a note explaining these adjustments..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setOverrides({})}>Discard Changes</Button>
                <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>Save Overrides</Button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleExport}>Export CSV</Button>
            {report?.overridden && (
              <Button variant="danger" onClick={() => setShowReset(true)}>Reset to Actual</Button>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={() => resetMutation.mutate()}
        loading={resetMutation.isPending}
        title="Reset Overrides"
        message="This will remove all display overrides and show actual figures. Continue?"
        confirmLabel="Reset"
        danger
      />
    </div>
  );
}
