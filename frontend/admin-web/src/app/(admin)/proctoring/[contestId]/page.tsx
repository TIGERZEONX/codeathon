'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { proctoringApi, contestsApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';

interface ViolationEvent {
  _id?: string;
  studentName?: string;
  participantName?: string;
  rollNumber?: string;
  type: string;
  eventType?: string;
  count?: number;
  createdAt: string;
}

const typeColor: Record<string, 'red' | 'yellow' | 'orange'> = {
  tab_switch: 'yellow',
  copy: 'orange',
  paste: 'orange',
  right_click: 'yellow',
  fullscreen_exit: 'red',
};

export default function ProctoringPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const feedRef = useRef<HTMLDivElement>(null);
  const [liveFeed, setLiveFeed] = useState<ViolationEvent[]>([]);

  const { data: contestData } = useQuery({ queryKey: ['contest', contestId], queryFn: () => contestsApi.get(contestId) });
  const contest = contestData as { title?: string } | null;

  // Polling feed every 10s
  const { data, isLoading } = useQuery({
    queryKey: ['proctor-feed', contestId],
    queryFn: () => proctoringApi.getFeed(contestId),
    refetchInterval: 10000,
  });

  useEffect(() => {
    const events = (data as ViolationEvent[]) || [];
    setLiveFeed(events);
  }, [data]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [liveFeed]);

  const violationCounts: Record<string, number> = {};
  liveFeed.forEach((e) => {
    const type = e.type || e.eventType || 'unknown';
    violationCounts[type] = (violationCounts[type] || 0) + 1;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/contests" className="text-blue-600 hover:underline text-sm">← Contests</Link>
        <h1 className="text-2xl font-bold text-gray-900">Proctoring Monitor — {contest?.title || contestId}</h1>
        <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Auto-refresh every 10s
        </span>
      </div>

      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries(violationCounts).map(([type, count]) => (
          <div key={type} className="bg-white rounded-lg border px-4 py-2 text-sm">
            <span className="capitalize text-gray-600">{type.replace(/_/g, ' ')}: </span>
            <span className="font-bold text-red-600">{count}</span>
          </div>
        ))}
        <div className="bg-white rounded-lg border px-4 py-2 text-sm">
          <span className="text-gray-600">Total: </span>
          <span className="font-bold text-gray-900">{liveFeed.length}</span>
        </div>
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">Live Violation Feed</span>
          </div>
          <div ref={feedRef} className="max-h-[60vh] overflow-y-auto divide-y">
            {liveFeed.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No violations recorded yet.</div>
            ) : (
              [...liveFeed].reverse().map((event, i) => {
                const type = event.type || event.eventType || 'unknown';
                return (
                  <div key={event._id || i} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                    <div className="text-xs text-gray-400 w-20 flex-shrink-0 font-mono">
                      {new Date(event.createdAt).toLocaleTimeString()}
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {event.participantName || event.studentName || 'Unknown'}
                      </span>
                      {event.rollNumber && (
                        <span className="text-xs text-gray-500 ml-2">{event.rollNumber}</span>
                      )}
                    </div>
                    <Badge color={typeColor[type] || 'red'}>
                      {type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
