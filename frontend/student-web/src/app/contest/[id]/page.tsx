'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { contestApi } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ArrowLeft,
  Clock,
  Calendar,
  Award,
  ShieldAlert,
  Info,
  CheckCircle,
  Play,
} from 'lucide-react';

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ContestEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: contestData, isLoading } = useQuery({
    queryKey: ['contest', id],
    queryFn: () => contestApi.getAttemptState(id).catch(() => null),
    retry: false,
  });

  const { data: attemptData } = useQuery({
    queryKey: ['attempt-check', id],
    queryFn: () => contestApi.getAttemptState(id).catch(() => null),
    retry: false,
  });

  useEffect(() => {
    if (attemptData) {
      const a = attemptData as { status?: string };
      if (a?.status === 'submitted' || a?.status === 'graded') {
        router.replace(`/contest/${id}/results`);
      } else if (a?.status === 'in_progress') {
        router.replace(`/contest/${id}/attempt`);
      }
    }
  }, [attemptData, id, router]);

  const startMutation = useMutation({
    mutationFn: () => contestApi.startAttempt(id),
    onSuccess: () => router.push(`/contest/${id}/attempt`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  const contest = contestData as {
    title?: string;
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    totalMarks?: number;
    description?: string;
    proctorConfig?: {
      enabled?: boolean;
      blockTabSwitch?: boolean;
      blockCopyPaste?: boolean;
      enforceFullscreen?: boolean;
      blockRightClick?: boolean;
      maxViolations?: number;
    };
  } | null;

  const now = new Date();
  const start = contest?.startTime ? new Date(contest.startTime) : null;
  const end = contest?.endTime ? new Date(contest.endTime) : null;
  const isLive = start && end ? now >= start && now <= end : false;
  const isUpcoming = start ? now < start : false;
  const isOver = end ? now > end : false;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#3760F8] hover:text-[#254EDB] px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <h1 className="text-base font-bold text-slate-900 tracking-tight">{contest?.title || 'Contest Overview'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isLive && <Badge color="green" dot>Live Session</Badge>}
          {isUpcoming && <Badge color="yellow" dot>Starts Soon</Badge>}
          {isOver && <Badge color="gray">Ended</Badge>}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:py-10 space-y-6">
        {/* Contest Details Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-[#3760F8] uppercase tracking-wider">Assessment Specifications</span>
              <h2 className="text-xl font-bold text-slate-900 mt-1 tracking-tight">{contest?.title || 'Contest'}</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Duration</span>
              </div>
              <div className="text-base font-bold text-slate-900">
                {contest?.durationMinutes ? formatDuration(contest.durationMinutes) : '—'}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Award className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Total Marks</span>
              </div>
              <div className="text-base font-bold text-[#3760F8]">
                {contest?.totalMarks ?? '—'} pts
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Starts</span>
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {start ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
              <div className="text-[10px] text-slate-600">
                {start ? start.toLocaleDateString() : ''}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Ends</span>
              </div>
              <div className="text-xs font-semibold text-slate-800">
                {end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
              <div className="text-[10px] text-slate-600">
                {end ? end.toLocaleDateString() : ''}
              </div>
            </div>
          </div>

          {contest?.description && (
            <p className="text-slate-600 text-xs sm:text-sm border-t border-slate-100 pt-4 leading-relaxed">
              {contest.description}
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900">
            <Info className="w-5 h-5 text-[#3760F8]" />
            <h3 className="text-base font-bold tracking-tight">Instructions &amp; Code of Conduct</h3>
          </div>
          <ul className="grid gap-2.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
            <li className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>Read all questions carefully. You may navigate freely across all sections and problems.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>Your timer starts immediately once you click <strong>Start Test</strong>. Timer is synchronized server-side.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>All MCQ answers and coding drafts are automatically saved every 30 seconds.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>The test will automatically lock and submit when the timer expires.</span>
            </li>
          </ul>
        </div>

        {/* Proctoring Rules */}
        {contest?.proctorConfig?.enabled && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-6 sm:p-7 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-amber-900">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold tracking-tight">Automated Proctoring Rules Active</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs text-amber-950 font-medium pt-1">
              {contest.proctorConfig.blockTabSwitch && (
                <div className="bg-white/80 border border-amber-200/60 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Tab switching is tracked and logged.</span>
                </div>
              )}
              {contest.proctorConfig.blockCopyPaste && (
                <div className="bg-white/80 border border-amber-200/60 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Clipboard copy and paste is prohibited.</span>
                </div>
              )}
              {contest.proctorConfig.enforceFullscreen && (
                <div className="bg-white/80 border border-amber-200/60 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Full-screen mode is required throughout.</span>
                </div>
              )}
              {contest.proctorConfig.blockRightClick && (
                <div className="bg-white/80 border border-amber-200/60 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Context menu (right-click) is disabled.</span>
                </div>
              )}
            </div>
            {contest.proctorConfig.maxViolations && (
              <p className="text-[11px] text-amber-800 pt-1">
                Note: Exceeding <strong>{contest.proctorConfig.maxViolations} violations</strong> will automatically submit and terminate your test.
              </p>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-col items-center justify-center pt-2">
          {isLive || !contest ? (
            <Button
              size="lg"
              onClick={() => startMutation.mutate()}
              loading={startMutation.isPending}
              className="px-10 py-3.5 text-sm font-semibold rounded-2xl shadow-md hover:shadow-xl hover:shadow-[#3760F8]/25"
              leftIcon={<Play className="w-4 h-4 fill-white" />}
            >
              Start Assessment Now
            </Button>
          ) : isUpcoming && start ? (
            <div className="text-center bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-sm">
              <p className="text-sm font-semibold text-slate-800">Contest has not opened yet</p>
              <p className="text-xs text-slate-500 mt-1">Opens at {start.toLocaleString()}</p>
            </div>
          ) : (
            <div className="text-center bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-sm">
              <p className="text-sm font-semibold text-slate-800">Contest closed</p>
              <p className="text-xs text-slate-500 mt-1">This test has officially concluded.</p>
            </div>
          )}

          {startMutation.isError && (
            <p className="text-rose-600 text-xs font-medium mt-3">
              {(startMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to start. Please try again.'}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
