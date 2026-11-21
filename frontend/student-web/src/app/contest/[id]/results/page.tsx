'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { contestApi, leaderboardApi } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  isCurrentUser?: boolean;
}

interface AttemptResult {
  status: string;
  totalScore?: number;
  mcqScore?: number;
  codingScore?: number;
  submittedAt?: string;
  startedAt?: string;
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: attemptData, isLoading } = useQuery({
    queryKey: ['attempt-result', id],
    queryFn: () => contestApi.getAttemptState(id),
  });

  const { data: lbData } = useQuery({
    queryKey: ['leaderboard', id],
    queryFn: () => leaderboardApi.get(id).catch(() => null),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const attempt = attemptData as AttemptResult | null;
  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Results not found.
      </div>
    );
  }

  const timeTaken =
    attempt.submittedAt && attempt.startedAt
      ? Math.floor(
          (new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) /
            60000
        )
      : null;

  const leaderboard: LeaderboardEntry[] = (lbData as { entries?: LeaderboardEntry[] })?.entries || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900">Your Results</h1>
        <Badge color={attempt.status === 'graded' ? 'green' : 'yellow'}>{attempt.status}</Badge>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        {/* Score Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-6xl font-bold text-blue-600 mb-2">
            {attempt.totalScore ?? '—'}
          </div>
          <div className="text-gray-500 mb-6">Total Score</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="font-semibold text-blue-700 text-xl">{attempt.mcqScore ?? '—'}</div>
              <div className="text-blue-600 text-xs mt-1">MCQ Score</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="font-semibold text-purple-700 text-xl">{attempt.codingScore ?? '—'}</div>
              <div className="text-purple-600 text-xs mt-1">Coding Score</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="font-semibold text-gray-700 text-xl">
                {timeTaken != null ? `${timeTaken}m` : '—'}
              </div>
              <div className="text-gray-500 text-xs mt-1">Time Taken</div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Leaderboard</h2>
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    entry.isCurrentUser
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-gray-50'
                  }`}
                >
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${
                      entry.rank <= 3
                        ? 'bg-yellow-400 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-800">{entry.displayName}</span>
                  <span className="text-sm font-bold text-blue-600">{entry.totalScore}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            ← Back to Dashboard
          </Button>
        </div>
      </main>
    </div>
  );
}
