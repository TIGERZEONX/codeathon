'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { proctoringApi, contestsApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert, Activity, Radio, AlertTriangle } from 'lucide-react';

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
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/contests"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#3760F8] hover:text-[#254EDB] px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Contests</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Proctoring Telemetry</h1>
            <p className="text-xs text-slate-500 mt-0.5">{contest?.title || 'Contest'} &bull; Real-time violation event stream</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-time Polling Active</span>
        </div>
      </div>

      {/* Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {Object.entries(violationCounts).map(([type, count]) => (
          <div key={type} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block capitalize">
              {type.replace(/_/g, ' ')}
            </span>
            <span className="text-xl font-bold text-rose-600 font-mono mt-1 block">{count}</span>
          </div>
        ))}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            Total Violations
          </span>
          <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">{liveFeed.length}</span>
        </div>
      </div>

      {/* Live Stream Terminal */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="bg-[#0B0F19] rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
          <div className="bg-[#111827] px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-[#D3FE4F]" />
              <span className="text-xs font-bold text-slate-200 tracking-tight font-mono">
                Security Audit Stream
              </span>
            </div>
            <span className="text-[11px] font-semibold text-[#D3FE4F] bg-white/5 px-2.5 py-0.5 rounded-full">
              {liveFeed.length} Events Logged
            </span>
          </div>

          <div ref={feedRef} className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800/60 p-2">
            {liveFeed.length === 0 ? (
              <div className="text-center py-20 text-slate-500 text-xs">
                No proctoring violations recorded in this active contest session.
              </div>
            ) : (
              [...liveFeed].reverse().map((event, i) => {
                const type = event.type || event.eventType || 'unknown';
                return (
                  <div key={event._id || i} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors rounded-xl">
                    <span className="text-xs text-slate-500 w-24 flex-shrink-0 font-mono">
                      {new Date(event.createdAt).toLocaleTimeString()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-200 text-xs tracking-tight">
                        {event.participantName || event.studentName || 'Unknown Student'}
                      </span>
                      {event.rollNumber && (
                        <span className="text-[11px] text-slate-400 font-mono ml-2 font-medium">
                          ({event.rollNumber})
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-[#D3FE4F] bg-[#D3FE4F]/10 border border-[#D3FE4F]/20 px-2.5 py-0.5 rounded-full capitalize">
                      {type.replace(/_/g, ' ')}
                    </span>
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
