import { attendanceRepository } from './attendance.repository.js';
import { participantRepository } from '../participants/participants.repository.js';
import { teamRepository } from '../teams/teams.repository.js';
import { assignmentRepository } from '../assignments/assignments.repository.js';
import { toCsv } from '../../utils/csv.js';

export class AttendanceService {
  async getAttendanceByContest(contestId, query = {}) {
    const records = await attendanceRepository.findByContest(contestId);
    const assignments = await assignmentRepository.findByContest(contestId);
    const allParticipants = await participantRepository.find({});
    const allTeams = await teamRepository.find({});

    // Build complete roster of assigned participants (whether they have started or not)
    const assignedParticipantIds = new Set();
    assignments.forEach((a) => {
      if (a.participantId) assignedParticipantIds.add(a.participantId);
      if (a.teamId) {
        const team = allTeams.find((t) => t.id === a.teamId);
        (team?.memberIds || []).forEach((mId) => assignedParticipantIds.add(mId));
      }
    });

    const roster = [];

    // Include all assigned participants or recorded attendees
    const relevantParticipantIds = new Set([...assignedParticipantIds, ...records.map((r) => r.userId)]);

    for (const pId of relevantParticipantIds) {
      const participant = allParticipants.find((p) => String(p.id) === String(pId) || String(p._id) === String(pId));
      const record = records.find((r) => String(r.userId) === String(pId));
      const team = participant?.teamId ? allTeams.find((t) => String(t.id) === String(participant.teamId)) : null;

      roster.push({
        id: record?.id || `att_${pId}`,
        _id: record?.id || `att_${pId}`,
        userId: pId,
        participantId: pId,
        participantName: participant?.name || record?.userName || 'Candidate',
        rollNumber: participant?.rollNumber || record?.rollNumber || '—',
        name: participant?.name || record?.userName || 'Candidate',
        department: participant?.department || '—',
        teamId: team?.id || null,
        teamName: team?.name || undefined,
        status: record?.status || 'absent',
        loginStatus: record?.loginStatus || (record?.status ? 'Logged in' : 'Not logged in'),
        loginTimestamp: record?.loginTimestamp || null,
        testStartTimestamp: record?.testStartTimestamp || null,
        submitTimestamp: record?.submitTimestamp || null,
        startedAt: record?.testStartTimestamp || null,
        submittedAt: record?.submitTimestamp || null,
        durationMinutes: record?.durationMinutes || 0,
      });
    }

    let filtered = roster;
    if (query.status) {
      filtered = filtered.filter((r) => r.status === query.status);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      filtered = filtered.filter((r) => r.name.toLowerCase().includes(q) || r.rollNumber.toLowerCase().includes(q));
    }
    if (query.teamId) {
      filtered = filtered.filter((r) => r.teamId === query.teamId);
    }

    // Team aggregated view
    const teamGroups = {};
    filtered.forEach((item) => {
      const tKey = item.teamId || 'individual';
      if (!teamGroups[tKey]) {
        teamGroups[tKey] = {
          teamId: item.teamId,
          teamName: item.teamName,
          totalMembers: 0,
          presentCount: 0,
          submittedCount: 0,
          students: [],
        };
      }
      teamGroups[tKey].totalMembers++;
      if (item.status === 'present' || item.status === 'completed') teamGroups[tKey].presentCount++;
      if (item.status === 'completed') teamGroups[tKey].submittedCount++;
      teamGroups[tKey].students.push(item);
    });

    return {
      totalAssigned: roster.length,
      totalPresent: roster.filter((r) => r.status === 'present' || r.status === 'completed').length,
      totalSubmitted: roster.filter((r) => r.status === 'completed').length,
      records: filtered,
      teams: Object.values(teamGroups),
    };
  }

  async exportCsv(contestId) {
    const data = await this.getAttendanceByContest(contestId);
    return toCsv(data.records, [
      'rollNumber',
      'name',
      'department',
      'teamName',
      'status',
      'loginStatus',
      'testStartTimestamp',
      'submitTimestamp',
      'durationMinutes',
    ]);
  }

  async markAttendance(contestId, userId, status = 'present') {
    let existing = await attendanceRepository.findByContestAndUser(contestId, userId);
    const now = new Date().toISOString();
    if (existing) {
      existing.status = status;
      if (status === 'present' && !existing.testStartTimestamp) {
        existing.testStartTimestamp = now;
      } else if (status === 'completed' && !existing.submitTimestamp) {
        existing.submitTimestamp = now;
      }
      return await attendanceRepository.update(existing.id, existing);
    } else {
      return await attendanceRepository.create({
        contestId,
        userId,
        status,
        loginStatus: 'Manual Status Update',
        testStartTimestamp: status !== 'absent' ? now : null,
        submitTimestamp: status === 'completed' ? now : null,
        durationMinutes: 0,
      });
    }
  }
}

export const attendanceService = new AttendanceService();
