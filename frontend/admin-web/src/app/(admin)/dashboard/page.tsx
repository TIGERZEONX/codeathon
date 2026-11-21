'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, contestsApi } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';

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

function StatCard({ label, value, color = 'blue' }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] || colors.blue}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-75">{label}</div>
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-3">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedContest}
            onChange={(e) => setSelectedContest(e.target.value)}
          >
            <option value="">All Contests</option>
            {contests.map((c) => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard label="Registered" value={stats?.registered ?? 0} color="blue" />
            <StatCard label="Started" value={stats?.started ?? 0} color="yellow" />
            <StatCard label="Attending" value={stats?.attending ?? 0} color="green" />
            <StatCard label="Submitted" value={stats?.submitted ?? 0} color="purple" />
            <StatCard label="Avg Score" value={stats?.avgScore != null ? stats.avgScore.toFixed(1) : '—'} color="blue" />
            <StatCard label="Highest Score" value={stats?.highestScore ?? '—'} color="green" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score Distribution */}
            {stats?.scoreDistribution && stats.scoreDistribution.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Score Distribution</h2>
                <div className="space-y-2">
                  {stats.scoreDistribution.map((d, i) => {
                    const max = Math.max(...stats.scoreDistribution!.map((x) => x.count), 1);
                    const pct = Math.round((d.count / max) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-16 text-gray-500 text-xs">{d.range}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                          <div
                            className="bg-blue-500 h-5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-gray-700 text-xs text-right">{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Performers */}
            {stats?.topPerformers && stats.topPerformers.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Top Performers</h2>
                <div className="space-y-2">
                  {stats.topPerformers.slice(0, 8).map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-600'}`}>
                        {p.rank}
                      </span>
                      <span className="flex-1 text-sm text-gray-800">{p.name}</span>
                      <span className="font-bold text-blue-600 text-sm">{p.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Language Usage */}
            {stats?.languageUsage && stats.languageUsage.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Language Usage</h2>
                <div className="space-y-2">
                  {stats.languageUsage.map((l, i) => {
                    const total = stats.languageUsage!.reduce((s, x) => s + x.count, 0) || 1;
                    const pct = Math.round((l.count / total) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="w-24 text-gray-700 font-medium">{l.language}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4">
                          <div className="bg-purple-500 h-4 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-gray-500 text-xs w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Violations */}
            {stats?.violationSummary && stats.violationSummary.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-800 mb-4">Proctoring Violations</h2>
                <div className="space-y-2">
                  {stats.violationSummary.map((v, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <span className="text-sm text-gray-700 capitalize">{v.type.replace(/_/g, ' ')}</span>
                      <Badge color="red">{v.count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!stats && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              No analytics data available yet. Run a contest to see statistics here.
            </div>
          )}
        </>
      )}
    </div>
  );
}
