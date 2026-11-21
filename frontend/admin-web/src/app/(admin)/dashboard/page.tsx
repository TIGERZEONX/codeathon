'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, contestsApi } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Users,
  Play,
  UserCheck,
  CheckCircle2,
  Award,
  Trophy,
  Download,
  BarChart3,
  ShieldAlert,
  Code2,
  Sparkles,
} from 'lucide-react';

interface DashboardStats {
  registered: number;
  started: number;
  attending: number;
  submitted: number;
  avgScore: number | null;
  highestScore: number | null;
  scoreDistribution?: { range: string; count: number }[];
  topPerformers?: { name: string; score: number; rank: number }[];
  languageUsage?: { language: string; count: number }[];
  violationSummary?: { type: string; count: number }[];
}

interface Contest { _id: string; title: string }

function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'blue',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent?: 'blue' | 'lime' | 'emerald' | 'amber';
}) {
  const accentStyles = {
    blue: 'border-slate-200/80 hover:border-[#3760F8]/40 bg-white text-[#3760F8]',
    lime: 'border-slate-200/80 hover:border-[#D3FE4F] bg-white text-slate-900',
    emerald: 'border-slate-200/80 hover:border-emerald-400 bg-white text-emerald-600',
    amber: 'border-slate-200/80 hover:border-amber-400 bg-white text-amber-600',
  };

  return (
    <div className={`rounded-2xl border p-5 bg-white shadow-xs transition-all hover:shadow-card ${accentStyles[accent]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [selectedContest, setSelectedContest] = useState('');

  const { data: contestsData } = useQuery({
    queryKey: ['contests-list'],
    queryFn: () => contestsApi.list({ limit: 50 }),
  });
  const contests: Contest[] = (contestsData as { data?: Contest[] })?.data || [];

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['analytics-dashboard', selectedContest],
    queryFn: () => analyticsApi.getDashboard(selectedContest || undefined),
  });
  const stats = statsData as DashboardStats | null;

  const handleExport = async () => {
    try {
      const blob = await analyticsApi.exportCsv(selectedContest || undefined);
      const url = URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analytics.csv';
      a.click();
    } catch {}
  };

  return (
    <div className="p-6 sm:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Telemetry</h1>
          <p className="text-xs text-slate-500 mt-1">Live analytics, cohort metrics, and proctoring telemetry</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="border border-slate-200 bg-white rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3760F8]/30 shadow-2xs"
            value={selectedContest}
            onChange={(e) => setSelectedContest(e.target.value)}
          >
            <option value="">All Active Contests</option>
            {contests.map((c) => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            leftIcon={<Download className="w-3.5 h-3.5 text-slate-500" />}
          >
            Export Telemetry
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard label="Registered" value={stats?.registered ?? 0} icon={Users} accent="blue" />
            <StatCard label="Started" value={stats?.started ?? 0} icon={Play} accent="amber" />
            <StatCard label="Active Roster" value={stats?.attending ?? 0} icon={UserCheck} accent="lime" />
            <StatCard label="Submitted" value={stats?.submitted ?? 0} icon={CheckCircle2} accent="emerald" />
            <StatCard label="Avg Score" value={stats?.avgScore != null ? stats.avgScore.toFixed(1) : '—'} icon={Award} accent="blue" />
            <StatCard label="Top Score" value={stats?.highestScore ?? '—'} icon={Trophy} accent="lime" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score Distribution */}
            {stats?.scoreDistribution && stats.scoreDistribution.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-[#3760F8]" />
                  <h2 className="font-bold text-slate-900 text-sm tracking-tight">Score Distribution Cohort</h2>
                </div>
                <div className="space-y-3">
                  {stats.scoreDistribution.map((d, i) => {
                    const max = Math.max(...stats.scoreDistribution!.map((x) => x.count), 1);
                    const pct = Math.round((d.count / max) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="w-16 font-mono text-slate-500 text-[11px] font-medium">{d.range}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-[#3760F8] h-4 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 font-mono font-bold text-slate-700 text-right">{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Performers */}
            {stats?.topPerformers && stats.topPerformers.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#3760F8]" />
                    <h2 className="font-bold text-slate-900 text-sm tracking-tight">Top Performers</h2>
                  </div>
                  <span className="text-[11px] font-semibold text-[#3760F8] bg-[#EEF2FF] px-2.5 py-0.5 rounded-full">
                    Rankings
                  </span>
                </div>
                <div className="space-y-2">
                  {stats.topPerformers.slice(0, 7).map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                        i === 0
                          ? 'bg-[#D3FE4F] text-[#0B0F19]'
                          : i < 3
                          ? 'bg-[#3760F8] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {p.rank}
                      </span>
                      <span className="flex-1 text-xs font-semibold text-slate-800 tracking-tight">{p.name}</span>
                      <span className="font-mono font-extrabold text-[#3760F8] text-xs">{p.score} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Language Usage Breakdown */}
            {stats?.languageUsage && stats.languageUsage.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <Code2 className="w-4 h-4 text-[#3760F8]" />
                  <h2 className="font-bold text-slate-900 text-sm tracking-tight">Language Distribution</h2>
                </div>
                <div className="space-y-3">
                  {stats.languageUsage.map((l, i) => {
                    const total = stats.languageUsage!.reduce((s, x) => s + x.count, 0) || 1;
                    const pct = Math.round((l.count / total) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="w-24 text-slate-700 font-semibold truncate">{l.language}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-3.5 overflow-hidden">
                          <div className="bg-[#D3FE4F] h-3.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-slate-500 font-mono text-[11px] w-12 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Proctoring Violations Summary */}
            {stats?.violationSummary && stats.violationSummary.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <h2 className="font-bold text-slate-900 text-sm tracking-tight">Proctoring Violations Logged</h2>
                </div>
                <div className="space-y-2">
                  {stats.violationSummary.map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                      <span className="text-xs font-medium text-slate-700 capitalize">{v.type.replace(/_/g, ' ')}</span>
                      <Badge color="red">{v.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!stats && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center text-slate-400">
              No contest telemetry available yet. Start a contest to see live statistics.
            </div>
          )}
        </>
      )}
    </div>
  );
}
