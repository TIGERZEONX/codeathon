'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { contestApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {
  Code2,
  Clock,
  Trophy,
  ChevronRight,
  LogOut,
  CheckCircle2,
  Play,
  AlertCircle,
  Calendar,
  Sparkles,
  Award,
} from 'lucide-react';
import { CONTEST_STATUS, ATTEMPT_STATUS } from '@codeathon/shared';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    live: { label: 'Live Now', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
    scheduled: { label: 'Upcoming', cls: 'bg-[#EEF2FF] text-[#3760F8] border-[#C7D2FE]', dot: 'bg-[#3760F8]' },
    ended: { label: 'Ended', cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
    draft: { label: 'Draft', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function AttemptBadge({ status }: { status?: string }) {
  if (!status || status === ATTEMPT_STATUS.NOT_STARTED) return null;
  if (status === ATTEMPT_STATUS.SUBMITTED) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 font-medium">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Submitted
      </span>
    );
  }
  if (status === ATTEMPT_STATUS.IN_PROGRESS) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-amber-800 bg-amber-50 border border-amber-200 font-medium">
        <AlertCircle className="w-3 h-3 text-amber-600" /> In Progress
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
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Navigation */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#3760F8] rounded-xl flex items-center justify-center shadow-[0_2px_10px_rgba(55,96,248,0.35)] relative group">
              <Code2 className="text-white w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#D3FE4F] rounded-full border-2 border-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-base">Codeathon</span>
              <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold text-[#3760F8] bg-[#EEF2FF] px-2 py-0.5 rounded-full">Student</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 tracking-tight">{user?.name}</p>
              <p className="text-xs text-slate-500 font-mono">{user?.rollNumber ?? user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Welcome Banner */}
        <div className="mb-8 bg-gradient-to-r from-[#0B0F19] to-[#1E293B] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#3760F8]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 right-20 w-40 h-40 bg-[#D3FE4F]/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-[#D3FE4F] mb-3 border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Assessment &amp; Contest Arena</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {user?.name?.split(' ')[0] ?? 'Candidate'}
            </h1>
            <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">
              Find your assigned competitive coding rounds, launch tests with automatic proctoring, and review your performance.
            </p>
          </div>
        </div>

        {/* Section Heading */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Assigned Contests</h2>
            <p className="text-xs text-slate-500">Live, upcoming, and evaluated challenges</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 shadow-2xs">
            {contests.length} {contests.length === 1 ? 'Contest' : 'Contests'}
          </span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-9 h-9 rounded-full border-3 border-[#3760F8] border-t-transparent animate-spin" />
          </div>
        ) : contests.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-slate-800 font-semibold text-sm">No contests assigned yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Your instructor or administrator has not assigned you to any active contest yet. Please check back later.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {contests.map((contest: any) => {
              const isLive = contest.status === CONTEST_STATUS.LIVE || contest.computedStatus === CONTEST_STATUS.LIVE;
              const isSubmitted = contest.attempt?.status === ATTEMPT_STATUS.SUBMITTED;
              const isInProgress = contest.attempt?.status === ATTEMPT_STATUS.IN_PROGRESS;
              const canStart = isLive && !isSubmitted;

              return (
                <div
                  key={contest.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 hover:border-[#3760F8]/40 hover:shadow-card transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <StatusBadge status={contest.computedStatus ?? contest.status} />
                        <AttemptBadge status={contest.attempt?.status} />
                      </div>
                      <h3 className="font-bold text-slate-900 text-base group-hover:text-[#3760F8] transition-colors tracking-tight">
                        {contest.title}
                      </h3>
                      {contest.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {contest.description}
                        </p>
                      )}
                      <div className="flex items-center gap-5 mt-4 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1.5 font-medium text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {contest.durationMinutes} minutes
                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(contest.startTime).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isSubmitted && contest.attempt?.finalScore !== undefined && (
                          <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold">
                            <Trophy className="w-3.5 h-3.5" />
                            Score: {contest.attempt.finalScore}
                          </span>
                        )}
                        {isInProgress && contest.attempt?.remainingSeconds !== undefined && (
                          <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            {Math.floor(contest.attempt.remainingSeconds / 60)}m remaining
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="flex-shrink-0 sm:self-center">
                      {isSubmitted ? (
                        <button
                          onClick={() => handleEnterContest(contest)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#3760F8] bg-[#EEF2FF] hover:bg-[#E0E7FF] rounded-xl transition-all border border-[#C7D2FE]"
                        >
                          View Results
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : canStart ? (
                        <button
                          onClick={() => handleEnterContest(contest)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#3760F8] hover:bg-[#254EDB] text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow-[0_4px_14px_rgba(55,96,248,0.35)] active:scale-95 transition-all"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>{isInProgress ? 'Resume Test' : 'Start Assessment'}</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full sm:w-auto px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-medium cursor-not-allowed border border-slate-200"
                        >
                          {contest.computedStatus === CONTEST_STATUS.SCHEDULED ? 'Starts Soon' : 'Closed'}
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
