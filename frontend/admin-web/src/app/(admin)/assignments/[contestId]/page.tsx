'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi, participantsApi, teamsApi, contestsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Trash2, Users, Network, CheckCircle2, UserCheck } from 'lucide-react';

interface Participant { _id: string; rollNumber: string; name: string; email: string }
interface Team { _id: string; name: string; memberIds: string[] }
interface Assignment { participantIds: string[]; teamIds: string[] }

export default function AssignmentsPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const qc = useQueryClient();

  const { data: contestData } = useQuery({ queryKey: ['contest', contestId], queryFn: () => contestsApi.get(contestId) });
  const contest = contestData as { title?: string } | null;

  const { data: assignmentsData, isLoading: aLoading } = useQuery({
    queryKey: ['assignments', contestId],
    queryFn: () => assignmentsApi.getByContest(contestId),
  });
  const assignment = assignmentsData as Assignment | null;
  const assignedParticipantIds = new Set(assignment?.participantIds || []);
  const assignedTeamIds = new Set(assignment?.teamIds || []);

  const { data: participantsData } = useQuery({ queryKey: ['participants-all'], queryFn: () => participantsApi.list({ limit: 500 }) });
  const participants: Participant[] = (participantsData as { data?: Participant[] })?.data || [];

  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });
  const teams: Team[] = (teamsData as Team[]) || [];

  const assignMutation = useMutation({
    mutationFn: (payload: { participantIds: string[]; teamIds: string[] }) =>
      assignmentsApi.assign(contestId, payload.participantIds, payload.teamIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments', contestId] }),
  });

  const unassignMutation = useMutation({
    mutationFn: (payload: { participantId?: string; teamId?: string }) =>
      assignmentsApi.unassign(contestId, payload.participantId, payload.teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments', contestId] }),
  });

  const unassigned = participants.filter((p) => !assignedParticipantIds.has(p._id));
  const assigned = participants.filter((p) => assignedParticipantIds.has(p._id));
  const unassignedTeams = teams.filter((t) => !assignedTeamIds.has(t._id));
  const assignedTeams = teams.filter((t) => assignedTeamIds.has(t._id));

  if (aLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="p-6 sm:p-8 space-y-7 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/contests"
          className="flex items-center gap-1.5 text-xs font-semibold text-[#3760F8] hover:text-[#254EDB] px-3 py-1.5 rounded-lg bg-[#EEF2FF] hover:bg-[#E0E7FF] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Contests</span>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contest Enrollment Assignments</h1>
          <p className="text-xs text-slate-500 mt-0.5">{contest?.title || 'Contest'} &bull; Assign individual candidates or teams</p>
        </div>
      </div>

      {/* Participants Allocation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unassigned Candidates */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <h2 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Unassigned Candidates</h2>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
              {unassigned.length}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {unassigned.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-10">All registered candidates are assigned.</p>
            ) : (
              unassigned.map((p) => (
                <div key={p._id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 tracking-tight block">{p.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">{p.rollNumber}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => assignMutation.mutate({ participantIds: [p._id], teamIds: [] })}
                  >
                    <span>Assign</span>
                    <ArrowRight className="w-3 h-3 text-[#3760F8]" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Assigned Candidates */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-emerald-900 text-xs tracking-tight uppercase">Enrolled Candidates</h2>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {assigned.length} Enrolled
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {assigned.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-10">No candidates enrolled in this contest yet.</p>
            ) : (
              assigned.map((p) => (
                <div key={p._id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 tracking-tight block">{p.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">{p.rollNumber}</span>
                  </div>
                  <button
                    onClick={() => unassignMutation.mutate({ participantId: p._id })}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Teams Allocation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-slate-500" />
              <h2 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Unassigned Teams</h2>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
              {unassignedTeams.length}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {unassignedTeams.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-8">All teams assigned.</p>
            ) : (
              unassignedTeams.map((t) => (
                <div key={t._id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 tracking-tight">{t.name}</span>
                    <Badge color="gray" className="ml-2">{t.memberIds?.length || 0} Members</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => assignMutation.mutate({ participantIds: [], teamIds: [t._id] })}
                  >
                    <span>Assign Team</span>
                    <ArrowRight className="w-3 h-3 text-[#3760F8]" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-emerald-900 text-xs tracking-tight uppercase">Enrolled Teams</h2>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {assignedTeams.length} Teams
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {assignedTeams.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-8">No teams enrolled yet.</p>
            ) : (
              assignedTeams.map((t) => (
                <div key={t._id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 tracking-tight">{t.name}</span>
                    <Badge color="neon" className="ml-2">{t.memberIds?.length || 0} Members</Badge>
                  </div>
                  <button
                    onClick={() => unassignMutation.mutate({ teamId: t._id })}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
