import { attemptRepository } from '../attempts/attempts.repository.js';
import { contestRepository } from '../contests/contests.repository.js';
import { participantRepository } from '../participants/participants.repository.js';
import { teamRepository } from '../teams/teams.repository.js';
import { LEADERBOARD_DISPLAY_MODE } from '@codeathon/shared';
import { ApiError } from '../../utils/ApiError.js';

export class LeaderboardService {
  async getLeaderboard(contestId, isStudent = false) {
    const contest = await contestRepository.findById(contestId);
    if (!contest) throw ApiError.notFound('Contest not found');

    const config = contest.leaderboardConfig || { enabled: true, displayMode: LEADERBOARD_DISPLAY_MODE.WITH_NAMES, topN: 50 };

    if (!config.enabled && isStudent) {
      return {
        enabled: false,
        message: 'Leaderboard is currently disabled for this contest.',
        entries: [],
      };
    }

    // Check freeze mode
    const now = Date.now();
    const endWindow = new Date(contest.endTime).getTime();
    const freezeMs = (config.freezeMinutesBeforeEnd || 0) * 60 * 1000;
    const isFrozen = freezeMs > 0 && now >= endWindow - freezeMs && now <= endWindow;

    const attempts = await attemptRepository.find({ contestId });
    const allParticipants = await participantRepository.find({});
    const allTeams = await teamRepository.find({});

    // Filter to submitted or in-progress attempts with a score or submission
    const scoredAttempts = attempts.filter((a) =>
      (a.finalScore !== undefined && a.finalScore !== null) ||
      (a.score !== undefined && a.score !== null) ||
      (a.totalScore !== undefined && a.totalScore !== null) ||
      a.status === 'submitted'
    );

    // Sort by:
    // 1. Final score descending
    // 2. Earlier completion time / submittedAt ascending (tie breaker)
    scoredAttempts.sort((a, b) => {
      const scoreA = a.finalScore ?? a.score ?? a.totalScore ?? 0;
      const scoreB = b.finalScore ?? b.score ?? b.totalScore ?? 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      const timeA = a.completionTimeSeconds || 999999;
      const timeB = b.completionTimeSeconds || 999999;
      return timeA - timeB;
    });

    const topLimit = config.topN || 50;
    const sliced = scoredAttempts.slice(0, topLimit);

    const entries = sliced.map((att, index) => {
      const participant = allParticipants.find((p) =>
        String(p.id) === String(att.userId) ||
        String(p._id) === String(att.userId) ||
        p.email === att.userId
      );
      const team = participant?.teamId ? allTeams.find((t) => String(t.id) === String(participant.teamId) || String(t._id) === String(participant.teamId)) : null;

      const isAnonymous = isStudent && config.displayMode === LEADERBOARD_DISPLAY_MODE.ANONYMOUS;
      const candidateName = participant?.name || participant?.fullName || att.userName || 'Candidate';
      const rollNumber = participant?.rollNumber || att.rollNumber || '—';
      const score = att.finalScore ?? att.score ?? att.totalScore ?? 0;

      return {
        rank: index + 1,
        userId: isAnonymous ? `student_${index + 1}` : att.userId,
        participantId: isAnonymous ? `student_${index + 1}` : (att.userId || `part_${index + 1}`),
        name: isAnonymous ? `Participant #${index + 1}` : candidateName,
        displayName: isAnonymous ? `Participant #${index + 1}` : candidateName,
        rollNumber: isAnonymous ? undefined : rollNumber,
        teamName: isAnonymous ? undefined : team?.name,
        score,
        totalScore: score,
        mcqScore: att.mcqScore || 0,
        codingScore: att.codingScore || 0,
        completionTimeSeconds: att.completionTimeSeconds || 0,
        timeTakenMinutes: Math.round((att.completionTimeSeconds || 0) / 60),
        status: att.status,
        submittedAt: att.submittedAt,
      };
    });

    return {
      enabled: true,
      isFrozen,
      displayMode: config.displayMode,
      totalContestants: scoredAttempts.length,
      entries,
    };
  }
}

export const leaderboardService = new LeaderboardService();
