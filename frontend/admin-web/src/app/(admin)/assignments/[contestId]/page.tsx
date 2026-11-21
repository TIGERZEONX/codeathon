'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi, participantsApi, teamsApi, contestsApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';

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

  if (aLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contests" className="text-blue-600 hover:underline text-sm">← Contests</Link>
        <h1 className="text-2xl font-bold text-gray-900">Assignments — {contest?.title || contestId}</h1>
      </div>

      {/* Participants */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b bg-gray-50 rounded-t-xl">
            <h2 className="font-semibold text-gray-700">Unassigned Participants ({unassigned.length})</h2>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y">
            {unassigned.length === 0 && <p className="text-center text-gray-400 text-sm py-6">All assigned</p>}
            {unassigned.map((p) => (
              <div key={p._id} className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.rollNumber}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => assignMutation.mutate({ participantIds: [p._id], teamIds: [] })}>
                  Assign →
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b bg-green-50 rounded-t-xl">
            <h2 className="font-semibold text-green-800">Assigned Participants ({assigned.length})</h2>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y">
            {assigned.length === 0 && <p className="text-center text-gray-400 text-sm py-6">None assigned yet</p>}
            {assigned.map((p) => (
              <div key={p._id} className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.rollNumber}</div>
                </div>
                <button onClick={() => unassignMutation.mutate({ participantId: p._id })} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b bg-gray-50 rounded-t-xl">
            <h2 className="font-semibold text-gray-700">Unassigned Teams ({unassignedTeams.length})</h2>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y">
            {unassignedTeams.length === 0 && <p className="text-center text-gray-400 text-sm py-6">All assigned</p>}
            {unassignedTeams.map((t) => (
              <div key={t._id} className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <Badge color="gray" className="ml-2">{t.memberIds?.length || 0} members</Badge>
                </div>
                <Button size="sm" variant="outline" onClick={() => assignMutation.mutate({ participantIds: [], teamIds: [t._id] })}>Assign →</Button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-5 py-3 border-b bg-green-50 rounded-t-xl">
            <h2 className="font-semibold text-green-800">Assigned Teams ({assignedTeams.length})</h2>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y">
            {assignedTeams.length === 0 && <p className="text-center text-gray-400 text-sm py-6">None yet</p>}
            {assignedTeams.map((t) => (
              <div key={t._id} className="flex items-center gap-3 px-4 py-2">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-800">{t.name}</span>
                  <Badge color="gray" className="ml-2">{t.memberIds?.length || 0} members</Badge>
                </div>
                <button onClick={() => unassignMutation.mutate({ teamId: t._id })} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
