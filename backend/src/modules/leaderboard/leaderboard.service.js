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

    // Filter to submitted or in-progress attempts with a score
    const scoredAttempts = attempts.filter((a) => a.finalScore !== undefined && a.finalScore !== null);

    // Sort by:
    // 1. Final score descending
    // 2. Earlier completion time / submittedAt ascending (tie breaker)
    scoredAttempts.sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore;
      }
      const timeA = a.completionTimeSeconds || 999999;
      const timeB = b.completionTimeSeconds || 999999;
      return timeA - timeB;
    });

    const topLimit = config.topN || 50;
    const sliced = scoredAttempts.slice(0, topLimit);

    const entries = sliced.map((att, index) => {
      const participant = allParticipants.find((p) => p.id === att.userId);
      const team = participant?.teamId ? allTeams.find((t) => t.id === participant.teamId) : null;

      const isAnonymous = isStudent && config.displayMode === LEADERBOARD_DISPLAY_MODE.ANONYMOUS;

      return {
        rank: index + 1,
        userId: isAnonymous ? `student_${index + 1}` : att.userId,
        name: isAnonymous ? `Participant #${index + 1}` : att.userName || participant?.name || 'Anonymous',
        rollNumber: isAnonymous ? undefined : participant?.rollNumber,
        teamName: isAnonymous ? undefined : team?.name,
        score: att.finalScore || 0,
        mcqScore: att.mcqScore || 0,
        codingScore: att.codingScore || 0,
        completionTimeSeconds: att.completionTimeSeconds || 0,
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
