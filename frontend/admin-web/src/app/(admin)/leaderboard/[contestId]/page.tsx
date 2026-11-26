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
  completionTimeSeconds?: number;
  formattedTimeTaken?: string;
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
  const rawEntries: any = rawData?.entries || (Array.isArray(rawData) ? rawData : []);
  const entries: LeaderboardEntry[] = rawEntries.map((e: any, idx: number) => {
    const secs = e.completionTimeSeconds || 0;
    const fallbackFormatted = secs > 0
      ? (secs >= 3600
          ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m ${secs % 60}s`
          : `${Math.floor(secs / 60)}m ${secs % 60}s`)
      : (e.timeTakenMinutes != null ? `${e.timeTakenMinutes}m` : '—');

    return {
      rank: e.rank || idx + 1,
      participantId: e.participantId || e.userId || `user_${idx}`,
      displayName: e.displayName || e.name || 'Candidate',
      rollNumber: e.rollNumber || '—',
      totalScore: e.totalScore ?? e.score ?? 0,
      mcqScore: e.mcqScore ?? 0,
      codingScore: e.codingScore ?? 0,
      completionTimeSeconds: secs,
      formattedTimeTaken: e.formattedTimeTaken || fallbackFormatted,
      timeTakenMinutes: e.timeTakenMinutes ?? (secs ? Math.round(secs / 60) : 0),
    };
  });
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

      {/* Ranking Criteria Callout */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#3760F8] shrink-0" />
          <span>
            <strong className="text-slate-800">Ranking Criteria:</strong> 1. <strong>Highest Score</strong> (total marks earned) &bull; 2. <strong>Fastest Submission</strong> (shortest completion time receives higher rank in ties).
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md self-start sm:self-auto">
          Tie-Breaker: Completion Time
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/80">
              <thead className="bg-slate-50/80">
                <tr>
                  {['Rank', 'Participant', 'Roll No.', 'MCQ Marks', 'Coding Marks', 'Total Score', 'Time Taken'].map((h) => (
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
                          #{entry.rank}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold text-slate-900 tracking-tight">
                        {entry.displayName}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-500">{entry.rollNumber || '—'}</td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-700">{entry.mcqScore ?? 0} Marks</td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-700">{entry.codingScore ?? 0} Marks</td>
                      <td className="px-5 py-3.5 text-xs font-mono font-extrabold text-[#3760F8]">
                        {entry.totalScore} Marks
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-mono text-slate-700 font-semibold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {entry.formattedTimeTaken || '—'}
                        </span>
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
