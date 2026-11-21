'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { contestApi } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-blue-600 hover:underline text-sm"
        >
          ← Dashboard
        </button>
        <h1 className="text-xl font-bold text-gray-900">{contest?.title || 'Contest'}</h1>
        {isLive && <Badge color="green">Live</Badge>}
        {isUpcoming && <Badge color="yellow">Upcoming</Badge>}
        {isOver && <Badge color="gray">Ended</Badge>}
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 space-y-6">
        {/* Contest Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Contest Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {contest?.durationMinutes && (
              <div>
                <span className="text-gray-500">Duration: </span>
                <span className="font-medium">{formatDuration(contest.durationMinutes)}</span>
              </div>
            )}
            {start && (
              <div>
                <span className="text-gray-500">Start: </span>
                <span className="font-medium">{start.toLocaleString()}</span>
              </div>
            )}
            {end && (
              <div>
                <span className="text-gray-500">End: </span>
                <span className="font-medium">{end.toLocaleString()}</span>
              </div>
            )}
            {contest?.totalMarks && (
              <div>
                <span className="text-gray-500">Total Marks: </span>
                <span className="font-medium">{contest.totalMarks}</span>
              </div>
            )}
          </div>
          {contest?.description && (
            <p className="text-gray-600 text-sm border-t pt-4">{contest.description}</p>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-blue-900">Instructions</h2>
          <ul className="list-disc list-inside text-sm text-blue-800 space-y-2">
            <li>Read all questions carefully before answering.</li>
            <li>The timer starts as soon as you click &quot;Start Test&quot;.</li>
            <li>Answers are auto-saved every 30 seconds.</li>
            <li>You can navigate between sections and questions freely.</li>
            <li>Once you submit, you cannot change your answers.</li>
            <li>The test will auto-submit when the timer reaches zero.</li>
          </ul>
        </div>

        {/* Proctoring Warning */}
        {contest?.proctorConfig?.enabled && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-6 space-y-2">
            <h2 className="text-lg font-semibold text-yellow-900">⚠️ Proctoring Active</h2>
            <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
              {contest.proctorConfig.blockTabSwitch && <li>Tab switching is monitored.</li>}
              {contest.proctorConfig.blockCopyPaste && <li>Copy/paste is disabled.</li>}
              {contest.proctorConfig.enforceFullscreen && <li>Fullscreen mode is required.</li>}
              {contest.proctorConfig.blockRightClick && <li>Right-click is disabled.</li>}
              {contest.proctorConfig.maxViolations && (
                <li>Exceeding {contest.proctorConfig.maxViolations} violations will auto-submit your test.</li>
              )}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="flex justify-center pt-4">
          {isLive && (
            <Button size="lg" onClick={() => startMutation.mutate()} loading={startMutation.isPending} className="px-12">
              Start Test
            </Button>
          )}
          {isUpcoming && start && (
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium">Contest hasn&apos;t started yet.</p>
              <p className="text-sm mt-1">Starts at {start.toLocaleString()}</p>
            </div>
          )}
          {isOver && (
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium">This contest has ended.</p>
            </div>
          )}
          {!contest && (
            <Button size="lg" onClick={() => startMutation.mutate()} loading={startMutation.isPending} className="px-12">
              Start Test
            </Button>
          )}
        </div>

        {startMutation.isError && (
          <p className="text-center text-red-600 text-sm">
            {(startMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to start. Please try again.'}
          </p>
        )}
      </main>
    </div>
  );
}
