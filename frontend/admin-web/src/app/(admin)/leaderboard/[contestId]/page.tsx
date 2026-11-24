'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { leaderboardApi, contestsApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { ArrowLeft, Trophy, Lock, Clock, Award } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  participantId: string;
  displayName: string;
  rollNumber?: string;
  totalScore: number;
  mcqScore?: number;
  codingScore?: number;
  timeTakenMinutes?: number;
}

export default function LeaderboardPage() {
  const { contestId } = useParams<{ contestId: string }>();

  const { data: contestData } = useQuery({ queryKey: ['contest', contestId], queryFn: () => contestsApi.get(contestId) });
  const contest = contestData as { title?: string } | null;

  const { data: lbData, isLoading } = useQuery({
    queryKey: ['leaderboard-admin', contestId],
    queryFn: () => leaderboardApi.get(contestId),
    refetchInterval: 30000,
  });

  const rawData: any = (lbData as any)?.data || lbData;
  const entries: LeaderboardEntry[] = rawData?.entries || (Array.isArray(rawData) ? rawData : []);
  const isFrozen = rawData?.isFrozen || rawData?.frozen;

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/contests/${contestId}?tab=leaderboard`}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#3760F8] hover:text-[#254EDB] px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Contest Management</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Real-Time Leaderboard</h1>
              {isFrozen && (
                <Badge color="yellow" dot>
                  Score Freeze Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{contest?.title || 'Contest'} &bull; Synchronized ranking table</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Auto-refreshing 30s</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80">
              <thead className="bg-slate-50/80">
                <tr>
                  {['Rank', 'Candidate', 'Roll No.', 'MCQ Points', 'Coding Points', 'Aggregate Score', 'Time Taken'].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-xs text-slate-400">
                      No candidate submissions recorded on the leaderboard yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.participantId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`w-7 h-7 inline-flex items-center justify-center rounded-xl text-xs font-bold ${
                          entry.rank === 1
                            ? 'bg-[#D3FE4F] text-[#0B0F19] shadow-xs'
                            : entry.rank <= 3
                            ? 'bg-[#3760F8] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {entry.rank}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-slate-900 tracking-tight">
                        {entry.displayName}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-500">{entry.rollNumber || '—'}</td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-700">{entry.mcqScore ?? '—'}</td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-700">{entry.codingScore ?? '—'}</td>
                      <td className="px-5 py-3.5 text-xs font-mono font-extrabold text-[#3760F8]">
                        {entry.totalScore} pts
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">
                        {entry.timeTakenMinutes != null ? `${entry.timeTakenMinutes}m` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
