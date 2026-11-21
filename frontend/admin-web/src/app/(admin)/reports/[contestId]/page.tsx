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
import { ArrowLeft, Download, RotateCcw, SlidersHorizontal, AlertCircle, Save } from 'lucide-react';

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
    <div className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <div className="flex items-center gap-4">
        <span className="w-20 text-xs text-slate-400 font-mono text-right">{real}</span>
        <span className="text-slate-300 text-xs">&rarr;</span>
        <input
          type="number"
          className={`w-28 border rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none transition-all ${
            overridden && display !== real
              ? 'border-amber-300 bg-amber-50/60 text-amber-950'
              : 'border-slate-200 bg-white text-slate-900'
          }`}
          value={display}
          onChange={(e) => onChange(Number(e.target.value))}
          step="any"
        />
        <div className="w-24 text-right">
          {display !== real && <Badge color="yellow">Adjusted</Badge>}
        </div>
      </div>
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
    { key: 'registered', label: 'Registered Candidates' },
    { key: 'started', label: 'Attended Tests' },
    { key: 'submitted', label: 'Completed Submissions' },
    { key: 'avgScore', label: 'Cohort Average Score' },
    { key: 'highestScore', label: 'Top Benchmark Score' },
    { key: 'passRate', label: 'Pass Rate Percentage (%)' },
  ];

  const hasChanges = Object.keys(overrides).length > 0;

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Presentation Reports</h1>
              {report?.overridden && (
                <Badge color="yellow" dot>
                  Override Layer Enabled
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{contest?.title || 'Contest'} &bull; Presentation statistics adjustment module</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleExport} leftIcon={<Download className="w-3.5 h-3.5 text-slate-500" />}>
            Export Report CSV
          </Button>
          {report?.overridden && (
            <Button variant="danger" size="sm" onClick={() => setShowReset(true)} leftIcon={<RotateCcw className="w-3.5 h-3.5 text-white" />}>
              Reset to Actual
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#3760F8]" />
                <h2 className="font-bold text-slate-900 text-sm tracking-tight">Report Figures Configuration</h2>
              </div>
              <div className="flex gap-8 text-[11px] font-semibold text-slate-400 uppercase tracking-wider pr-2">
                <span>Verified Actual</span>
                <span>Display Presentation</span>
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
            {!report && <p className="text-center text-slate-400 text-xs py-10">No report metrics available for this contest.</p>}
          </div>

          {report?.footerLabel && (
            <div className={`rounded-2xl px-5 py-3 text-xs font-medium border ${
              report.overridden
                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                : 'bg-white border-slate-200 text-slate-600'
            }`}>
              <span>{report.footerLabel}</span>
              {report.note && <span className="ml-2 font-semibold">({report.note})</span>}
            </div>
          )}

          {hasChanges && (
            <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#3760F8] text-xs font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>You have unsaved presentation override adjustments</span>
              </div>
              <input
                className="w-full border border-slate-200 bg-white rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-[#3760F8]/30 focus:outline-none"
                placeholder="Audit notation explaining this presentation adjustment..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex gap-2.5">
                <Button variant="outline" size="sm" onClick={() => setOverrides({})}>
                  Discard
                </Button>
                <Button size="sm" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} leftIcon={<Save className="w-3.5 h-3.5" />}>
                  Save Overrides
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={() => resetMutation.mutate()}
        loading={resetMutation.isPending}
        title="Reset Override Layer"
        message="This will permanently delete all custom display adjustments and restore exact authentic database numbers. Confirm?"
        confirmLabel="Reset to Actual"
        danger
      />
    </div>
  );
}
