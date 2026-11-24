'use client';

import { useEffect, useState, useMemo } from 'react';
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
  ShieldCheck,
  Copy,
  Check,
  Search,
  User,
} from 'lucide-react';
import { CONTEST_STATUS, ATTEMPT_STATUS } from '@codeathon/shared';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    live: {
      label: 'Live Now',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs',
      dot: 'bg-emerald-500 animate-pulse',
    },
    scheduled: {
      label: 'Upcoming',
      cls: 'bg-[#EEF2FF] text-[#3760F8] border-[#C7D2FE]',
      dot: 'bg-[#3760F8]',
    },
    ended: {
      label: 'Ended',
      cls: 'bg-slate-100 text-slate-600 border-slate-200',
      dot: 'bg-slate-400',
    },
    draft: {
      label: 'Draft',
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
    },
  };
  const s = map[status] ?? {
    label: status.toUpperCase(),
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function AttemptBadge({ status }: { status?: string }) {
  if (!status || status === ATTEMPT_STATUS.NOT_STARTED) return null;
  if (status === ATTEMPT_STATUS.SUBMITTED) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-semibold shadow-xs">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Submitted
      </span>
    );
  }
  if (status === ATTEMPT_STATUS.IN_PROGRESS) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] text-amber-800 bg-amber-50 border border-amber-200 font-semibold shadow-xs">
        <AlertCircle className="w-3 h-3 text-amber-600" /> In Progress
      </span>
    );
  }
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, clearAuth, isAuthenticated, initAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    initAuth();
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, initAuth, router]);

  const { data: meUser } = useQuery({
    queryKey: ['student-profile-me'],
    queryFn: authApi.me,
    staleTime: 60_000,
  });

  const currentUser = meUser || user;

  const { data: contests = [], isLoading } = useQuery({
    queryKey: ['assigned-contests'],
    queryFn: contestApi.getAssigned,
    refetchInterval: 60_000,
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

  const copyRollNumber = () => {
    const roll = currentUser?.rollNumber ?? currentUser?.email ?? '';
    if (!roll) return;
    navigator.clipboard.writeText(roll);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const stats = useMemo(() => {
    const total = contests.length;
    const live = contests.filter((c: any) => {
      const st = c.computedStatus ?? c.status;
      return st === CONTEST_STATUS.LIVE;
    }).length;

    const submitted = contests.filter(
      (c: any) => c.attempt?.status === ATTEMPT_STATUS.SUBMITTED
    );
    const submittedCount = submitted.length;

    const scores = submitted
      .map((c: any) => c.attempt?.finalScore)
      .filter((s: any) => typeof s === 'number');

    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
        : 0;

    return { total, live, submittedCount, highestScore, avgScore };
  }, [contests]);

  const filteredContests = useMemo(() => {
    return contests.filter((contest: any) => {
      const computed = contest.computedStatus ?? contest.status;
      const isSubmitted = contest.attempt?.status === ATTEMPT_STATUS.SUBMITTED;

      if (activeTab === 'live' && computed !== CONTEST_STATUS.LIVE) return false;
      if (activeTab === 'upcoming' && computed !== CONTEST_STATUS.SCHEDULED) return false;
      if (activeTab === 'completed' && !isSubmitted) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = contest.title?.toLowerCase().includes(query);
        const descMatch = contest.description?.toLowerCase().includes(query);
        return titleMatch || descMatch;
      }

      return true;
    });
  }, [contests, activeTab, searchQuery]);

  const liveContest = useMemo(() => {
    return contests.find((c: any) => {
      const st = c.computedStatus ?? c.status;
      return st === CONTEST_STATUS.LIVE && c.attempt?.status !== ATTEMPT_STATUS.SUBMITTED;
    });
  }, [contests]);

  const initials = useMemo(() => {
    const name = currentUser?.name || 'Candidate';
    return name
      .split(' ')
      .map((p: string) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }, [currentUser?.name]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-16">
      {/* Top Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="HACKPRO" className="h-10 w-auto object-contain rounded" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">HACKPRO</span>
                <span className="text-[10px] font-bold text-[#3760F8] bg-[#EEF2FF] border border-[#C7D2FE] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Assessment Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Candidate Assessment System</p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50/80 border border-emerald-200/70 text-emerald-800 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Proctoring Active</span>
            </div>

            <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-slate-200">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#3760F8] to-[#60A5FA] flex items-center justify-center text-white font-bold text-xs shadow-sm ring-2 ring-[#3760F8]/20">
                {initials}
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 tracking-tight leading-snug">{currentUser?.name}</p>
                <p className="text-[11px] text-slate-500 font-mono tracking-wide leading-none">
                  {currentUser?.rollNumber ?? currentUser?.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl transition-all border border-slate-200/80 hover:border-rose-200 ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#0B0F19] via-[#111827] to-[#1E293B] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border border-slate-800">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#3760F8]/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 right-32 w-56 h-56 bg-[#D3FE4F]/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-block text-xs font-semibold text-[#D3FE4F] uppercase tracking-wider mb-2">
                Candidate Assessment Portal
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
                Welcome, {currentUser?.name?.split(' ')[0] ?? 'Candidate'}
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed max-w-xl">
                Find your assigned assessment rounds, launch tests with active proctoring, and review results.
              </p>
            </div>

            {liveContest && (
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0 lg:max-w-sm">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#D3FE4F]">
                    <span className="w-2 h-2 rounded-full bg-[#D3FE4F] animate-pulse" />
                    <span>ASSESSMENT ACTIVE</span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 line-clamp-1">{liveContest.title}</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">{liveContest.durationMinutes} Minutes</p>
                </div>
                <button
                  onClick={() => handleEnterContest(liveContest)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#D3FE4F] text-[#0B0F19] hover:bg-[#C2F038] font-bold text-xs rounded-xl shadow-lg transition-all active:scale-95 shrink-0"
                >
                  <Play className="w-3.5 h-3.5 fill-[#0B0F19]" />
                  <span>Enter Assessment</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Minimalistic 2-Column Split: Available Assessments (Left) & Candidate Profile (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Column (8 cols): Available Assessments */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Available Assessments</span>
                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[#3760F8] text-white">
                      {filteredContests.length}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your assigned assessments and competitive coding challenges
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search assessments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3760F8]/30 focus:border-[#3760F8] transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 pt-4 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'all'
                      ? 'bg-[#3760F8] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  All ({contests.length})
                </button>
                <button
                  onClick={() => setActiveTab('live')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'live'
                      ? 'bg-[#3760F8] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Live Now
                </button>
                <button
                  onClick={() => setActiveTab('upcoming')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'upcoming'
                      ? 'bg-[#3760F8] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Upcoming
                </button>
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'completed'
                      ? 'bg-[#3760F8] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  Completed
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-3 border-[#3760F8] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredContests.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700">No Assessments Found</h3>
                  <p className="text-xs text-slate-400 mt-1">You have no assessments in this category right now.</p>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {filteredContests.map((contest: any) => {
                    const computed = contest.computedStatus ?? contest.status;
                    const isSubmitted = contest.attempt?.status === ATTEMPT_STATUS.SUBMITTED;
                    const isInProgress = contest.attempt?.status === ATTEMPT_STATUS.IN_PROGRESS;
                    const isLive = computed === CONTEST_STATUS.LIVE;

                    return (
                      <div
                        key={contest.id}
                        onClick={() => handleEnterContest(contest)}
                        className="p-5 rounded-2xl border border-slate-200/90 hover:border-[#3760F8]/40 hover:shadow-md transition-all bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <StatusBadge status={computed} />
                            <AttemptBadge status={contest.attempt?.status} />
                            {contest.proctorConfig?.enabled && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <ShieldCheck className="w-3 h-3 text-[#3760F8]" /> Proctoring
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-900 group-hover:text-[#3760F8] transition-colors text-base tracking-tight line-clamp-1">
                            {contest.title}
                          </h3>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {contest.description || 'Structured programming and theoretical assessment challenge.'}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 font-mono">
                            <span className="flex items-center gap-1 text-slate-600">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {contest.durationMinutes} mins
                            </span>
                            {isSubmitted && contest.attempt?.finalScore != null && (
                              <span className="flex items-center gap-1 font-bold text-[#3760F8]">
                                <Trophy className="w-3.5 h-3.5" />
                                Score: {contest.attempt.finalScore} pts
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="self-end sm:self-center shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEnterContest(contest);
                            }}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                              isSubmitted
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : isLive || isInProgress
                                ? 'bg-[#3760F8] text-white hover:bg-[#254EDB]'
                                : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <span>{isSubmitted ? 'View Results' : isLive || isInProgress ? 'Start Test' : 'Upcoming'}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Beside That: Candidate Profile Card (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#3760F8] via-[#60A5FA] to-[#D3FE4F]" />

              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <User className="w-4 h-4 text-[#3760F8]" />
                  <span>Candidate Profile</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200">
                  Active
                </span>
              </div>

              <div className="pt-5 flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#3760F8] to-[#1E293B] flex items-center justify-center text-white text-xl font-extrabold shadow-md ring-4 ring-[#3760F8]/15 mb-3.5">
                  {initials}
                </div>

                <h3 className="text-lg font-bold text-slate-900 tracking-tight">{currentUser?.name}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{currentUser?.email}</p>

                <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-800 font-mono">
                  <span className="text-slate-400 font-sans text-[11px]">Roll No:</span>
                  <span className="font-bold tracking-wider">{currentUser?.rollNumber ?? '—'}</span>
                  <button
                    onClick={copyRollNumber}
                    title="Copy candidate ID"
                    className="p-1 rounded text-slate-400 hover:text-[#3760F8] hover:bg-slate-200/60 transition-colors ml-1"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 text-xs">
                {currentUser?.department && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Department:</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {currentUser.department}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Verification:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Identity Verified
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Completed Assessments:</span>
                  <span className="font-bold text-slate-900">
                    {stats.submittedCount} / {contests.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
