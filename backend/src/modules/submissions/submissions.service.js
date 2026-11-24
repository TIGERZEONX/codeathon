import { attemptRepository } from '../attempts/attempts.repository.js';
import { participantRepository } from '../participants/participants.repository.js';
import { contestRepository } from '../contests/contests.repository.js';
import { auditRepository } from '../audit/audit.repository.js';
import { ApiError } from '../../utils/ApiError.js';
import { ATTEMPT_STATUS } from '@codeathon/shared';
import { getSocketServer } from '../../sockets/index.js';

export class SubmissionsService {
  async getLockedSubmissions(contestId = null) {
    const allAttempts = await attemptRepository.find(contestId ? { contestId } : {});
    const list = allAttempts.filter(
      (a) => a.status === ATTEMPT_STATUS.SUBMITTED || a.status === ATTEMPT_STATUS.REVOKED_REOPENED || a.status === 'in_progress'
    );
    const allParticipants = await participantRepository.find({});
    const allContests = await contestRepository.find({});

    const enriched = list.map((a) => {
      const participant = allParticipants.find((p) =>
        String(p.id) === String(a.userId) ||
        String(p._id) === String(a.userId) ||
        p.email === a.userId
      );
      const contest = allContests.find((c) =>
        String(c.id) === String(a.contestId) ||
        String(c._id) === String(a.contestId)
      );
      return {
        _id: a.id || a._id,
        id: a.id || a._id,
        attemptId: a.id || a._id,
        userId: a.userId,
        rollNumber: participant?.rollNumber || a.rollNumber || a.userRoll || '—',
        participantName: participant?.name || participant?.fullName || a.userName || 'Candidate',
        contestTitle: contest?.title || a.contestTitle || 'Assessment Challenge',
        contestId: a.contestId,
        status: a.status,
        totalScore: a.finalScore ?? a.totalScore ?? 0,
        finalScore: a.finalScore ?? a.totalScore ?? 0,
        mcqScore: a.mcqScore ?? 0,
        codingScore: a.codingScore ?? 0,
        submittedAt: a.submittedAt || a.updatedAt || a.startedAt,
      };
    });

    enriched.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return enriched;
  }

  async revokeSubmission(user, { attemptId, reason, extensionMinutes = 0 }) {
    const attempt = await attemptRepository.findById(attemptId);
    if (!attempt) throw ApiError.notFound('Attempt not found');

    const effectiveMinutes = Number(extensionMinutes) > 0 ? Number(extensionMinutes) : 60;
    const now = new Date();
    const newStartedAt = now.toISOString();
    const newEndsAt = new Date(now.getTime() + effectiveMinutes * 60 * 1000).toISOString();

    const updated = await attemptRepository.update(attemptId, {
      status: ATTEMPT_STATUS.IN_PROGRESS,
      startedAt: newStartedAt,
      endsAt: newEndsAt,
      extensionSeconds: effectiveMinutes * 60,
      submittedAt: null,
      submissionReason: null,
      revokedBy: user.userId,
      revokedByName: user.name,
      revocationReason: reason,
      revokedAt: newStartedAt,
    });

    // Write to audit log
    await auditRepository.create({
      userId: user.userId,
      userName: user.name,
      action: 'SUBMISSION_REVOKED',
      details: {
        attemptId,
        studentId: attempt.userId,
        studentName: attempt.userName,
        contestId: attempt.contestId,
        reason,
        extensionMinutes,
      },
      createdAt: new Date().toISOString(),
    });

    // Emit Socket.IO event to student's room
    const io = getSocketServer();
    if (io) {
      io.to(`attempt:${attemptId}`).emit('attempt:revoked', {
        attemptId,
        reason,
        extensionMinutes,
      });
      io.to(`admin:contest:${attempt.contestId}`).emit('attempt:revoked', {
        attemptId,
        studentName: attempt.userName,
        reason,
      });
    }

    return updated;
  }
}

export const submissionsService = new SubmissionsService();
