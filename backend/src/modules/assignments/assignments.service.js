import { assignmentRepository } from './assignments.repository.js';
import { participantRepository } from '../participants/participants.repository.js';
import { teamRepository } from '../teams/teams.repository.js';

export class AssignmentsService {
  async getAssignmentsByContest(contestId) {
    const list = await assignmentRepository.findByContest(contestId);
    const allParticipants = await participantRepository.find({});
    const allTeams = await teamRepository.find({});

    return list.map((a) => {
      let participant = null;
      let team = null;
      if (a.participantId) {
        participant = allParticipants.find((p) => p.id === a.participantId) || null;
      }
      if (a.teamId) {
        team = allTeams.find((t) => t.id === a.teamId) || null;
      }
      return {
        ...a,
        participant,
        team,
      };
    });
  }

  async assign(contestId, participantIds = [], teamIds = []) {
    const created = [];

    for (const pId of participantIds) {
      const existing = await assignmentRepository.findOne({ contestId, participantId: pId });
      if (!existing) {
        const item = await assignmentRepository.create({
          contestId,
          participantId: pId,
          teamId: null,
          assignedAt: new Date().toISOString(),
        });
        created.push(item);
      }
    }

    for (const tId of teamIds) {
      const existing = await assignmentRepository.findOne({ contestId, teamId: tId });
      if (!existing) {
        const item = await assignmentRepository.create({
          contestId,
          participantId: null,
          teamId: tId,
          assignedAt: new Date().toISOString(),
        });
        created.push(item);
      }
    }

    return created;
  }

  async unassign(contestId, participantId = null, teamId = null) {
    if (participantId) {
      const item = await assignmentRepository.findOne({ contestId, participantId });
      if (item) await assignmentRepository.delete(item.id);
    }
    if (teamId) {
      const item = await assignmentRepository.findOne({ contestId, teamId });
      if (item) await assignmentRepository.delete(item.id);
    }
    return true;
  }
}

export const assignmentsService = new AssignmentsService();
