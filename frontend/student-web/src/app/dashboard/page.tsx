'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { contestApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Code2, Clock, Trophy, ChevronRight, LogOut, CheckCircle2, Play, AlertCircle, Calendar
} from 'lucide-react';
import { CONTEST_STATUS, ATTEMPT_STATUS } from '@codeathon/shared';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    live: { label: 'Live', cls: 'bg-success-50 text-success border-success-100' },
    scheduled: { label: 'Upcoming', cls: 'bg-info-50 text-info border-info-100' },
    ended: { label: 'Ended', cls: 'bg-paper-muted text-ink-muted border-line' },
    draft: { label: 'Draft', cls: 'bg-warning-50 text-warning border-warning-100' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-paper-muted text-ink-muted border-line' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function AttemptBadge({ status }: { status?: string }) {
  if (!status || status === ATTEMPT_STATUS.NOT_STARTED) return null;
  if (status === ATTEMPT_STATUS.SUBMITTED) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
      </span>
    );
  }
  if (status === ATTEMPT_STATUS.IN_PROGRESS) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning font-medium">
        <AlertCircle className="w-3.5 h-3.5" /> In Progress
      </span>
    );
  }
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const { data: contests = [], isLoading } = useQuery({
    queryKey: ['assigned-contests'],
    queryFn: contestApi.getAssigned,
    refetchInterval: 30_000,
  });

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    clearAuth();
    router.replace('/login');
  };

  const handleEnterContest = (contest: any) => {
    if (contest.attempt?.status === ATTEMPT_STATUS.SUBMITTED) {
      router.push(`/contest/${contest.id}/results`);
    } else {
      router.push(`/contest/${contest.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-paper-subtle">
      {/* Top Nav */}
      <header className="bg-paper border-b border-line sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-base rounded-lg flex items-center justify-center">
              <Code2 className="text-white w-4 h-4" />
            </div>
            <span className="font-semibold text-ink-primary text-sm">Codeathon</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-ink-primary">{user?.name}</p>
              <p className="text-xs text-ink-muted">{user?.rollNumber ?? user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-danger transition-colors min-h-tap px-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-ink-primary">My Contests</h2>
          <p className="text-sm text-ink-muted mt-1">Your assigned programming contests appear below.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-base border-t-transparent animate-spin" />
          </div>
        ) : contests.length === 0 ? (
          <div className="bg-paper border border-line rounded-xl p-12 text-center">
            <Calendar className="w-10 h-10 text-ink-disabled mx-auto mb-3" />
            <p className="text-ink-secondary font-medium">No contests assigned yet</p>
            <p className="text-sm text-ink-muted mt-1">Your administrator will assign contests to you shortly.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contests.map((contest: any) => {
              const isLive = contest.status === CONTEST_STATUS.LIVE || contest.computedStatus === CONTEST_STATUS.LIVE;
              const isSubmitted = contest.attempt?.status === ATTEMPT_STATUS.SUBMITTED;
              const isInProgress = contest.attempt?.status === ATTEMPT_STATUS.IN_PROGRESS;
              const canStart = isLive && !isSubmitted;

              return (
                <div
                  key={contest.id}
                  className="bg-paper border border-line rounded-xl p-5 hover:border-line-strong transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={contest.computedStatus ?? contest.status} />
                        <AttemptBadge status={contest.attempt?.status} />
                      </div>
                      <h3 className="font-semibold text-ink-primary text-base mt-1.5 leading-snug">
                        {contest.title}
                      </h3>
                      {contest.description && (
                        <p className="text-sm text-ink-muted mt-1 line-clamp-2">{contest.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-ink-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {contest.durationMinutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(contest.startTime).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isSubmitted && contest.attempt?.finalScore !== undefined && (
                          <span className="flex items-center gap-1 text-success font-medium">
                            <Trophy className="w-3.5 h-3.5" />
                            Score: {contest.attempt.finalScore}
                          </span>
                        )}
                        {isInProgress && contest.attempt?.remainingSeconds !== undefined && (
                          <span className="flex items-center gap-1 text-warning font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {Math.floor(contest.attempt.remainingSeconds / 60)}m remaining
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="flex-shrink-0">
                      {isSubmitted ? (
                        <button
                          onClick={() => handleEnterContest(contest)}
                          className="flex items-center gap-1.5 text-sm text-base hover:text-base-700 font-medium min-h-tap px-2 transition-colors"
                        >
                          View Results
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : canStart ? (
                        <button
                          onClick={() => handleEnterContest(contest)}
                          className="flex items-center gap-1.5 h-9 px-4 bg-base text-white rounded-lg text-sm font-medium hover:bg-base-600 active:scale-95 transition-all"
                        >
                          {isInProgress ? (
                            <>
                              <Play className="w-3.5 h-3.5 fill-white" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-white" />
                              Start Test
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="h-9 px-4 bg-paper-muted text-ink-disabled rounded-lg text-sm font-medium cursor-not-allowed"
                        >
                          {contest.computedStatus === CONTEST_STATUS.SCHEDULED ? 'Not Started' : 'Closed'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
