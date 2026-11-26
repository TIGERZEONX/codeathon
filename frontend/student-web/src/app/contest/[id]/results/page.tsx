'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { contestApi, leaderboardApi } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { ResultsSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Trophy, Clock, ArrowLeft, CheckCircle2, Award, Sparkles } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalScore: number;
  formattedTimeTaken?: string;
  timeTakenMinutes?: number;
  completionTimeSeconds?: number;
  isCurrentUser?: boolean;
}

interface AttemptResult {
  status: string;
  totalScore?: number;
  mcqScore?: number;
  codingScore?: number;
  submittedAt?: string;
  startedAt?: string;
  completionTimeSeconds?: number;
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
    return <ResultsSkeleton />;
  }

  const rawAttempt: any = (attemptData as any)?.attempt || attemptData;
  if (!rawAttempt) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 bg-slate-50">
        Results not found.
      </div>
    );
  }

  const totalScore = rawAttempt.finalScore ?? rawAttempt.totalScore ?? rawAttempt.score ?? 0;
  const mcqScore = rawAttempt.mcqScore ?? 0;
  const codingScore = rawAttempt.codingScore ?? 0;
  const submittedAt = rawAttempt.submittedAt || rawAttempt.updatedAt;
  const startedAt = rawAttempt.startedAt;
  const secs = rawAttempt.completionTimeSeconds || (submittedAt && startedAt ? Math.max(1, Math.floor((new Date(submittedAt).getTime() - new Date(startedAt).getTime()) / 1000)) : 0);
  const formattedAttemptTime = secs > 0
    ? (secs >= 3600
        ? `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m ${secs % 60}s`
        : `${Math.floor(secs / 60)}m ${secs % 60}s`)
    : '—';

  const rawEntries: any = (lbData as any)?.entries || (Array.isArray(lbData) ? lbData : []);
  const leaderboard: LeaderboardEntry[] = rawEntries.map((e: any, idx: number) => {
    const entrySecs = e.completionTimeSeconds || 0;
    const fallbackFormatted = entrySecs > 0
      ? (entrySecs >= 3600
          ? `${Math.floor(entrySecs / 3600)}h ${Math.floor((entrySecs % 3600) / 60)}m ${entrySecs % 60}s`
          : `${Math.floor(entrySecs / 60)}m ${entrySecs % 60}s`)
      : (e.timeTakenMinutes != null ? `${e.timeTakenMinutes}m` : '—');

    return {
      rank: e.rank || idx + 1,
      displayName: e.displayName || e.name || 'Participant',
      totalScore: e.totalScore ?? e.score ?? 0,
      formattedTimeTaken: e.formattedTimeTaken || fallbackFormatted,
      isCurrentUser: e.isCurrentUser || e.userId === rawAttempt?.userId,
    };
  });

  const showTotalPointsEarned =
    (attemptData as any)?.showTotalPointsEarned !== false &&
    (attemptData as any)?.contest?.showTotalPointsEarned !== false &&
    (attemptData as any)?.contest?.resultVisibility !== 'hidden';

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#3760F8] hover:text-[#254EDB] px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">Assessment Evaluation</h1>
        </div>
        <Badge color={rawAttempt.status === 'graded' || rawAttempt.status === 'submitted' ? 'green' : 'primary'} dot>
          {rawAttempt.status === 'graded' ? 'Graded & Verified' : 'Submitted'}
        </Badge>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 space-y-6">
        {/* Score Hero Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center shadow-xs relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 bg-[#EEF2FF] text-[#3760F8] px-3 py-1 rounded-full text-xs font-semibold mb-4">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Submission Recorded</span>
          </div>

          {showTotalPointsEarned ? (
            <>
              <div className="text-6xl sm:text-7xl font-extrabold text-[#3760F8] tracking-tight mb-1">
                {totalScore}
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-8">
                Total Marks Earned
              </p>

              <div className="grid grid-cols-3 gap-3 sm:gap-4 text-left">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">MCQ Marks</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">{mcqScore}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Coding Marks</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">{codingScore}</div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Time Taken</span>
                  <div className="text-xl font-bold text-slate-900 mt-1">{formattedAttemptTime}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Test Completed &amp; Submitted</h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Your answers have been securely recorded. Total marks and evaluation scores are hidden by your administrator and will be released after cohort review.
              </p>
              {formattedAttemptTime !== '—' && (
                <div className="inline-block bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs text-slate-600 font-semibold mt-2">
                  Total Duration: <span className="text-slate-900 font-mono">{formattedAttemptTime}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        {showTotalPointsEarned && leaderboard.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#3760F8]" />
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Contest Leaderboard</h2>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Ranking Criteria: 1. Highest Marks &bull; 2. Fastest Submission Time
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full self-start sm:self-auto">
                Top Standings
              </span>
            </div>

            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3.5 p-3 rounded-2xl transition-colors ${
                    entry.isCurrentUser
                      ? 'bg-[#EEF2FF] border border-[#C7D2FE]'
                      : 'bg-slate-50 border border-slate-100 hover:bg-slate-100/60'
                  }`}
                >
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs font-bold ${
                      entry.rank === 1
                        ? 'bg-[#D3FE4F] text-[#0B0F19] shadow-xs'
                        : entry.rank <= 3
                        ? 'bg-[#3760F8] text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    #{entry.rank}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-slate-800 tracking-tight">
                    {entry.displayName} {entry.isCurrentUser && <span className="text-xs text-[#3760F8] font-normal ml-1">(You)</span>}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-600 flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {entry.formattedTimeTaken || '—'}
                    </span>
                    <span className="text-sm font-extrabold text-[#3760F8] font-mono whitespace-nowrap">
                      {entry.totalScore} Marks
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </main>
    </div>
  );
}
