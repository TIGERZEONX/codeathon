'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { leaderboardApi, contestsApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';

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

  const entries: LeaderboardEntry[] = (lbData as { entries?: LeaderboardEntry[] })?.entries || (lbData as LeaderboardEntry[]) || [];
  const isFrozen = (lbData as { frozen?: boolean })?.frozen;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/contests" className="text-blue-600 hover:underline text-sm">← Contests</Link>
        <h1 className="text-2xl font-bold text-gray-900">Leaderboard — {contest?.title || contestId}</h1>
        {isFrozen && <Badge color="yellow">🔒 Frozen</Badge>}
        <span className="ml-auto text-xs text-gray-500">Auto-refresh 30s</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Rank', 'Name', 'Roll No.', 'MCQ', 'Coding', 'Total', 'Time'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No leaderboard data yet.</td></tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.participantId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`w-8 h-8 inline-flex items-center justify-center rounded-full text-sm font-bold ${entry.rank <= 3 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-700'}`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.displayName}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{entry.rollNumber || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.mcqScore ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.codingScore ?? '—'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-blue-600">{entry.totalScore}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {entry.timeTakenMinutes != null ? `${entry.timeTakenMinutes}m` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
